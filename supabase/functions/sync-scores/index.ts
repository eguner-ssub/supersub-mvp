import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * LEAGUE COVERAGE
 * Central source of truth for league IDs.
 */
const SUPPORTED_LEAGUE_IDS = [39, 40, 71, 78, 135, 94]; 

/**
 * MATCH STATUS GROUPS
 */
const LIVE_STATUSES  = ['1H', 'HT', '2H', 'ET', 'P'];
const FINAL_STATUSES = ['FT', 'AET', 'PEN'];

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const API_KEY = Deno.env.get('SPORTS_API_KEY')?.trim()
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // --- API-call counters for summary ---
  let fixtureApiCalls = 0;
  let lineupApiCalls  = 0;
  let eventApiCalls   = 0;
  let skippedActions  = 0;
  let totalProcessed  = 0;

  console.log(`[SYNC] Run started at ${now.toISOString()}`);

  // --- 1. DATE RANGE ---
  // Only fetch yesterday between 00:00–03:00 UTC to catch late finishes.
  const currentHour = now.getUTCHours();
  const shouldFetchYesterday = currentHour >= 0 && currentHour < 3;
  
  const datesToSync = shouldFetchYesterday 
    ? [new Date(now.getTime() - 24 * 60 * 60000).toISOString().split('T')[0], todayStr]
    : [todayStr];

  console.log(`[SYNC] Dates to sync: ${datesToSync.join(', ')} (hour=${currentHour}, yesterday=${shouldFetchYesterday})`);

  let totalSynced = 0;

  for (const date of datesToSync) {
    try {
      // --- 2. FIXTURES FETCH (1 API call per date) ---
      fixtureApiCalls++;
      const response = await fetch(`https://v3.football.api-sports.io/fixtures?date=${date}`, {
        headers: { 'x-apisports-key': API_KEY || '', 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      if (!result.response) {
        console.log(`[SKIP] No response from API for date ${date}`);
        continue;
      }

      const filteredMatches = result.response.filter((item: any) => 
        SUPPORTED_LEAGUE_IDS.includes(item.league.id)
      );

      if (filteredMatches.length === 0) {
        console.log(`[SKIP] No supported-league matches found for ${date}`);
        continue;
      }

      console.log(`[FIXTURES] ${date}: ${filteredMatches.length} matches in supported leagues`);

      // --- 3. SINGLE PRE-FLIGHT SUPABASE QUERY ---
      // Get current DB state for all matches in one query.
      const matchIds = filteredMatches.map((item: any) => item.fixture.id);
      const { data: existingMatches } = await supabase
        .from('matches')
        .select('id, status, lineups, events, last_updated, finished_at')
        .in('id', matchIds);

      const existingMatchMap = new Map<number, {
        id: number;
        status: string | null;
        lineups: any;
        events: any;
        last_updated: string | null;
        finished_at: string | null;
      }>(
        existingMatches?.map((m: any) => [m.id, m]) || []
      );

      const updates = [];

      // --- 4. PER-MATCH PRE-FLIGHT CHECK ---
      for (const item of filteredMatches) {
        const matchId    = item.fixture.id;
        const apiStatus  = item.fixture.status.short;
        const kickoffTime = new Date(item.fixture.date);

        // Timing calculations (in milliseconds)
        const timeUntilKickoff = kickoffTime.getTime() - now.getTime();
        const timeSinceKickoff = now.getTime() - kickoffTime.getTime();

        // DB state
        const existingMatch = existingMatchMap.get(matchId);
        const hasLineups = existingMatch?.lineups && 
                          Array.isArray(existingMatch.lineups) && 
                          existingMatch.lineups.length > 0;

        let eventsData: any  = null;
        let lineupsData: any = null;

        // Wrap individual match processing in try/catch
        try {

          // =========================================================
          // A. LINEUP PRE-FLIGHT — Window: T-60m to T+30m
          //    Pattern: Fetch until received → one Confirmation Check
          //    → then stop for this fixture.
          // =========================================================
          const inLineupWindow = timeUntilKickoff <= 60 * 60000 && timeSinceKickoff <= 30 * 60000;

          if (!inLineupWindow) {
            // Outside window entirely
            const offsetMin = Math.round(timeUntilKickoff / 60000);
            console.log(`[SKIP] Lineups for Match ${matchId}: Outside window (T${offsetMin > 0 ? '-' : '+'}${Math.abs(offsetMin)}m)`);
            skippedActions++;

          } else if (!hasLineups) {
            // ── CASE A: No lineups in DB → fetch every minute until received
            lineupApiCalls++;
            const lineupRes = await fetch(`https://v3.football.api-sports.io/fixtures/lineups?fixture=${matchId}`, {
              headers: { 'x-apisports-key': API_KEY || '' }
            });
            const lineupJson = await lineupRes.json();
            lineupsData = lineupJson.response || [];
            console.log(`[LINEUP] Fetched for Match ${matchId} (new — no lineups in DB)`);

          } else if (timeSinceKickoff > 0 && existingMatch?.last_updated) {
            // ── CASE B: Post-kickoff — check if already confirmed after kickoff
            const lastUpdate = new Date(existingMatch.last_updated);

            if (lastUpdate.getTime() >= kickoffTime.getTime()) {
              // Already fetched after kickoff → confirmed, stop permanently
              console.log(`[SKIP] Lineups for Match ${matchId}: Confirmed post-kickoff (last_updated after KO)`);
              skippedActions++;
            } else {
              // Last update was pre-kickoff → one final confirmation fetch
              lineupApiCalls++;
              const lineupRes = await fetch(`https://v3.football.api-sports.io/fixtures/lineups?fixture=${matchId}`, {
                headers: { 'x-apisports-key': API_KEY || '' }
              });
              const lineupJson = await lineupRes.json();
              lineupsData = lineupJson.response || [];
              console.log(`[LINEUP] Fetched for Match ${matchId} (post-kickoff confirmation check)`);
            }

          } else if (existingMatch?.last_updated) {
            // ── CASE C: Pre-kickoff, lineups exist — check staleness for confirmation
            const lastUpdate = new Date(existingMatch.last_updated);
            const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / 60000;

            if (minutesSinceUpdate <= 30) {
              console.log(`[SKIP] Lineups for Match ${matchId}: Already exists and fresh (${Math.round(minutesSinceUpdate)}m old)`);
              skippedActions++;
            } else {
              // >30m stale → confirmation re-fetch
              lineupApiCalls++;
              const lineupRes = await fetch(`https://v3.football.api-sports.io/fixtures/lineups?fixture=${matchId}`, {
                headers: { 'x-apisports-key': API_KEY || '' }
              });
              const lineupJson = await lineupRes.json();
              lineupsData = lineupJson.response || [];
              console.log(`[LINEUP] Fetched for Match ${matchId} (pre-kickoff confirmation — was ${Math.round(minutesSinceUpdate)}m stale)`);
            }

          } else {
            // ── CASE D: Lineups exist but no last_updated (edge case) → fetch
            lineupApiCalls++;
            const lineupRes = await fetch(`https://v3.football.api-sports.io/fixtures/lineups?fixture=${matchId}`, {
              headers: { 'x-apisports-key': API_KEY || '' }
            });
            const lineupJson = await lineupRes.json();
            lineupsData = lineupJson.response || [];
            console.log(`[LINEUP] Fetched for Match ${matchId} (missing last_updated — forced refresh)`);
          }

          // =========================================================
          // B. EVENT PRE-FLIGHT — Window: T-15m to finished_at+15m
          // =========================================================
          const isLive     = LIVE_STATUSES.includes(apiStatus);
          const isFinished = FINAL_STATUSES.includes(apiStatus);

          if (timeUntilKickoff > 15 * 60000 && !isLive && !isFinished) {
            // Too early — before T-15
            const offsetMin = Math.round(timeUntilKickoff / 60000);
            console.log(`[SKIP] Events for Match ${matchId}: Too early (T-${offsetMin}m)`);
            skippedActions++;

          } else if (apiStatus === 'NS' && timeUntilKickoff <= 15 * 60000 && timeUntilKickoff > 0) {
            // Pre-match window: T-15 to T+0, still NS — fetch
            eventApiCalls++;
            const eventRes = await fetch(`https://v3.football.api-sports.io/fixtures/events?fixture=${matchId}`, {
              headers: { 'x-apisports-key': API_KEY || '' }
            });
            const eventJson = await eventRes.json();
            eventsData = eventJson.response || [];
            console.log(`[EVENTS] Fetched for Match ${matchId} (pre-match window)`);

          } else if (isLive) {
            // Active match — fetch every minute
            eventApiCalls++;
            const eventRes = await fetch(`https://v3.football.api-sports.io/fixtures/events?fixture=${matchId}`, {
              headers: { 'x-apisports-key': API_KEY || '' }
            });
            const eventJson = await eventRes.json();
            eventsData = eventJson.response || [];
            console.log(`[EVENTS] Fetched for Match ${matchId} (LIVE — status: ${apiStatus})`);

          } else if (isFinished) {
            // Finished — check the 15-minute cooldown window
            if (existingMatch?.finished_at) {
              const finishedAt = new Date(existingMatch.finished_at);
              const minutesSinceFinished = (now.getTime() - finishedAt.getTime()) / 60000;

              if (minutesSinceFinished > 15) {
                console.log(`[SKIP] Events for Match ${matchId}: Post-FT window closed (${Math.round(minutesSinceFinished)}m since FT)`);
                skippedActions++;
              } else {
                // Still in cooldown — fetch
                eventApiCalls++;
                const eventRes = await fetch(`https://v3.football.api-sports.io/fixtures/events?fixture=${matchId}`, {
                  headers: { 'x-apisports-key': API_KEY || '' }
                });
                const eventJson = await eventRes.json();
                eventsData = eventJson.response || [];
                console.log(`[EVENTS] Fetched for Match ${matchId} (post-FT cooldown, ${Math.round(minutesSinceFinished)}m since FT)`);
              }
            } else {
              // Just transitioned to finished — fetch & we'll stamp finished_at below
              eventApiCalls++;
              const eventRes = await fetch(`https://v3.football.api-sports.io/fixtures/events?fixture=${matchId}`, {
                headers: { 'x-apisports-key': API_KEY || '' }
              });
              const eventJson = await eventRes.json();
              eventsData = eventJson.response || [];
              console.log(`[EVENTS] Fetched for Match ${matchId} (just finished — stamping finished_at)`);
            }

          } else {
            // Catch-all: other statuses (PST, CANC, ABD, etc.) — skip
            console.log(`[SKIP] Events for Match ${matchId}: Unhandled status "${apiStatus}"`);
            skippedActions++;
          }

          // =========================================================
          // C. BUILD UPDATE PAYLOAD
          // =========================================================
          const updatePayload: any = {
            id: matchId,
            league_id: item.league.id,
            home_team: item.teams.home.name,
            away_team: item.teams.away.name,
            status: apiStatus,
            home_score: item.goals.home ?? 0,
            away_score: item.goals.away ?? 0,
            kickoff_time: item.fixture.date,
            last_updated: new Date().toISOString()
          };

          // Stamp finished_at on first transition to final status
          if (FINAL_STATUSES.includes(apiStatus) && !existingMatch?.finished_at) {
            updatePayload.finished_at = new Date().toISOString();
          }

          if (eventsData !== null)  updatePayload.events  = eventsData;
          if (lineupsData !== null) updatePayload.lineups = lineupsData;

          updates.push(updatePayload);
          totalProcessed++;

        } catch (matchError) {
          console.error(`[ERROR] Failed processing Match ${matchId}:`, matchError);
          // Continue with next match — don't crash the loop
        }
      }

      // --- 5. UPSERT TO DATABASE ---
      if (updates.length > 0) {
        const { error } = await supabase.from('matches').upsert(updates, { onConflict: 'id' });
        if (!error) {
          totalSynced += updates.length;
        } else {
          console.error(`[DB ERROR] Upsert failed for ${date}:`, error.message);
        }
      }

    } catch (err) {
      console.error(`[ERROR] Sync error for date ${date}:`, err);
    }
  }

  // --- 6. SUMMARY ---
  console.log(`[SUMMARY] Processed ${totalProcessed} matches. Fixtures API: ${fixtureApiCalls} calls. Lineups API: ${lineupApiCalls} calls. Events API: ${eventApiCalls} calls. Skipped: ${skippedActions}.`);

  return new Response(JSON.stringify({ 
    success: true,
    message: `Sync complete. Processed ${totalSynced} matches.`,
    apiCalls: {
      fixtures: fixtureApiCalls,
      lineups: lineupApiCalls,
      events: eventApiCalls,
      skipped: skippedActions
    }
  }), { 
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
})