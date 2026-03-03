import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ────────────────────────────────────────────────────
// CONFIGURATION
// ────────────────────────────────────────────────────
const SUPPORTED_LEAGUE_IDS = [39, 40, 71, 78, 135, 94];
const LIVE_LEAGUES_PARAM = SUPPORTED_LEAGUE_IDS.join('-');
const BATCH_SIZE = 20;

const LIVE_STATUSES  = ['1H', 'HT', '2H', 'ET', 'P'];
const FINAL_STATUSES = ['FT', 'AET', 'PEN'];
const PRE_LIVE_WINDOW = 60 * 60_000; // 60 minutes before kickoff
const ZOMBIE_THRESHOLD = 10 * 60_000; // 10 minutes without update

// ────────────────────────────────────────────────────
// STATUS DERIVATION
// ────────────────────────────────────────────────────
type CustomStatus = 'UPCOMING' | 'PRE-LIVE' | 'LIVE' | 'COMPLETED';

function deriveCustomStatus(
  apiStatus: string,
  kickoffTime: Date,
  now: Date
): CustomStatus {
  if (LIVE_STATUSES.includes(apiStatus)) return 'LIVE';
  if (FINAL_STATUSES.includes(apiStatus)) return 'COMPLETED';
  const msUntilKickoff = kickoffTime.getTime() - now.getTime();
  if (msUntilKickoff <= PRE_LIVE_WINDOW && msUntilKickoff > 0) return 'PRE-LIVE';
  return 'UPCOMING';
}

// ────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Build an upsert payload from a raw API fixture object.
 * The /fixtures endpoint returns everything: score, events, lineups, statistics.
 */
function buildPayload(item: any, now: Date, existingFinishedAt: string | null): any {
  const apiStatus = item.fixture.status.short;
  const kickoffTime = new Date(item.fixture.date);
  const customStatus = deriveCustomStatus(apiStatus, kickoffTime, now);

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

  // Events
  if (item.events && Array.isArray(item.events) && item.events.length > 0) {
    payload.events = item.events;
  }

  // Lineups
  if (item.lineups && Array.isArray(item.lineups) && item.lineups.length > 0) {
    payload.lineups = item.lineups;
  }

  // Statistics
  if (item.statistics && Array.isArray(item.statistics) && item.statistics.length >= 2) {
    payload.statistics = {
      home: item.statistics[0],
      away: item.statistics[1],
    };
  }

  return payload;
}

// ────────────────────────────────────────────────────
// SYNC — Strict Pulse & Prep (2 mechanisms only)
// ────────────────────────────────────────────────────
interface SyncCounters {
  pulseApiCalls: number;
  prepApiCalls: number;
  processedMatches: number;
  syncedToDb: number;
  dbErrors: string[];
}

