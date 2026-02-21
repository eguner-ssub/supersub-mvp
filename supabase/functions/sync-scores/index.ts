import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * LEAGUE COVERAGE — Central source of truth for league IDs.
 */
const SUPPORTED_LEAGUE_IDS = [1, 2, 3, 39, 40, 41, 42, 45, 48, 61, 71, 78, 79, 88, 94, 135, 140, 144, 179, 180, 203, 253, 262, 301];

/**
 * STATUS GROUPS
 */
const LIVE_STATUSES  = ['1H', 'HT', '2H', 'ET', 'P'];
const FINAL_STATUSES = ['FT', 'AET', 'PEN'];

/**
 * FREQUENCY GATES (milliseconds)
 */
const LINEUP_STALE_MS     = 5 * 60_000;   // 5 minutes
const POST_MATCH_STALE_MS = 3 * 60_000;   // 3 minutes
const POST_MATCH_WINDOW   = 60 * 60_000;  // 60 minutes after finished_at
const PRE_LIVE_WINDOW     = 60 * 60_000;  // 60 minutes before kickoff

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
// ────────────────────────────────────────────────────
type CustomStatus = 'UPCOMING' | 'PRE-LIVE' | 'LIVE' | 'POST-MATCH' | 'COMPLETED';

function deriveCustomStatus(
  apiStatus: string,
  kickoffTime: Date,
  finishedAt: Date | null,
  now: Date
): CustomStatus {
  // 1. LIVE — API says match is actively playing
  if (LIVE_STATUSES.includes(apiStatus)) return 'LIVE';

  // 2. FINISHED states — split into POST-MATCH vs COMPLETED
  if (FINAL_STATUSES.includes(apiStatus)) {
    if (finishedAt) {
      const msSinceFinished = now.getTime() - finishedAt.getTime();
      return msSinceFinished < POST_MATCH_WINDOW ? 'POST-MATCH' : 'COMPLETED';
    }
    // Just finished, no finished_at stamp yet → treat as POST-MATCH
    return 'POST-MATCH';
  }

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
  };

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentHour = now.getUTCHours();

  console.log(`[${pulseLabel}] Sync started at ${now.toISOString()}`);

  // ── 1. DETERMINE DATES TO FETCH ──────────────────
  const datesToSync: string[] = [todayStr];

  if (isFullSync && currentHour >= 0 && currentHour < 3) {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60_000)
      .toISOString()
      .split('T')[0];
    datesToSync.unshift(yesterday);
    console.log(`[${pulseLabel}] Full-sync: including yesterday (${yesterday}) — hour=${currentHour}`);
  }

  // ── 2. PRE-FLIGHT: Get existing DB state ─────────
  // Sniper mode: only fetch matches that are active (not UPCOMING/COMPLETED)
  // Full-sync: fetch everything (the Scheduler path)
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
    const { data: activeMatches } = await supabase
      .from('matches')
      .select('id, status, custom_status, lineups, events, last_updated, finished_at')
      .not('custom_status', 'in', '("COMPLETED","UPCOMING")');

    if (activeMatches) {
      existingMatchMap = new Map(activeMatches.map((m: any) => [m.id, m]));
    }

    // If no active matches in DB, nothing to snipe
    if (existingMatchMap.size === 0) {
      console.log(`[${pulseLabel}] No active matches in DB — nothing to snipe.`);
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

        // ── SNIPER GATE: Skip UPCOMING / COMPLETED unless full_sync ──
        if (!isFullSync && (customStatus === 'UPCOMING' || customStatus === 'COMPLETED')) {
          counters.skippedMatches++;
          console.log(`[${pulseLabel}] [SKIP] Match ${matchId}: ${customStatus}`);
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

          // ── A. LIVE — fetch events every pulse ──────
          if (customStatus === 'LIVE') {
            counters.eventApiCalls++;
            const eventRes = await fetch(
              `https://v3.football.api-sports.io/fixtures/events?fixture=${matchId}`,
              { headers: { 'x-apisports-key': apiKey } }
            );
            const eventJson = await eventRes.json();
            eventsData = eventJson.response || [];
            console.log(`[${pulseLabel}] [EVENTS] Fetching live events for Match ${matchId} (LIVE — ${apiStatus}, got ${eventsData.length} events)`);
          }

          // ── B. PRE-LIVE — fetch lineups if empty & stale ──
          if (customStatus === 'PRE-LIVE' && !hasLineups && msSinceUpdate > LINEUP_STALE_MS) {
            counters.lineupApiCalls++;
            const lineupRes = await fetch(
              `https://v3.football.api-sports.io/fixtures/lineups?fixture=${matchId}`,
              { headers: { 'x-apisports-key': apiKey } }
            );
            const lineupJson = await lineupRes.json();
            lineupsData = lineupJson.response || [];
            console.log(`[${pulseLabel}] [LINEUP] Match ${matchId} (PRE-LIVE — no lineups, ${Math.round(msSinceUpdate / 60_000)}m stale)`);
          } else if (customStatus === 'PRE-LIVE' && !hasLineups) {
            console.log(`[${pulseLabel}] [SKIP] Lineups for Match ${matchId}: PRE-LIVE but checked ${Math.round(msSinceUpdate / 60_000)}m ago (gate: 5m)`);
          }

          // ── C. POST-MATCH — fetch fixture+events every 3 min ──
          if (customStatus === 'POST-MATCH') {
            if (msSinceUpdate > POST_MATCH_STALE_MS) {
              // Fetch events
              counters.eventApiCalls++;
              const eventRes = await fetch(
                `https://v3.football.api-sports.io/fixtures/events?fixture=${matchId}`,
                { headers: { 'x-apisports-key': apiKey } }
              );
              const eventJson = await eventRes.json();
              eventsData = eventJson.response || [];
              console.log(`[${pulseLabel}] [EVENTS] Fetching post-match events for Match ${matchId} (POST-MATCH — ${Math.round(msSinceUpdate / 60_000)}m since last update, got ${eventsData.length} events)`);
            } else {
              console.log(`[${pulseLabel}] [SKIP] Match ${matchId}: POST-MATCH, last updated ${Math.round(msSinceUpdate / 60_000)}m ago (gate: 3m)`);
            }
          }

          // ── D. STATISTICS — LIVE every pulse, POST-MATCH every 3 min ──
          if (customStatus === 'LIVE' || (customStatus === 'POST-MATCH' && msSinceUpdate > POST_MATCH_STALE_MS)) {
            try {
              counters.statsApiCalls++;
              const statsRes = await fetch(
                `https://v3.football.api-sports.io/fixtures/statistics?fixture=${matchId}`,
                { headers: { 'x-apisports-key': apiKey } }
              );
              const statsJson = await statsRes.json();
              const rawStats = statsJson.response || [];

              if (rawStats.length >= 2) {
                // Transform: extract allowed keys into { home, away } shape
                const extractKeys = (teamStats: any[]) => {
                  const out: Record<string, any> = {};
                  for (const s of teamStats) {
                    if (STATS_KEYS.includes(s.type)) {
                      out[s.type] = s.value;
                    }
                  }
                  return out;
                };

                statsData = {
                  home: extractKeys(rawStats[0].statistics || []),
                  away: extractKeys(rawStats[1].statistics || []),
                };
                console.log(`[${pulseLabel}] [STATS] Match ${matchId} (${customStatus}): fetched ${Object.keys(statsData.home).length} stat keys`);
              } else {
                console.log(`[${pulseLabel}] [STATS] Match ${matchId}: API returned empty statistics`);
              }
            } catch (statsErr) {
              console.error(`[${pulseLabel}] [STATS ERROR] Match ${matchId}:`, statsErr);
              // Non-blocking: continue with the rest of the sync
            }
          }

          // ── E. Full-sync path: always fetch for UPCOMING/COMPLETED too ──
          // (fixture data is already in `item`, no extra API call needed)

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
          console.error(`[${pulseLabel}] [DB ERROR] Upsert failed for ${date}:`, error.message);
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
// HANDLER — Double-Pulse Wrapper
// ────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const apiKey = Deno.env.get('SPORTS_API_KEY')?.trim() ?? '';
  const isFullSync = req.url.includes('full_sync=true');

  console.log(`[SYNC] ══════ Invocation start — mode=${isFullSync ? 'SCHEDULER' : 'SNIPER'} ══════`);

  // ── PULSE 1 ──────────────────────────────────────
  const pulse1 = await sync(supabase, apiKey, isFullSync, 'PULSE 1/2');

  // ── 30-second delay ──────────────────────────────
  console.log('[SYNC] Waiting 30s before second pulse…');
  await new Promise(res => setTimeout(res, 30_000));

  // ── PULSE 2 ──────────────────────────────────────
  const pulse2 = await sync(supabase, apiKey, isFullSync, 'PULSE 2/2');

  // ── AGGREGATE COUNTERS ───────────────────────────
  const totals = {
    fixtures: pulse1.fixtureApiCalls + pulse2.fixtureApiCalls,
    lineups:  pulse1.lineupApiCalls  + pulse2.lineupApiCalls,
    events:   pulse1.eventApiCalls   + pulse2.eventApiCalls,
    stats:    pulse1.statsApiCalls   + pulse2.statsApiCalls,
    processed: pulse1.processedMatches + pulse2.processedMatches,
    skipped:  pulse1.skippedMatches  + pulse2.skippedMatches,
    synced:   pulse1.syncedToDb      + pulse2.syncedToDb,
  };

  console.log(
    `[SYNC] ══════ Complete — ${totals.synced} matches synced across 2 pulses ══════\n` +
    `  API calls → fixtures=${totals.fixtures} lineups=${totals.lineups} events=${totals.events} stats=${totals.stats}\n` +
    `  processed=${totals.processed} skipped=${totals.skipped}`
  );

  return new Response(JSON.stringify({
    success: true,
    mode: isFullSync ? 'SCHEDULER' : 'SNIPER',
    message: `Sync complete. ${totals.synced} matches synced across 2 pulses.`,
    apiCalls: {
      fixtures: totals.fixtures,
      lineups: totals.lineups,
      events: totals.events,
      stats: totals.stats,
    },
    processed: totals.processed,
    skipped: totals.skipped,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});