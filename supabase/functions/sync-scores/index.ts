import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * LEAGUE COVERAGE — Central source of truth for league IDs.
 */
const SUPPORTED_LEAGUE_IDS = [39, 40, 71, 78, 135, 94];

/**
 * STATUS GROUPS
 */
const LIVE_STATUSES  = ['1H', 'HT', '2H', 'ET', 'P'];
const FINAL_STATUSES = ['FT', 'AET', 'PEN'];

/**
 * FREQUENCY GATES (milliseconds)
 */
const LINEUP_STALE_MS = 5 * 60_000;   // 5 minutes
const PRE_LIVE_WINDOW = 60 * 60_000;  // 60 minutes before kickoff

/**
 * STATISTICS KEYS — Only extract these from the API response
 */
const STATS_KEYS = [
  'Ball Possession',
  'Expected Goals',
  'Passes %',
  'Shots on Goal',
  'Total Shots',
  'Corner Kicks',
  'Fouls',
  'Dangerous Attacks',
];

// ────────────────────────────────────────────────────
// STATUS DERIVATION — Pure function, no side-effects
// Instant Finality: FT/AET/PEN → COMPLETED immediately
// ────────────────────────────────────────────────────
type CustomStatus = 'UPCOMING' | 'PRE-LIVE' | 'LIVE' | 'COMPLETED';

function deriveCustomStatus(
  apiStatus: string,
  kickoffTime: Date,
  _finishedAt: Date | null,
  now: Date
): CustomStatus {
  // 1. LIVE — API says match is actively playing
  if (LIVE_STATUSES.includes(apiStatus)) return 'LIVE';

  // 2. FINISHED — instant finality, no POST-MATCH window
  if (FINAL_STATUSES.includes(apiStatus)) return 'COMPLETED';

  // 3. PRE-LIVE — kickoff is within 60 minutes from now
  const msUntilKickoff = kickoffTime.getTime() - now.getTime();
  if (msUntilKickoff <= PRE_LIVE_WINDOW && msUntilKickoff > 0) return 'PRE-LIVE';

  // 4. Everything else
  return 'UPCOMING';
}

// ────────────────────────────────────────────────────
// SYNC — The Sniper Loop
// ────────────────────────────────────────────────────
interface SyncCounters {
  fixtureApiCalls: number;
  lineupApiCalls: number;
  eventApiCalls: number;
  statsApiCalls: number;
  skippedMatches: number;
  processedMatches: number;
  syncedToDb: number;
  dbErrors: string[];
}

