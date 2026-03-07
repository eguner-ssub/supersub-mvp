import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ────────────────────────────────────────────────────
// CONFIGURATION
// ────────────────────────────────────────────────────
const SUPPORTED_LEAGUE_IDS = [39, 40, 78, 135, 94];
const FINAL_STATUSES = ['FT', 'AET', 'PEN'];
const LIVE_STATUSES  = ['1H', 'HT', '2H', 'ET', 'P'];
const PRE_LIVE_WINDOW_MS = 60 * 60_000; // 60 minutes before kickoff
const LIVE_WINDOW_MS     = 5 * 60_000;  // 5 minutes before kickoff → LIVE


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
  // 1. API-authoritative statuses take priority
  if (FINAL_STATUSES.includes(apiStatus)) return 'COMPLETED';
  if (LIVE_STATUSES.includes(apiStatus)) return 'LIVE';

  // 2. Time-based transitions
  const msUntilKickoff = kickoffTime.getTime() - now.getTime();
  if (msUntilKickoff <= LIVE_WINDOW_MS) return 'LIVE';          // ≤5m → LIVE
  if (msUntilKickoff <= PRE_LIVE_WINDOW_MS) return 'PRE-LIVE';  // 60m–5m → PRE-LIVE
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
      // Still log the sync so the Planner Guard skips future invocations today
      await supabase.from('sync_logs').upsert(
        { date: today, service: 'PLANNER', result_count: 0 },
        { onConflict: 'date,service' }
      );
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

    // Log this run so the Planner Guard can skip future invocations today
    await supabase.from('sync_logs').upsert(
      { date: today, service: 'PLANNER', result_count: result.upserted },
      { onConflict: 'date,service' }
    );
    console.log(`[PLANNER] Logged sync for ${today}`);
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

  // ── Step 1: Identify Active Targets (PRE-LIVE + LIVE) ──
  const preLiveCutoff = new Date(now.getTime() + PRE_LIVE_WINDOW_MS).toISOString();
  const zombieCutoff  = new Date(now.getTime() - 12 * 60 * 60_000).toISOString();

  const { data: activeMatches, error: activeErr } = await supabase
    .from('matches')
    .select('id, kickoff_time, league_id, season, status, last_synced_at')
    .gte('kickoff_time', zombieCutoff)      // not older than 12h (zombie guard)
    .lte('kickoff_time', preLiveCutoff)      // kickoff within next 60m or in the past
    .not('status', 'in', `(${FINAL_STATUSES.join(',')})`);

  if (activeErr) {
    console.error('[WATCHER] Active targets query error:', activeErr);
  }

  const targets = activeMatches || [];
  const count = targets.length;

  console.log(`[WATCHER] Active targets: ${count}`);

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
      // Pre-Live zone (60m to 5m before kickoff): only poll if 9 min stale
      const lastSynced = match.last_synced_at ? new Date(match.last_synced_at) : null;
      const msSinceSync = lastSynced ? now.getTime() - lastSynced.getTime() : Infinity;
      if (msSinceSync < 9 * 60_000) {
        console.log(`[WATCHER] [SINGLE] Fresh — last synced ${Math.round(msSinceSync / 60_000)}m ago, skipping`);
        result.mode = 'SINGLE_THROTTLED';
        return result;
      }
      console.log(`[WATCHER] [SINGLE] Stale — polling (last synced ${Math.round(msSinceSync / 60_000)}m ago)`);
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
    // ─── PLANNER GUARD: skip if already synced today ───
    const { data: existingLog } = await supabase
      .from('sync_logs')
      .select('id')
      .eq('date', todayStr(now))
      .eq('service', 'PLANNER')
      .maybeSingle();

    if (existingLog) {
      console.log(`[HANDLER] ══════ PLANNER skipped — already synced ${todayStr(now)} ══════`);
      return new Response(JSON.stringify({
        success: true,
        service: 'PLANNER',
        skipped: true,
        reason: 'Already synced today',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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