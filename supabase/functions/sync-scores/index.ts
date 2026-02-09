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
  // Only fetch yesterday's fixtures during late-night settlement window (00:00-03:00)
  // to catch delayed match completions while conserving API credits
  const currentHour = now.getHours();
  const shouldFetchYesterday = currentHour >= 0 && currentHour < 3;
  
  const datesToSync = shouldFetchYesterday 
    ? [new Date(now.getTime() - 24 * 60 * 60000).toISOString().split('T')[0], todayStr]
    : [todayStr];

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

      // PRE-FETCH EXISTING MATCH DATA TO AVOID REDUNDANT API CALLS
      const matchIds = filteredMatches.map((item: any) => item.fixture.id);
      const { data: existingMatches } = await supabase
        .from('matches')
        .select('id, lineups, events, last_updated, finished_at')
        .in('id', matchIds);

      // Create a lookup map for O(1) access
      const existingMatchMap = new Map<number, {
        id: number;
        lineups: any;
        events: any;
        last_updated: string | null;
        finished_at: string | null;
      }>(
        existingMatches?.map((m: any) => [m.id, m]) || []
      );

      const updates = [];

      // Loop through matches to check for narrative data (Lineups/Events)
      for (const item of filteredMatches) {
        let eventsData = null;
        let lineupsData = null;

        const matchId = item.fixture.id;
        const status = item.fixture.status.short;
        const kickoffTime = new Date(item.fixture.date);
        const timeUntilKickoff = kickoffTime.getTime() - now.getTime();
        const timeSinceKickoff = now.getTime() - kickoffTime.getTime();

        const existingMatch = existingMatchMap.get(matchId);
        const hasLineups = existingMatch?.lineups && 
                          Array.isArray(existingMatch.lineups) && 
                          existingMatch.lineups.length > 0;

        // A. STATE-AWARE LINEUP FETCHING
        // Time Window: T-60m to T+30m
        const inLineupWindow = timeUntilKickoff <= 60 * 60000 && timeSinceKickoff <= 30 * 60000;

        let shouldFetchLineups = false;
        if (inLineupWindow) {
          if (!hasLineups) {
            // No lineups in DB - fetch immediately
            shouldFetchLineups = true;
          } else if (existingMatch?.last_updated) {
            // Lineups exist - only re-fetch if stale (>30min old)
            const lastUpdate = new Date(existingMatch.last_updated);
            const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / 60000;
            shouldFetchLineups = minutesSinceUpdate > 30;
          }
        }

        if (shouldFetchLineups) {
          try {
            const lineupRes = await fetch(`https://v3.football.api-sports.io/fixtures/lineups?fixture=${matchId}`, {
              headers: { 'x-apisports-key': API_KEY || '' }
            });
            const lineupJson = await lineupRes.json();
            lineupsData = lineupJson.response || [];
            console.log(`[LINEUP] Fetched for match ${matchId} (${!hasLineups ? 'new' : 'refresh'})`);
          } catch (e) {
            console.error(`Failed to fetch lineups for ${matchId}`);
          }
        }

        // B. STATE-AWARE EVENT FETCHING
        // Time Window: T-15m to FT+15m
        const inPreMatchWindow = timeUntilKickoff <= 15 * 60000 && timeUntilKickoff > 0;
        const isFinished = ['FT', 'AET', 'PEN'].includes(status);

        let shouldFetchEvents = false;

        if (inPreMatchWindow || isFinished) {
          // Check if match has been finished for > 15 minutes
          if (isFinished && existingMatch?.finished_at) {
            const finishedAt = new Date(existingMatch.finished_at);
            const minutesSinceFinished = (now.getTime() - finishedAt.getTime()) / 60000;
            
            if (minutesSinceFinished > 15) {
              // Match finished > 15min ago - stop fetching
              shouldFetchEvents = false;
            } else {
              // Still within 15min post-finish window
              shouldFetchEvents = true;
            }
          } else if (isFinished && !existingMatch?.finished_at) {
            // Just transitioned to finished - fetch and record timestamp
            shouldFetchEvents = true;
          } else {
            // Pre-match window or active match
            shouldFetchEvents = true;
          }
        }

        if (shouldFetchEvents) {
          try {
            const eventRes = await fetch(`https://v3.football.api-sports.io/fixtures/events?fixture=${matchId}`, {
              headers: { 'x-apisports-key': API_KEY || '' }
            });
            const eventJson = await eventRes.json();
            eventsData = eventJson.response || [];
            console.log(`[EVENTS] Fetched for match ${matchId} (status: ${status})`);
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

        // Track when match finishes for event fetching cutoff
        if (['FT', 'AET', 'PEN'].includes(status) && !existingMatch?.finished_at) {
          updatePayload.finished_at = new Date().toISOString();
        }

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