async function sync(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  isFullSync: boolean,
  pulseLabel: string
): Promise<SyncCounters> {
  const counters: SyncCounters = {
    fixtureApiCalls: 0,
    lineupApiCalls: 0,
    eventApiCalls: 0,
    statsApiCalls: 0,
    skippedMatches: 0,
    processedMatches: 0,
    syncedToDb: 0,
    dbErrors: [],
  };

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentHour = now.getUTCHours();

  console.log(`[${pulseLabel}] Sync started at ${now.toISOString()}`);

  // ── 1. DETERMINE DATES TO FETCH ──────────────────
  const datesToSync: string[] = [todayStr];

  // Full-sync (Scheduler): ALWAYS include yesterday for hard reset
  if (isFullSync) {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60_000)
      .toISOString()
      .split('T')[0];
    datesToSync.unshift(yesterday);
    console.log(`[${pulseLabel}] Full-sync (Safety Scheduler): hard reset for ${yesterday} + ${todayStr}`);
  }

  // ── 2. PRE-FLIGHT: Get existing DB state ─────────
  let existingMatchMap = new Map<number, {
    id: number;
    status: string | null;
    custom_status: string | null;
    lineups: any;
    events: any;
    last_updated: string | null;
    finished_at: string | null;
  }>();

  if (!isFullSync) {
    // Proactive Sniper: include active matches AND upcoming matches near kickoff
    const sniperCutoff = new Date(now.getTime() + PRE_LIVE_WINDOW).toISOString();

    // Query 1: All active (non-UPCOMING, non-COMPLETED) matches
    const { data: activeMatches } = await supabase
      .from('matches')
      .select('id, status, custom_status, lineups, events, last_updated, finished_at')
      .not('custom_status', 'in', '("COMPLETED","UPCOMING")');

    // Query 2: UPCOMING matches within 60 minutes of kickoff
    const { data: upcomingNearKickoff } = await supabase
      .from('matches')
      .select('id, status, custom_status, lineups, events, last_updated, finished_at')
      .eq('custom_status', 'UPCOMING')
      .lte('kickoff_time', sniperCutoff);

    // Merge both sets into the map
    const allSniperMatches = [...(activeMatches || []), ...(upcomingNearKickoff || [])];
    existingMatchMap = new Map(allSniperMatches.map((m: any) => [m.id, m]));

    const upcomingCount = upcomingNearKickoff?.length || 0;
    console.log(`[${pulseLabel}] [SNIPER] Monitoring ${existingMatchMap.size} matches (including ${upcomingCount} about to start)`);

    // If nothing to monitor, exit early
    if (existingMatchMap.size === 0) {
      console.log(`[${pulseLabel}] No active or near-kickoff matches — nothing to snipe.`);
      return counters;
    }
  }

  // ── 3. FETCH FIXTURES FROM API ──────────────────
  for (const date of datesToSync) {
    try {
      counters.fixtureApiCalls++;
      const response = await fetch(
        `https://v3.football.api-sports.io/fixtures?date=${date}`,
        { headers: { 'x-apisports-key': apiKey, 'Content-Type': 'application/json' } }
      );
      const result = await response.json();

      if (!result.response) {
        console.log(`[${pulseLabel}] No API response for date ${date}`);
        continue;
      }

      console.log(`[${pulseLabel}] [DEBUG] Total fixtures found before filtering: ${result.response.length}`);

      // Filter to supported leagues
      const filteredMatches = result.response.filter(
        (item: any) => SUPPORTED_LEAGUE_IDS.includes(item.league.id)
      );

      if (filteredMatches.length === 0) {
        console.log(`[${pulseLabel}] No supported-league matches for ${date}`);
        continue;
      }

      console.log(`[${pulseLabel}] ${date}: ${filteredMatches.length} matches in supported leagues`);

      // For full_sync, bulk-fetch existing DB state for these matches
      if (isFullSync) {
        const matchIds = filteredMatches.map((item: any) => item.fixture.id);
        const { data: existingMatches } = await supabase
          .from('matches')
          .select('id, status, custom_status, lineups, events, last_updated, finished_at')
          .in('id', matchIds);

        if (existingMatches) {
          for (const m of existingMatches) {
            existingMatchMap.set(m.id, m);
          }
        }
      }

      // ── 4. PER-MATCH SNIPER LOOP ────────────────
      const updates: any[] = [];

      for (const item of filteredMatches) {
        const matchId     = item.fixture.id;
        const apiStatus   = item.fixture.status.short;
        const kickoffTime = new Date(item.fixture.date);

        const existingMatch = existingMatchMap.get(matchId);
        const existingFinishedAt = existingMatch?.finished_at
          ? new Date(existingMatch.finished_at)
          : null;

        // Derive custom_status
        const customStatus = deriveCustomStatus(
          apiStatus, kickoffTime, existingFinishedAt, now
        );

        // ── SNIPER GATE: Skip safely dormant matches ────────────
        // • COMPLETED + already harvested → skip (ejected forever)
        // • UPCOMING + kickoff still in future → skip (nothing to do yet)
        // • UPCOMING + kickoff <= now → process! (auto-defibrillation)
        // • Newly COMPLETED (db ≠ COMPLETED) → process (final harvest)
        const dbStatus = existingMatch?.custom_status;
        const isNewlyCompleted = customStatus === 'COMPLETED' && dbStatus !== 'COMPLETED';
        const isTrulyUpcoming  = customStatus === 'UPCOMING' && kickoffTime > now;

        if (!isFullSync && !isNewlyCompleted && (customStatus === 'COMPLETED' || isTrulyUpcoming)) {
          counters.skippedMatches++;
          console.log(`[${pulseLabel}] [SKIP] Match ${matchId}: ${customStatus} (db: ${dbStatus ?? 'N/A'}, kickoff: ${kickoffTime.toISOString()})`);
          continue;
        }

        try {
          let lineupsData: any = null;
          let eventsData: any  = null;
          let statsData: any   = null;

          const lastUpdated = existingMatch?.last_updated
            ? new Date(existingMatch.last_updated)
            : null;
          const msSinceUpdate = lastUpdated
            ? now.getTime() - lastUpdated.getTime()
            : Infinity;

          const hasLineups = existingMatch?.lineups &&
            Array.isArray(existingMatch.lineups) &&
            existingMatch.lineups.length > 0;

          // ── A. LIVE — fetch events + stats every sync ──────
          if (customStatus === 'LIVE') {
            // Events
            counters.eventApiCalls++;
            const eventRes = await fetch(
              `https://v3.football.api-sports.io/fixtures/events?fixture=${matchId}`,
              { headers: { 'x-apisports-key': apiKey } }
            );
            const eventJson = await eventRes.json();
            eventsData = eventJson.response || [];
            console.log(`[${pulseLabel}] [EVENTS] Match ${matchId} (LIVE — ${apiStatus}, got ${eventsData.length} events)`);

            // Statistics — LIVE only
            try {
              counters.statsApiCalls++;
              const statsRes = await fetch(
                `https://v3.football.api-sports.io/fixtures/statistics?fixture=${matchId}`,
                { headers: { 'x-apisports-key': apiKey } }
              );
              const statsJson = await statsRes.json();
              const rawStats = statsJson.response || [];

              if (rawStats.length >= 2) {
                const extractKeys = (teamStats: any[]) => {
                  const out: Record<string, any> = {};
                  for (const s of teamStats) {
                    if (STATS_KEYS.includes(s.type)) out[s.type] = s.value;
                  }
                  return out;
                };
                statsData = {
                  home: extractKeys(rawStats[0].statistics || []),
                  away: extractKeys(rawStats[1].statistics || []),
                };
                console.log(`[${pulseLabel}] [STATS] Match ${matchId} (LIVE): ${Object.keys(statsData.home).length} stat keys`);
              }
            } catch (statsErr) {
              console.error(`[${pulseLabel}] [STATS ERROR] Match ${matchId}:`, statsErr);
            }
          }

          // ── B. PRE-LIVE — lazy lineups (skip if already populated) ──
          if (customStatus === 'PRE-LIVE' && !hasLineups && msSinceUpdate > LINEUP_STALE_MS) {
            counters.lineupApiCalls++;
            const lineupRes = await fetch(
              `https://v3.football.api-sports.io/fixtures/lineups?fixture=${matchId}`,
              { headers: { 'x-apisports-key': apiKey } }
            );
            const lineupJson = await lineupRes.json();
            lineupsData = lineupJson.response || [];
            console.log(`[${pulseLabel}] [LINEUP] Match ${matchId} (PRE-LIVE — no lineups, ${Math.round(msSinceUpdate / 60_000)}m stale)`);
          } else if (customStatus === 'PRE-LIVE' && hasLineups) {
            console.log(`[${pulseLabel}] [SKIP] Lineups for Match ${matchId}: already populated`);
          } else if (customStatus === 'PRE-LIVE' && !hasLineups) {
            console.log(`[${pulseLabel}] [SKIP] Lineups for Match ${matchId}: checked ${Math.round(msSinceUpdate / 60_000)}m ago (gate: 5m)`);
          }

          // ── C. COMPLETED — one final fetch of events + stats, then eject ──
          if (customStatus === 'COMPLETED' && !existingMatch?.finished_at) {
            // First time seeing FT — do one final harvest
            counters.eventApiCalls++;
            const eventRes = await fetch(
              `https://v3.football.api-sports.io/fixtures/events?fixture=${matchId}`,
              { headers: { 'x-apisports-key': apiKey } }
            );
            const eventJson = await eventRes.json();
            eventsData = eventJson.response || [];
            console.log(`[${pulseLabel}] [FINAL] Match ${matchId}: harvesting events (${eventsData.length}) on COMPLETED transition`);

            try {
              counters.statsApiCalls++;
              const statsRes = await fetch(
                `https://v3.football.api-sports.io/fixtures/statistics?fixture=${matchId}`,
                { headers: { 'x-apisports-key': apiKey } }
              );
              const statsJson = await statsRes.json();
              const rawStats = statsJson.response || [];
              if (rawStats.length >= 2) {
                const extractKeys = (teamStats: any[]) => {
                  const out: Record<string, any> = {};
                  for (const s of teamStats) {
                    if (STATS_KEYS.includes(s.type)) out[s.type] = s.value;
                  }
                  return out;
                };
                statsData = {
                  home: extractKeys(rawStats[0].statistics || []),
                  away: extractKeys(rawStats[1].statistics || []),
                };
                console.log(`[${pulseLabel}] [FINAL] Match ${matchId}: harvesting stats on COMPLETED transition`);
              }
            } catch (statsErr) {
              console.error(`[${pulseLabel}] [STATS ERROR] Match ${matchId} (FINAL):`, statsErr);
            }
          }

          // ── BUILD UPDATE PAYLOAD ────────────────────
          const updatePayload: any = {
            id: matchId,
            league_id: item.league.id,
            home_team: item.teams.home.name,
            away_team: item.teams.away.name,
            home_logo: item.teams.home.logo,
            away_logo: item.teams.away.logo,
            league_name: item.league.name,
            league_logo: item.league.logo,
            status: apiStatus,
            custom_status: customStatus,
            home_score: item.goals.home ?? 0,
            away_score: item.goals.away ?? 0,
            kickoff_time: item.fixture.date,
            date: item.fixture.date.split('T')[0],
            last_updated: now.toISOString(),
            raw_data: item,
          };

          // Stamp finished_at on first transition to final status
          if (FINAL_STATUSES.includes(apiStatus) && !existingMatch?.finished_at) {
            updatePayload.finished_at = now.toISOString();
          }

          // Anti-overwrite: never replace existing events with an empty array
          if (eventsData !== null && eventsData.length > 0) updatePayload.events = eventsData;
          if (lineupsData !== null) updatePayload.lineups = lineupsData;
          // Anti-overwrite: only write stats if the API actually returned data
          if (statsData !== null) updatePayload.statistics = statsData;

          updates.push(updatePayload);
          counters.processedMatches++;

        } catch (matchError) {
          console.error(`[${pulseLabel}] [ERROR] Match ${matchId}:`, matchError);
        }
      }

      // ── 5. UPSERT TO DATABASE ─────────────────────
      if (updates.length > 0) {
        const { error } = await supabase
          .from('matches')
          .upsert(updates, { onConflict: 'id' });

        if (!error) {
          counters.syncedToDb += updates.length;
        } else {
          const errMsg = `[${date}] ${error.message} (code: ${error.code}, details: ${error.details})`;
          console.error(`[${pulseLabel}] [DB ERROR] ${errMsg}`);
          counters.dbErrors.push(errMsg);
        }
      }

    } catch (err) {
      console.error(`[${pulseLabel}] [ERROR] Sync error for date ${date}:`, err);
    }
  }

  console.log(
    `[${pulseLabel}] Done — processed=${counters.processedMatches} ` +
    `skipped=${counters.skippedMatches} fixture_api=${counters.fixtureApiCalls} ` +
    `lineup_api=${counters.lineupApiCalls} event_api=${counters.eventApiCalls} ` +
    `stats_api=${counters.statsApiCalls}`
  );

  return counters;
}

