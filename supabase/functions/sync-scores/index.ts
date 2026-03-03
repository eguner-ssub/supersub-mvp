import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * LEAGUE COVERAGE — Central source of truth for league IDs.
 */
const SUPPORTED_LEAGUE_IDS = [39, 40, 71, 78, 135, 94];

/** Pre-joined league IDs for the /fixtures?live= endpoint */
const LIVE_LEAGUES_PARAM = SUPPORTED_LEAGUE_IDS.join('-');

/** Max fixture IDs per API call in Prep batches */
const BATCH_SIZE = 20;

/**
 * STATUS GROUPS
 */
const LIVE_STATUSES  = ['1H', 'HT', '2H', 'ET', 'P'];
const FINAL_STATUSES = ['FT', 'AET', 'PEN'];

/**
 * FREQUENCY GATES (milliseconds)
 */
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
// HELPERS
// ────────────────────────────────────────────────────

/** Split an array into chunks of at most `size` elements */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/** Extract our curated stats keys from the raw API response */
function extractStats(rawStats: any[]): { home: Record<string, any>; away: Record<string, any> } | null {
  if (rawStats.length < 2) return null;
  const extractKeys = (teamStats: any[]) => {
    const out: Record<string, any> = {};
    for (const s of teamStats) {
      if (STATS_KEYS.includes(s.type)) out[s.type] = s.value;
    }
    return out;
  };
  return {
    home: extractKeys(rawStats[0].statistics || []),
    away: extractKeys(rawStats[1].statistics || []),
  };
}