async function sync(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  pulseLabel: string
): Promise<SyncCounters> {
  const counters: SyncCounters = {
    pulseApiCalls: 0,
    prepApiCalls: 0,
    processedMatches: 0,
    syncedToDb: 0,
    dbErrors: [],
  };

  const now = new Date();
  const currentMinute = now.getMinutes();

  console.log(`[${pulseLabel}] Sync started at ${now.toISOString()}`);

  // ══════════════════════════════════════════════════
  // MECHANISM A: THE PULSE — Live Scores (every minute)
  // Single API call covers scores, events, lineups, stats for all live games.
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
      // Look up existing DB state for finished_at checks
      const liveIds = liveFixtures.map((item: any) => item.fixture.id);
      const { data: existingLive } = await supabase
        .from('matches')
        .select('id, finished_at')
        .in('id', liveIds);
      const existingMap = new Map((existingLive || []).map((m: any) => [m.id, m.finished_at]));

      const pulseUpdates: any[] = [];
      for (const item of liveFixtures) {
        const payload = buildPayload(item, now, existingMap.get(item.fixture.id) || null);
        pulseUpdates.push(payload);
        counters.processedMatches++;
      }

      const { error } = await supabase
        .from('matches')
        .upsert(pulseUpdates, { onConflict: 'id' });

      if (!error) {
        counters.syncedToDb += pulseUpdates.length;
        console.log(`[${pulseLabel}] [PULSE] Upserted ${pulseUpdates.length} live matches`);
      } else {
        const errMsg = `[PULSE] ${error.message} (code: ${error.code})`;
        console.error(`[${pulseLabel}] [DB ERROR] ${errMsg}`);
        counters.dbErrors.push(errMsg);
      }
    }
  } catch (pulseErr) {
    console.error(`[${pulseLabel}] [PULSE ERROR]`, pulseErr);
  }

  // ══════════════════════════════════════════════════
  // MECHANISM B: THE PREP & CLEANUP (every 10 minutes)
  // Target 1: PRE-LIVE matches (kickoff within 60 min) → fetch lineups
  // Target 2: Zombie LIVE matches (no update in 10 min) → catch final whistle
  // ══════════════════════════════════════════════════
  if (currentMinute % 10 === 0) {
    try {
      const prepCutoff = new Date(now.getTime() + PRE_LIVE_WINDOW).toISOString();
      const zombieCutoff = new Date(now.getTime() - ZOMBIE_THRESHOLD).toISOString();

      // Target 1: PRE-LIVE matches
      const { data: preLiveMatches, error: preLiveErr } = await supabase
        .from('matches')
        .select('id, finished_at')
        .eq('custom_status', 'PRE-LIVE')
        .gte('kickoff_time', now.toISOString())
        .lte('kickoff_time', prepCutoff);

      if (preLiveErr) console.error(`[${pulseLabel}] [PREP] Pre-live query error:`, preLiveErr);

      // Target 2: Zombie LIVE matches (stale for > 10 min)
      const { data: zombieMatches, error: zombieErr } = await supabase
        .from('matches')
        .select('id, finished_at')
        .eq('custom_status', 'LIVE')
        .lt('last_updated', zombieCutoff);

      if (zombieErr) console.error(`[${pulseLabel}] [PREP] Zombie query error:`, zombieErr);

      // Combine unique IDs
      const allTargets = [...(preLiveMatches || []), ...(zombieMatches || [])];
      const idSet = new Map(allTargets.map((m: any) => [m.id, m.finished_at]));
      const allIds = Array.from(idSet.keys());

      const preLiveCount = preLiveMatches?.length || 0;
      const zombieCount = zombieMatches?.length || 0;
      console.log(`[${pulseLabel}] [PREP] Targets: ${preLiveCount} pre-live + ${zombieCount} zombies = ${allIds.length} total`);

      if (allIds.length > 0) {
        const idChunks = chunk(allIds, BATCH_SIZE);

        for (const idChunk of idChunks) {
          try {
            counters.prepApiCalls++;
            const prepRes = await fetch(
              `https://v3.football.api-sports.io/fixtures?ids=${idChunk.join('-')}`,
              { headers: { 'x-apisports-key': apiKey, 'Content-Type': 'application/json' } }
            );
            const prepJson = await prepRes.json();
            const prepFixtures = prepJson.response || [];

            console.log(`[${pulseLabel}] [PREP] Chunk (${idChunk.length} IDs): got ${prepFixtures.length} fixtures`);

            const prepUpdates: any[] = [];
            for (const item of prepFixtures) {
              const payload = buildPayload(item, now, idSet.get(item.fixture.id) || null);
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
                const errMsg = `[PREP] ${error.message} (code: ${error.code})`;
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
    console.log(`[${pulseLabel}] [PREP] Skipped (minute=${currentMinute})`);
  }

  console.log(
    `[${pulseLabel}] Done — processed=${counters.processedMatches} ` +
    `pulse_api=${counters.pulseApiCalls} prep_api=${counters.prepApiCalls} ` +
    `synced=${counters.syncedToDb}`
  );

  return counters;
}

// ────────────────────────────────────────────────────
// HANDLER
// ────────────────────────────────────────────────────
Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const apiKey = Deno.env.get('SPORTS_API_KEY')?.trim() ?? '';

  console.log(`[SYNC] ══════ Invocation start — PULSE & PREP ══════`);

  const result = await sync(supabase, apiKey, 'SYNC');

  console.log(
    `[SYNC] ══════ Complete — ${result.syncedToDb} matches synced ══════\n` +
    `  API calls → pulse=${result.pulseApiCalls} prep=${result.prepApiCalls}\n` +
    `  processed=${result.processedMatches}`
  );

  return new Response(JSON.stringify({
    success: result.dbErrors.length === 0,
    mode: 'PULSE&PREP',
    message: `Sync complete. ${result.syncedToDb} matches synced.`,
    apiCalls: {
      pulse: result.pulseApiCalls,
      prep: result.prepApiCalls,
    },
    processed: result.processedMatches,
    synced: result.syncedToDb,
    dbErrors: result.dbErrors,
  }), {
    status: result.dbErrors.length === 0 ? 200 : 207,
    headers: { 'Content-Type': 'application/json' },
  });
});