// ────────────────────────────────────────────────────
// HANDLER — Single-Shot (no double pulse)
// ────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const apiKey = Deno.env.get('SPORTS_API_KEY')?.trim() ?? '';
  const isFullSync = req.url.includes('full_sync=true');

  console.log(`[SYNC] ══════ Invocation start — mode=${isFullSync ? 'SCHEDULER' : 'SNIPER'} ══════`);

  const result = await sync(supabase, apiKey, isFullSync, 'SYNC');

  console.log(
    `[SYNC] ══════ Complete — ${result.syncedToDb} matches synced ══════\n` +
    `  API calls → fixtures=${result.fixtureApiCalls} lineups=${result.lineupApiCalls} events=${result.eventApiCalls} stats=${result.statsApiCalls}\n` +
    `  processed=${result.processedMatches} skipped=${result.skippedMatches}`
  );

  return new Response(JSON.stringify({
    success: result.dbErrors.length === 0,
    mode: isFullSync ? 'SCHEDULER' : 'SNIPER',
    message: `Sync complete. ${result.syncedToDb} matches synced.`,
    apiCalls: {
      fixtures: result.fixtureApiCalls,
      lineups: result.lineupApiCalls,
      events: result.eventApiCalls,
      stats: result.statsApiCalls,
    },
    processed: result.processedMatches,
    skipped: result.skippedMatches,
    synced: result.syncedToDb,
    dbErrors: result.dbErrors,
  }), {
    status: result.dbErrors.length === 0 ? 200 : 207,
    headers: { 'Content-Type': 'application/json' },
  });
});