/** Build a standard update payload from an API fixture item */
function buildPayload(item: any, customStatus: CustomStatus, now: Date, existingFinishedAt: string | null): any {
  const apiStatus = item.fixture.status.short;
  const payload: any = {
    id: item.fixture.id,
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
  if (FINAL_STATUSES.includes(apiStatus) && !existingFinishedAt) {
    payload.finished_at = now.toISOString();
  }

  // Include events if present in fixture response
  if (item.events && Array.isArray(item.events) && item.events.length > 0) {
    payload.events = item.events;
  }

  // Include lineups if present in fixture response
  if (item.lineups && Array.isArray(item.lineups) && item.lineups.length > 0) {
    payload.lineups = item.lineups;
  }

  // Include statistics if present
  if (item.statistics && Array.isArray(item.statistics)) {
    const stats = extractStats(item.statistics);
    if (stats) payload.statistics = stats;
  }

  return payload;
}

// ────────────────────────────────────────────────────
// SYNC — Pulse & Prep Architecture
// ────────────────────────────────────────────────────
interface SyncCounters {
  pulseApiCalls: number;
  prepApiCalls: number;
  fullSyncApiCalls: number;
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
    pulseApiCalls: 0,
    prepApiCalls: 0,
    fullSyncApiCalls: 0,
    processedMatches: 0,
    syncedToDb: 0,
    dbErrors: [],
  };

  const now = new Date();
  const currentMinute = now.getMinutes();

  console.log(`[${pulseLabel}] Sync started at ${now.toISOString()}`);

  // ══════════════════════════════════════════════════
  // MECHANISM A: THE PULSE — Live Scores (every invocation)
  // One single API call fetches all live matches across our leagues.
  // ══════════════════════════════════════════════════
  try {
    counters.pulseApiCalls++;
    const liveRes = await fetch(
      `https://v3.football.api-sports.io/fixtures?live=${LIVE_LEAGUES_PARAM}`,
      { headers: { 'x-apisports-key': apiKey, 'Content-Type': 'application/json' } }
    );
    const liveJson = await liveRes.json();
    const liveFixtures = liveJson.response || [];

    console.log(`[${pulseLabel}] [PULSE] Fetched ${liveFixtures.length} live fixtures`);

    if (liveFixtures.length > 0) {
      // Look up existing DB state for these fixtures to detect first-COMPLETED transitions
      const liveIds = liveFixtures.map((item: any) => item.fixture.id);
      const { data: existingLive } = await supabase
        .from('matches')
        .select('id, finished_at')
        .in('id', liveIds);
      const existingMap = new Map((existingLive || []).map((m: any) => [m.id, m]));

      const pulseUpdates: any[] = [];
      for (const item of liveFixtures) {
        const matchId = item.fixture.id;
        const apiStatus = item.fixture.status.short;
        const kickoffTime = new Date(item.fixture.date);
        const existing = existingMap.get(matchId);

        const customStatus = deriveCustomStatus(
          apiStatus, kickoffTime, existing?.finished_at ? new Date(existing.finished_at) : null, now
        );

        const payload = buildPayload(item, customStatus, now, existing?.finished_at || null);
        pulseUpdates.push(payload);
        counters.processedMatches++;
      }

      // Upsert all live matches in one batch
      if (pulseUpdates.length > 0) {
        const { error } = await supabase
          .from('matches')
          .upsert(pulseUpdates, { onConflict: 'id' });

        if (!error) {
          counters.syncedToDb += pulseUpdates.length;
          console.log(`[${pulseLabel}] [PULSE] Upserted ${pulseUpdates.length} live matches`);
        } else {
          const errMsg = `[PULSE] ${error.message} (code: ${error.code}, details: ${error.details})`;
          console.error(`[${pulseLabel}] [DB ERROR] ${errMsg}`);
          counters.dbErrors.push(errMsg);
        }
      }
    }
  } catch (pulseErr) {
    console.error(`[${pulseLabel}] [PULSE ERROR]`, pulseErr);
  }

  // ══════════════════════════════════════════════════
  // MECHANISM B: THE PREP — Pre-Match Batching (every 10 min)
  // Fetches upcoming match details (lineups, formations) by ID batches.
  // ══════════════════════════════════════════════════
  if (currentMinute % 10 === 0 || isFullSync) {
    try {
      const prepCutoff = new Date(now.getTime() + PRE_LIVE_WINDOW).toISOString();

      // Query for "pre-live" matches: not COMPLETED or LIVE, kickoff within the next 60 minutes
      const { data: preLiveMatches, error: queryErr } = await supabase
        .from('matches')
        .select('id, finished_at')
        .not('custom_status', 'in', '("COMPLETED","LIVE")')
        .gte('kickoff_time', now.toISOString())
        .lte('kickoff_time', prepCutoff);

      if (queryErr) {
        console.error(`[${pulseLabel}] [PREP] Query error:`, queryErr);
      }

      const preLiveIds = (preLiveMatches || []).map((m: any) => m.id);
      console.log(`[${pulseLabel}] [PREP] Found ${preLiveIds.length} pre-live matches to prep`);

      if (preLiveIds.length > 0) {
        const existingFinishedMap = new Map(
          (preLiveMatches || []).map((m: any) => [m.id, m.finished_at])
        );

        const idChunks = chunk(preLiveIds, BATCH_SIZE);

        for (const idChunk of idChunks) {
          try {
            counters.prepApiCalls++;
            const idsParam = idChunk.join('-');
            const prepRes = await fetch(
              `https://v3.football.api-sports.io/fixtures?ids=${idsParam}`,
              { headers: { 'x-apisports-key': apiKey, 'Content-Type': 'application/json' } }
            );
            const prepJson = await prepRes.json();
            const prepFixtures = prepJson.response || [];

            console.log(`[${pulseLabel}] [PREP] Chunk (${idChunk.length} IDs): got ${prepFixtures.length} fixtures`);

            const prepUpdates: any[] = [];
            for (const item of prepFixtures) {
              const apiStatus = item.fixture.status.short;
              const kickoffTime = new Date(item.fixture.date);
              const existingFinishedAt = existingFinishedMap.get(item.fixture.id) || null;

              const customStatus = deriveCustomStatus(
                apiStatus, kickoffTime, existingFinishedAt ? new Date(existingFinishedAt) : null, now
              );

              const payload = buildPayload(item, customStatus, now, existingFinishedAt);
              prepUpdates.push(payload);
              counters.processedMatches++;
            }

            if (prepUpdates.length > 0) {
              const { error } = await supabase
                .from('matches')
                .upsert(prepUpdates, { onConflict: 'id' });

              if (!error) {
                counters.syncedToDb += prepUpdates.length;
              } else {
                const errMsg = `[PREP] ${error.message} (code: ${error.code}, details: ${error.details})`;
                console.error(`[${pulseLabel}] [DB ERROR] ${errMsg}`);
                counters.dbErrors.push(errMsg);
              }
            }
          } catch (chunkErr) {
            console.error(`[${pulseLabel}] [PREP ERROR] Chunk failed:`, chunkErr);
          }
        }
      }
    } catch (prepErr) {
      console.error(`[${pulseLabel}] [PREP ERROR]`, prepErr);
    }
  } else {
    console.log(`[${pulseLabel}] [PREP] Skipped (minute=${currentMinute}, not a 10-min boundary)`);
  }

  // ══════════════════════════════════════════════════
  // SAFETY NET: Full Sync (midnight scheduler only)
  // Fetches yesterday through +7 days by date to catch anything missed.
  // ══════════════════════════════════════════════════
  if (isFullSync) {
    console.log(`[${pulseLabel}] [FULL-SYNC] Running date-range safety net...`);

    const datesToSync: string[] = [];
    for (let i = -1; i <= 7; i++) {
      const d = new Date(now.getTime() + i * 24 * 60 * 60_000).toISOString().split('T')[0];
      datesToSync.push(d);
    }

    console.log(`[${pulseLabel}] [FULL-SYNC] Syncing ${datesToSync.length} days [${datesToSync[0]} → ${datesToSync[datesToSync.length - 1]}]`);

    for (const date of datesToSync) {
      try {
        counters.fullSyncApiCalls++;
        const response = await fetch(
          `https://v3.football.api-sports.io/fixtures?date=${date}`,
          { headers: { 'x-apisports-key': apiKey, 'Content-Type': 'application/json' } }
        );
        const result = await response.json();

        if (!result.response) {
          console.log(`[${pulseLabel}] [FULL-SYNC] No API response for date ${date}`);
          continue;
        }

        // Filter to supported leagues
        const filteredMatches = result.response.filter(
          (item: any) => SUPPORTED_LEAGUE_IDS.includes(item.league.id)
        );

        if (filteredMatches.length === 0) {
          console.log(`[${pulseLabel}] [FULL-SYNC] No supported-league matches for ${date}`);
          continue;
        }

        console.log(`[${pulseLabel}] [FULL-SYNC] ${date}: ${filteredMatches.length} matches in supported leagues`);

        // Bulk-fetch existing DB state for finished_at checks
        const matchIds = filteredMatches.map((item: any) => item.fixture.id);
        const { data: existingMatches } = await supabase
          .from('matches')
          .select('id, finished_at')
          .in('id', matchIds);

        const existingMap = new Map((existingMatches || []).map((m: any) => [m.id, m]));

        const updates: any[] = [];
        for (const item of filteredMatches) {
          const apiStatus = item.fixture.status.short;
          const kickoffTime = new Date(item.fixture.date);
          const existing = existingMap.get(item.fixture.id);
          const existingFinishedAt = existing?.finished_at || null;

          const customStatus = deriveCustomStatus(
            apiStatus, kickoffTime, existingFinishedAt ? new Date(existingFinishedAt) : null, now
          );

          const payload = buildPayload(item, customStatus, now, existingFinishedAt);
          updates.push(payload);
          counters.processedMatches++;
        }

        if (updates.length > 0) {
          const { error } = await supabase
            .from('matches')
            .upsert(updates, { onConflict: 'id' });

          if (!error) {
            counters.syncedToDb += updates.length;
          } else {
            const errMsg = `[FULL-SYNC][${date}] ${error.message} (code: ${error.code}, details: ${error.details})`;
            console.error(`[${pulseLabel}] [DB ERROR] ${errMsg}`);
            counters.dbErrors.push(errMsg);
          }
        }
      } catch (err) {
        console.error(`[${pulseLabel}] [FULL-SYNC ERROR] Date ${date}:`, err);
      }
    }
  }

  console.log(
    `[${pulseLabel}] Done — processed=${counters.processedMatches} ` +
    `pulse_api=${counters.pulseApiCalls} prep_api=${counters.prepApiCalls} ` +
    `fullsync_api=${counters.fullSyncApiCalls} synced=${counters.syncedToDb}`
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

  console.log(`[SYNC] ══════ Invocation start — mode=${isFullSync ? 'SCHEDULER' : 'PULSE&PREP'} ══════`);

  const result = await sync(supabase, apiKey, isFullSync, 'SYNC');

  console.log(
    `[SYNC] ══════ Complete — ${result.syncedToDb} matches synced ══════\n` +
    `  API calls → pulse=${result.pulseApiCalls} prep=${result.prepApiCalls} fullSync=${result.fullSyncApiCalls}\n` +
    `  processed=${result.processedMatches}`
  );

  return new Response(JSON.stringify({
    success: result.dbErrors.length === 0,
    mode: isFullSync ? 'SCHEDULER' : 'PULSE&PREP',
    message: `Sync complete. ${result.syncedToDb} matches synced.`,
    apiCalls: {
      pulse: result.pulseApiCalls,
      prep: result.prepApiCalls,
      fullSync: result.fullSyncApiCalls,
    },
    processed: result.processedMatches,
    synced: result.syncedToDb,
    dbErrors: result.dbErrors,
  }), {
    status: result.dbErrors.length === 0 ? 200 : 207,
    headers: { 'Content-Type': 'application/json' },
  });
});