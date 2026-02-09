import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Matches from these specific league IDs will be processed
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

  // --- SMART GATEKEEPER: SHOULD WE CALL THE API? ---
  
  // 1. Check if we have any matches at all for today in the DB
  const { count: todayCount } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .gte('kickoff_time', todayStr);

  // 2. Check for Live matches or matches starting within 20 minutes
  const { data: activeMatches } = await supabase
    .from('matches')
    .select('id')
    .or(`status.in.("1H","HT","2H","ET","P"),and(kickoff_time.gte.${now.toISOString()},kickoff_time.lte.${twentyMinsFromNow})`)
    .limit(1);

  const isTableEmptyForToday = todayCount === 0;
  const hasActiveAction = activeMatches && activeMatches.length > 0;

  // If we already have the schedule AND nothing is happening/starting soon, ABORT.
  if (!isTableEmptyForToday && !hasActiveAction) {
    console.log("Smart Skip: Matches are scheduled but none are live or imminent.");
    return new Response(JSON.stringify({ 
      skipped: true, 
      message: "No active matches. API credits preserved." 
    }), { status: 200 });
  }

  // --- PROCEED TO API SYNC ---
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const datesToSync = [yesterday.toISOString().split('T')[0], todayStr];

  let totalSynced = 0;

  for (const date of datesToSync) {
    try {
      // 1. Fetch Fixtures
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

      // 2. Process Matches & Fetch Events if Needed
      for (const item of filteredMatches) {
        let eventsData = null; // Default to null (don't overwrite existing events with empty)

        // CRITICAL: Only fetch events if the match is Finished (FT, AET, PEN)
        // This captures the match data exactly when it finishes, before the "Smart Sleep" kicks in next run.
        if (['FT', 'AET', 'PEN'].includes(item.fixture.status.short)) {
           try {
             // We fetch events specifically for this finished match
             const eventRes = await fetch(`https://v3.football.api-sports.io/fixtures/events?fixture=${item.fixture.id}`, {
               headers: { 'x-apisports-key': API_KEY || '' }
             });
             const eventJson = await eventRes.json();
             eventsData = eventJson.response || [];
           } catch (e) {
             console.error(`Failed to fetch events for match ${item.fixture.id}:`, e);
           }
        }

        // Construct the update object
        const updatePayload: any = {
            id: item.fixture.id,
            league_id: item.league.id,
            home_team: item.teams.home.name,
            away_team: item.teams.away.name,
            status: item.fixture.status.short,
            home_score: item.goals.home ?? 0,
            away_score: item.goals.away ?? 0,
            kickoff_time: item.fixture.date,
            last_updated: new Date().toISOString()
        };

        // Only add events field if we actually fetched them (preserves bandwidth/data)
        if (eventsData !== null) {
            updatePayload.events = eventsData;
        }

        updates.push(updatePayload);
      }

      // 3. Upsert to DB
      if (updates.length > 0) {
        const { error } = await supabase.from('matches').upsert(updates, { onConflict: 'id' });
        if (!error) totalSynced += updates.length;
        else console.error(`DB Error for ${date}:`, error.message);
      }

    } catch (err) {
      console.error(`Sync error for ${date}:`, err);
    }
  }

  return new Response(JSON.stringify({ 
    success: true,
    message: `Sync complete. Processed ${totalSynced} matches (with events for finished games).` 
  }), { status: 200 });
})