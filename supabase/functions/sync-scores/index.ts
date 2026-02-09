import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * LEAGUE COVERAGE
 * Central source of truth for league IDs.
 */
const SUPPORTED_LEAGUE_IDS = [39, 40, 71, 78, 135, 94]; 

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const API_KEY = Deno.env.get('SPORTS_API_KEY')?.trim()
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const twentyMinsFromNow = new Date(now.getTime() + 20 * 60000).toISOString();

  // --- 1. SMART GATEKEEPER ---
  // We check the DB first to see if we even need to talk to the API.

  // A. Check if the daily schedule is already in the DB
  const { count: todayCount } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .gte('kickoff_time', todayStr);

  // B. Check for active matches, matches starting within 20 minutes, OR stuck in NS past kickoff
  const { data: activeMatches } = await supabase
    .from('matches')
    .select('id')
    .or(`status.in.("1H","HT","2H","ET","P"),and(kickoff_time.gte.${now.toISOString()},kickoff_time.lte.${twentyMinsFromNow}),and(status.eq.NS,kickoff_time.lt.${now.toISOString()})`)
    .limit(1);

  const isTableEmptyForToday = todayCount === 0;
  const hasActiveAction = activeMatches && activeMatches.length > 0;

  // HIBERNATION: If schedule exists and no games are live/starting soon, exit.
  if (!isTableEmptyForToday && !hasActiveAction) {
    console.log("Smart Skip: No live or imminent matches. Hibernating to save credits.");
    return new Response(JSON.stringify({ 
      skipped: true, 
      message: "Hibernating: No active matches." 
    }), { status: 200 });
  }

  // --- 2. MAIN SYNC LOGIC ---
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const datesToSync = [yesterday.toISOString().split('T')[0], todayStr];

  let totalSynced = 0;

  for (const date of datesToSync) {
    try {
      // Fetch Basic Fixtures for the day
      const response = await fetch(`https://v3.football.api-sports.io/fixtures?date=${date}`, {
        headers: { 'x-apisports-key': API_KEY || '', 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      if (!result.response) continue;

      const filteredMatches = result.response.filter((item: any) => 
        SUPPORTED_LEAGUE_IDS.includes(item.league.id)
      );

      if (filteredMatches.length === 0) continue;

      const updates = [];

      // Loop through matches to check for narrative data (Lineups/Events)
      for (const item of filteredMatches) {
        let eventsData = null;
        let lineupsData = null;

        const matchId = item.fixture.id;
        const status = item.fixture.status.short;

        // A. FETCH LINEUPS
        // Fetch when match is in First Half (1H) or Half Time (HT) for engagement
        if (['1H', 'HT'].includes(status)) {
            try {
                const lineupRes = await fetch(`https://v3.football.api-sports.io/fixtures/lineups?fixture=${matchId}`, {
                    headers: { 'x-apisports-key': API_KEY || '' }
                });
                const lineupJson = await lineupRes.json();
                lineupsData = lineupJson.response || [];
            } catch (e) {
                console.error(`Failed to fetch lineups for ${matchId}`);
            }
        }

        // B. FETCH EVENTS
        // Fetch only when finished (FT) to settle Anytime Goalscorer and Supersub markets
        if (['FT', 'AET', 'PEN'].includes(status)) {
           try {
             const eventRes = await fetch(`https://v3.football.api-sports.io/fixtures/events?fixture=${matchId}`, {
               headers: { 'x-apisports-key': API_KEY || '' }
             });
             const eventJson = await eventRes.json();
             eventsData = eventJson.response || [];
           } catch (e) {
             console.error(`Failed to fetch events for ${matchId}`);
           }
        }

        // Construct Update Payload
        const updatePayload: any = {
            id: matchId,
            league_id: item.league.id,
            home_team: item.teams.home.name,
            away_team: item.teams.away.name,
            status: status,
            home_score: item.goals.home ?? 0,
            away_score: item.goals.away ?? 0,
            kickoff_time: item.fixture.date,
            last_updated: new Date().toISOString()
        };

        if (eventsData !== null) updatePayload.events = eventsData;
        if (lineupsData !== null) updatePayload.lineups = lineupsData;

        updates.push(updatePayload);
      }

      // 3. UPSERT TO DATABASE
      if (updates.length > 0) {
        const { error } = await supabase.from('matches').upsert(updates, { onConflict: 'id' });
        if (!error) totalSynced += updates.length;
        else console.error(`Database Upsert Error:`, error.message);
      }

    } catch (err) {
      console.error(`Sync error for ${date}:`, err);
    }
  }

  return new Response(JSON.stringify({ 
    success: true,
    message: `Sync complete. Processed ${totalSynced} matches.` 
  }), { 
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
})