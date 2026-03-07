import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ────────────────────────────────────────────────────
// CONFIGURATION
// ────────────────────────────────────────────────────
const SUPPORTED_LEAGUE_IDS = [39, 40, 71, 78, 135, 94];
const FINAL_STATUSES = ['FT', 'AET', 'PEN'];
const LIVE_STATUSES  = ['1H', 'HT', '2H', 'ET', 'P'];
const PRE_LIVE_WINDOW_MS = 60 * 60_000; // 60 minutes before kickoff
const COMPLETED_COOLDOWN_MS = 2 * 60 * 60_000; // 2 hours — re-sync ceiling for finished matches

const API_BASE = 'https://v3.football.api-sports.io';

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
  if (msUntilKickoff <= PRE_LIVE_WINDOW_MS && msUntilKickoff > 0) return 'PRE-LIVE';
  return 'UPCOMING';
}

// ────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────
function apiHeaders(apiKey: string): Record<string, string> {
  return { 'x-apisports-key': apiKey, 'Content-Type': 'application/json' };
}

function todayStr(now: Date): string {
  return now.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Build a full upsert payload from a raw API fixture object.
 * The /fixtures endpoint returns everything: score, events, lineups, statistics.
 */
function buildPayload(item: any, now: Date, existingFinishedAt: string | null, isPreLive: boolean): any {
  const apiStatus = item.fixture.status.short;
  const kickoffTime = new Date(item.fixture.date);
  const customStatus = deriveCustomStatus(apiStatus, kickoffTime, now);

  const payload: any = {
    id: item.fixture.id,
    league_id: item.league.id,
    season: item.league.season,
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
    last_synced_at: now.toISOString(),
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

  // Lineups — only during pre-live window
  if (isPreLive && item.lineups && Array.isArray(item.lineups) && item.lineups.length > 0) {
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
// SERVICE 1: FIXTURES (THE PLANNER)
// ────────────────────────────────────────────────────
interface PlannerResult {
  apiCalls: number;
  upserted: number;
  errors: string[];
}

async function fixturesService(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  now: Date
): Promise<PlannerResult> {
  const result: PlannerResult = { apiCalls: 0, upserted: 0, errors: [] };
  const hour = now.getUTCHours();
  const today = todayStr(now);

  let url: string;
  if (hour < 12) {
    // Midnight run — today only
    url = `${API_BASE}/fixtures?date=${today}`;
    console.log(`[PLANNER] Midnight run — fetching fixtures for ${today}`);
  } else {
    // Midday run — 14-day lookahead
    const futureDate = todayStr(addDays(now, 14));
    url = `${API_BASE}/fixtures?from=${today}&to=${futureDate}`;
    console.log(`[PLANNER] Midday run — fetching fixtures from ${today} to ${futureDate}`);
  }

  try {
    result.apiCalls++;
    const res = await fetch(url, { headers: apiHeaders(apiKey) });
    const json = await res.json();
    const fixtures = (json.response || []) as any[];

    // Filter by supported leagues
    const supported = fixtures.filter((f: any) => SUPPORTED_LEAGUE_IDS.includes(f.league.id));
    console.log(`[PLANNER] API returned ${fixtures.length} fixtures, ${supported.length} in supported leagues`);

    if (supported.length === 0) {
      console.log('[PLANNER] No supported fixtures found — nothing to upsert');
      return result;
    }

    // Build slim upsert payloads (no events/stats/lineups — just planner data)
    const payloads = supported.map((item: any) => ({
      id: item.fixture.id,
      date: item.fixture.date.split('T')[0],
      kickoff_time: item.fixture.date,
      league_id: item.league.id,
      league_name: item.league.name,
      league_logo: item.league.logo,
      season: item.league.season,
      status: item.fixture.status.short,
      custom_status: deriveCustomStatus(
        item.fixture.status.short,
        new Date(item.fixture.date),
        now
      ),
      home_team: item.teams.home.name,
      away_team: item.teams.away.name,
      home_logo: item.teams.home.logo,
      away_logo: item.teams.away.logo,
      home_score: item.goals.home ?? 0,
      away_score: item.goals.away ?? 0,
      last_updated: now.toISOString(),
    }));

    const { error } = await supabase
      .from('matches')
      .upsert(payloads, { onConflict: 'id' });

    if (error) {
      const msg = `[PLANNER] DB upsert error: ${error.message} (code: ${error.code})`;
      console.error(msg);
      result.errors.push(msg);
    } else {
      result.upserted = payloads.length;
      console.log(`[PLANNER] Upserted ${payloads.length} fixtures`);
    }
  } catch (err) {
    const msg = `[PLANNER] Fetch error: ${err}`;
    console.error(msg);
    result.errors.push(msg);
  }

  return result;
}

// ────────────────────────────────────────────────────
// SERVICE 2: LIVE SCORES (THE WATCHER)
// ────────────────────────────────────────────────────
interface WatcherResult {
  apiCalls: number;
  processedMatches: number;
  syncedToDb: number;
  errors: string[];
  mode: string;
}

async function liveScoresService(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  now: Date
): Promise<WatcherResult> {
  const result: WatcherResult = {
    apiCalls: 0,
    processedMatches: 0,
    syncedToDb: 0,
    errors: [],
    mode: 'NONE',
  };

  // ── Step 1: Identify Active Targets ──
  const preLiveCutoff = new Date(now.getTime() + PRE_LIVE_WINDOW_MS).toISOString();
  const nowIso = now.toISOString();

  // Pre-Live: kickoff within 60 minutes in the future
  const { data: preLiveMatches, error: preLiveErr } = await supabase
    .from('matches')
    .select('id, kickoff_time, league_id, season, status')
    .gte('kickoff_time', nowIso)
    .lte('kickoff_time', preLiveCutoff);

  if (preLiveErr) {
    console.error('[WATCHER] Pre-live query error:', preLiveErr);
  }

  // In-progress: kickoff in the past AND status not final
  const { data: inProgressMatches, error: inProgressErr } = await supabase
    .from('matches')
    .select('id, kickoff_time, league_id, season, status')
    .lt('kickoff_time', nowIso)
    .not('status', 'in', `(${FINAL_STATUSES.join(',')})`);

  if (inProgressErr) {
    console.error('[WATCHER] In-progress query error:', inProgressErr);
  }

  // Completed matches needing re-sync (cooldown filter)
  const cooldownCutoff = new Date(now.getTime() - COMPLETED_COOLDOWN_MS).toISOString();
  const { data: completedNeedSync, error: completedErr } = await supabase
    .from('matches')
    .select('id, kickoff_time, league_id, season, status')
    .eq('custom_status', 'COMPLETED')
    .or(`last_synced_at.is.null,last_synced_at.lt.${cooldownCutoff}`);

  if (completedErr) {
    console.error('[WATCHER] Completed-cooldown query error:', completedErr);
  }

  // Deduplicate by id
  const targetMap = new Map<number, any>();
  for (const m of [...(preLiveMatches || []), ...(inProgressMatches || []), ...(completedNeedSync || [])]) {
    targetMap.set(m.id, m);
  }
  const targets = Array.from(targetMap.values());
  const count = targets.length;

  console.log(`[WATCHER] Active targets: ${count} (pre-live=${preLiveMatches?.length ?? 0}, in-progress=${inProgressMatches?.length ?? 0}, completed-resync=${completedNeedSync?.length ?? 0})`);

  // ── Execution Constraint: early exit ──
  if (count === 0) {
    console.log('[WATCHER] No active matches — exiting');
    result.mode = 'NONE';
    return result;
  }

  // ── Step 2: Mode Selection & Fetch ──
  let fetchUrl: string;
  const uniqueLeagues = [...new Set(targets.map(t => t.league_id))];

  if (count === 1) {
    // ── Single Match Mode ──
    const match = targets[0];
    const kickoff = new Date(match.kickoff_time);
    const msUntilKickoff = kickoff.getTime() - now.getTime();

    result.mode = 'SINGLE';
    fetchUrl = `${API_BASE}/fixtures?id=${match.id}`;

    if (msUntilKickoff > 5 * 60_000) {
      // More than 5 min to kickoff — throttled polling
      // The cron fires every 1 min, but we skip 8 out of 9 invocations
      const minuteOfHour = now.getMinutes();
      if (minuteOfHour % 9 !== 0) {
        console.log(`[WATCHER] [SINGLE] Throttled — kickoff in ${Math.round(msUntilKickoff / 60_000)}m, skipping (minute=${minuteOfHour})`);
        result.mode = 'SINGLE_THROTTLED';
        return result;
      }
      console.log(`[WATCHER] [SINGLE] Polling — kickoff in ${Math.round(msUntilKickoff / 60_000)}m`);
    } else {
      console.log(`[WATCHER] [SINGLE] Hot polling — kickoff in ${Math.round(msUntilKickoff / 60_000)}m`);
    }
  } else if (uniqueLeagues.length > 1) {
    // ── Multi Match Mode (different leagues) ──
    result.mode = 'MULTI';
    const leagueParam = uniqueLeagues.join('-');
    fetchUrl = `${API_BASE}/fixtures?live=${leagueParam}`;
    console.log(`[WATCHER] [MULTI] Polling live for leagues: ${leagueParam}`);
  } else {
    // ── Multi-Single-League Mode ──
    result.mode = 'MULTI_SINGLE_LEAGUE';
    const leagueId = uniqueLeagues[0];
    const season = targets[0].season;
    const today = todayStr(now);
    fetchUrl = `${API_BASE}/fixtures?league=${leagueId}&season=${season}&date=${today}`;
    console.log(`[WATCHER] [MULTI_SINGLE_LEAGUE] league=${leagueId} season=${season} date=${today}`);
  }

  // ── Fetch ──
  try {
    result.apiCalls++;
    const res = await fetch(fetchUrl, { headers: apiHeaders(apiKey) });
    const json = await res.json();
    const fixtures = (json.response || []) as any[];

    console.log(`[WATCHER] API returned ${fixtures.length} fixtures`);

    if (fixtures.length === 0) {
      console.log('[WATCHER] No fixtures in API response');
      return result;
    }

    // Look up existing DB state for finished_at checks
    const fixtureIds = fixtures.map((f: any) => f.fixture.id);
    const { data: existingRows } = await supabase
      .from('matches')
      .select('id, finished_at, kickoff_time')
      .in('id', fixtureIds);

    const existingMap = new Map(
      (existingRows || []).map((m: any) => [m.id, { finished_at: m.finished_at, kickoff_time: m.kickoff_time }])
    );

    // ── Step 3: Update ──
    const payloads: any[] = [];
    for (const item of fixtures) {
      const fixtureId = item.fixture.id;
      const existing = existingMap.get(fixtureId);
      const kickoff = new Date(item.fixture.date);
      const msUntilKickoff = kickoff.getTime() - now.getTime();
      const isPreLive = msUntilKickoff > 0 && msUntilKickoff <= PRE_LIVE_WINDOW_MS;

      const payload = buildPayload(
        item,
        now,
        existing?.finished_at || null,
        isPreLive
      );
      payloads.push(payload);
      result.processedMatches++;
    }

    if (payloads.length > 0) {
      const { error } = await supabase
        .from('matches')
        .upsert(payloads, { onConflict: 'id' });

      if (error) {
        const msg = `[WATCHER] DB upsert error: ${error.message} (code: ${error.code})`;
        console.error(msg);
        result.errors.push(msg);
      } else {
        result.syncedToDb = payloads.length;
        console.log(`[WATCHER] Upserted ${payloads.length} matches`);
      }
    }
  } catch (err) {
    const msg = `[WATCHER] Fetch error: ${err}`;
    console.error(msg);
    result.errors.push(msg);
  }

  return result;
}

// ────────────────────────────────────────────────────
// HANDLER
// ────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const apiKey = Deno.env.get('SPORTS_API_KEY')?.trim() ?? '';
  const now = new Date();
  const url = new URL(req.url);
  const mode = url.searchParams.get('mode');

  if (mode === 'fixtures') {
    // ─── PLANNER ───
    console.log(`[HANDLER] ══════ PLANNER invocation ══════`);
    const result = await fixturesService(supabase, apiKey, now);

    console.log(`[HANDLER] ══════ PLANNER complete — ${result.upserted} fixtures upserted, ${result.apiCalls} API calls ══════`);

    return new Response(JSON.stringify({
      success: result.errors.length === 0,
      service: 'PLANNER',
      upserted: result.upserted,
      apiCalls: result.apiCalls,
      errors: result.errors,
    }), {
      status: result.errors.length === 0 ? 200 : 207,
      headers: { 'Content-Type': 'application/json' },
    });
  } else {
    // ─── WATCHER (default cron) ───
    console.log(`[HANDLER] ══════ WATCHER invocation ══════`);
    const result = await liveScoresService(supabase, apiKey, now);

    console.log(
      `[HANDLER] ══════ WATCHER complete — mode=${result.mode} synced=${result.syncedToDb} API=${result.apiCalls} ══════`
    );

    return new Response(JSON.stringify({
      success: result.errors.length === 0,
      service: 'WATCHER',
      mode: result.mode,
      processedMatches: result.processedMatches,
      syncedToDb: result.syncedToDb,
      apiCalls: result.apiCalls,
      errors: result.errors,
    }), {
      status: result.errors.length === 0 ? 200 : 207,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});