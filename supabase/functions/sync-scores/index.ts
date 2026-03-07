import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ────────────────────────────────────────────────────
// CONFIGURATION
// ────────────────────────────────────────────────────
const SUPPORTED_LEAGUE_IDS = [39, 40, 78, 135, 94];
const FINAL_STATUSES = ['FT', 'AET', 'PEN'];
const LIVE_STATUSES  = ['1H', 'HT', '2H', 'ET', 'P'];
const PRE_LIVE_WINDOW_MS = 60 * 60_000;  // 60 minutes before kickoff
const LIVE_WINDOW_MS     = 5 * 60_000;   // 5 minutes before kickoff → LIVE

// A match can last at most ~3h (90min + extra time + penalties + broadcast delay).
// Zombie cutoff is applied to last_synced_at, NOT kickoff_time, so a late-kicking
// match that runs long is never dropped from tracking before it reaches FT.
const ZOMBIE_IDLE_MS = 3 * 60 * 60_000; // 3 hours since last sync → safe to drop

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
  if (msUntilKickoff <= LIVE_WINDOW_MS && msUntilKickoff > 0) return 'LIVE'; // ≤5m & >0 → LIVE
  if (msUntilKickoff <= PRE_LIVE_WINDOW_MS) return 'PRE-LIVE';               // 60m–5m → PRE-LIVE
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

    // ── NUDGE: write today's matches to watcher_nudge so the Watcher
    //    has a direct, authoritative list of what to track today. ──
    const todayFixtures = supported.filter(
      (item: any) => item.fixture.date.split('T')[0] === today
    );

    if (todayFixtures.length > 0) {
      const nudgePayloads = todayFixtures.map((item: any) => ({
        id: item.fixture.id,
        date: item.fixture.date.split('T')[0],
        kickoff_time: item.fixture.date,
        league_id: item.league.id,
        season: item.league.season,
        status: item.fixture.status.short,
      }));

      const { error: nudgeError } = await supabase
        .from('watcher_nudge')
        .upsert(nudgePayloads, { onConflict: 'id' });

      if (nudgeError) {
        const msg = `[PLANNER] Nudge upsert error: ${nudgeError.message}`;
        console.error(msg);
        result.errors.push(msg);
      } else {
        console.log(`[PLANNER] Nudged Watcher with ${nudgePayloads.length} matches for ${today}`);
      }
    } else {
      console.log(`[PLANNER] No matches today (${today}) — no nudge sent`);
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
  preLiveSynced: number;
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
    preLiveSynced: 0,
    errors: [],
    mode: 'NONE',
  };

  const PRELIVE_THROTTLE_MS = 9 * 60_000;
  const today = todayStr(now);

  // ── Step 1: Read today's matches from watcher_nudge (set by Planner) ──
  // Fall back to querying matches directly if nudge table is empty (e.g. cold start).
  const { data: nudgedMatches, error: nudgeErr } = await supabase
    .from('watcher_nudge')
    .select('id, kickoff_time, league_id, season, status')
    .eq('date', today)
    .not('status', 'in', `(${FINAL_STATUSES.join(',')})`);

  if (nudgeErr) {
    console.error('[WATCHER] Nudge table query error:', nudgeErr);
  }

  let activeMatches: any[] | null = null;

  if (nudgedMatches && nudgedMatches.length > 0) {
    console.log(`[WATCHER] Using nudge table — ${nudgedMatches.length} matches for ${today}`);

    // Still need last_synced_at for PRE-LIVE throttle — join from matches
    const nudgeIds = nudgedMatches.map((m: any) => m.id);
    const { data: syncedRows } = await supabase
      .from('matches')
      .select('id, last_synced_at')
      .in('id', nudgeIds);

    const syncedMap = new Map(
      (syncedRows || []).map((r: any) => [r.id, r.last_synced_at])
    );

    activeMatches = nudgedMatches.map((m: any) => ({
      ...m,
      last_synced_at: syncedMap.get(m.id) ?? null,
    }));
  } else {
    // Cold-start fallback: query matches directly.
    //
    // FIX (Root Cause 1): zombie guard now checks last_synced_at, NOT kickoff_time.
    // The old approach filtered out matches whose kickoff was >12h ago, which would
    // silently drop in-progress matches that kicked off in the afternoon and ran long
    // into the evening. Now a match stays tracked as long as it was synced within the
    // last 3h — safely covering any match duration including extra time + penalties.
    console.log(`[WATCHER] No nudge data for ${today} — falling back to matches table`);
    const zombieCutoff    = new Date(now.getTime() - ZOMBIE_IDLE_MS).toISOString();
    const preLiveCutoff   = new Date(now.getTime() + PRE_LIVE_WINDOW_MS).toISOString();

    const { data: fallbackMatches, error: fallbackErr } = await supabase
      .from('matches')
      .select('id, kickoff_time, league_id, season, status, last_synced_at')
      .lte('kickoff_time', preLiveCutoff)                               // within active window or past
      .not('status', 'in', `(${FINAL_STATUSES.join(',')})`)            // not already finished
      .or(`last_synced_at.is.null,last_synced_at.gte.${zombieCutoff}`); // synced recently or never synced yet

    if (fallbackErr) {
      console.error('[WATCHER] Fallback matches query error:', fallbackErr);
    }

    activeMatches = fallbackMatches || [];
  }

  // Keep only matches within the PRE-LIVE + LIVE window
  const preLiveCutoff = new Date(now.getTime() + PRE_LIVE_WINDOW_MS);
  const targets = (activeMatches || []).filter((m: any) => {
    const kickoff = new Date(m.kickoff_time);
    // Kickoff must be in the future within the pre-live window, or already in the past
    return kickoff <= preLiveCutoff;
  });

  if (targets.length === 0) {
    console.log('[WATCHER] No active matches — exiting');
    result.mode = 'NONE';
    return result;
  }

  // ── Step 2: Partition into LIVE and PRE-LIVE ──
  const liveTargets: any[] = [];
  const preLiveTargets: any[] = [];

  for (const m of targets) {
    const kickoff = new Date(m.kickoff_time);
    const msUntil = kickoff.getTime() - now.getTime();
    if (msUntil <= LIVE_WINDOW_MS) {
      liveTargets.push(m);      // ≤5min or already started
    } else {
      preLiveTargets.push(m);   // 60m–5m window
    }
  }

  // Combined count drives mode selection (spec: switch based on PRE-LIVE + LIVE combined)
  const combinedCount = liveTargets.length + preLiveTargets.length;
  console.log(`[WATCHER] Targets: ${targets.length} total (combined=${combinedCount}), ${liveTargets.length} LIVE, ${preLiveTargets.length} PRE-LIVE`);

  // ── Step 3a: PRE-LIVE Track (fire first, non-blocking) ──
  // Filter to stale matches only (last_synced_at > 9 min ago or null)
  const stalePreLive = preLiveTargets.filter((m: any) => {
    if (!m.last_synced_at) return true;
    return now.getTime() - new Date(m.last_synced_at).getTime() >= PRELIVE_THROTTLE_MS;
  });

  let preLivePromise: Promise<void> | null = null;

  if (stalePreLive.length > 0) {
    const batchedIds = stalePreLive.map((m: any) => m.id).join('-');
    const preLiveUrl = `${API_BASE}/fixtures?ids=${batchedIds}`;
    console.log(`[WATCHER] [PRE-LIVE] Batch fetch: ${stalePreLive.length} stale matches → ?ids=${batchedIds}`);
    result.apiCalls++;

    preLivePromise = (async () => {
      try {
        const res = await fetch(preLiveUrl, { headers: apiHeaders(apiKey) });
        const json = await res.json();
        const fixtures = (json.response || []) as any[];

        if (fixtures.length === 0) {
          console.log('[WATCHER] [PRE-LIVE] No fixtures in API response');
          return;
        }

        // Look up existing finished_at
        const ids = fixtures.map((f: any) => f.fixture.id);
        const { data: existingRows } = await supabase
          .from('matches')
          .select('id, finished_at')
          .in('id', ids);

        const existingMap = new Map(
          (existingRows || []).map((r: any) => [r.id, r.finished_at])
        );

        const payloads = fixtures.map((item: any) => buildPayload(
          item,
          now,
          (existingMap.get(item.fixture.id) as string) || null,
          true // isPreLive — always true in this track
        ));

        const { error } = await supabase
          .from('matches')
          .upsert(payloads, { onConflict: 'id' });

        if (error) {
          const msg = `[WATCHER] [PRE-LIVE] DB upsert error: ${error.message}`;
          console.error(msg);
          result.errors.push(msg);
        } else {
          result.preLiveSynced = payloads.length;
          console.log(`[WATCHER] [PRE-LIVE] Upserted ${payloads.length} matches`);

          // Keep nudge table status in sync
          await Promise.all(payloads.map((p: any) =>
            supabase
              .from('watcher_nudge')
              .update({ status: p.status })
              .eq('id', p.id)
          ));
        }
      } catch (err) {
        const msg = `[WATCHER] [PRE-LIVE] Fetch error: ${err}`;
        console.error(msg);
        result.errors.push(msg);
      }
    })();
  } else {
    console.log(`[WATCHER] [PRE-LIVE] All ${preLiveTargets.length} matches fresh — skipping batch`);
  }

  // ── Step 3b: LIVE Track (priority, 3-mode selection) ──
  // Mode is determined by the COMBINED count of LIVE + PRE-LIVE targets,
  // so that mode correctly reflects the full picture of active matches.
  if (liveTargets.length > 0) {
    const allActiveTargets = [...liveTargets, ...preLiveTargets];
    const uniqueLeagues = [...new Set(allActiveTargets.map((t: any) => t.league_id))];
    let fetchUrl: string;

    if (combinedCount === 1) {
      // ── Single Match Mode — only one active match across all windows ──
      result.mode = 'SINGLE';
      fetchUrl = `${API_BASE}/fixtures?id=${liveTargets[0].id}`;
      console.log(`[WATCHER] [LIVE] Single match: id=${liveTargets[0].id}`);
    } else if (uniqueLeagues.length > 1) {
      // ── Multi Match Mode — multiple matches across different leagues ──
      result.mode = 'MULTI';
      const leagueParam = uniqueLeagues.join('-');
      fetchUrl = `${API_BASE}/fixtures?live=${leagueParam}`;
      console.log(`[WATCHER] [LIVE] Multi-league: ${leagueParam}`);
    } else {
      // ── Multi-Single-League Mode — multiple matches, same league ──
      result.mode = 'MULTI_SINGLE_LEAGUE';
      const leagueId = uniqueLeagues[0];
      const season = liveTargets[0].season;
      fetchUrl = `${API_BASE}/fixtures?league=${leagueId}&season=${season}&date=${today}`;
      console.log(`[WATCHER] [LIVE] Single-league: league=${leagueId} season=${season} date=${today}`);
    }

    try {
      result.apiCalls++;
      const res = await fetch(fetchUrl, { headers: apiHeaders(apiKey) });
      const json = await res.json();
      const fixtures = (json.response || []) as any[];

      console.log(`[WATCHER] [LIVE] API returned ${fixtures.length} fixtures`);

      // ── FIX (Root Cause 2): Ghost match resolution ──
      // The ?live= endpoint only returns matches the API considers actively in
      // progress. A match that just reached FT disappears from that response
      // immediately. If any liveTarget is absent from the response, fetch it
      // individually by ID to capture its final status before moving on.
      const returnedIds = new Set(fixtures.map((f: any) => f.fixture.id));
      const ghostTargets = liveTargets.filter((t: any) => !returnedIds.has(t.id));

      if (ghostTargets.length > 0) {
        console.log(`[WATCHER] [LIVE] ${ghostTargets.length} ghost match(es) absent from response — resolving individually`);
        const ghostIds = ghostTargets.map((t: any) => t.id).join('-');
        const ghostUrl = `${API_BASE}/fixtures?ids=${ghostIds}`;

        try {
          result.apiCalls++;
          const ghostRes = await fetch(ghostUrl, { headers: apiHeaders(apiKey) });
          const ghostJson = await ghostRes.json();
          const ghostFixtures = (ghostJson.response || []) as any[];
          console.log(`[WATCHER] [LIVE] Ghost resolution returned ${ghostFixtures.length} fixture(s)`);

          // Merge resolved ghost fixtures into the main set for unified processing below
          for (const gf of ghostFixtures) {
            fixtures.push(gf);
          }
        } catch (ghostErr) {
          const msg = `[WATCHER] [LIVE] Ghost resolution fetch error: ${ghostErr}`;
          console.error(msg);
          result.errors.push(msg);
        }
      }

      if (fixtures.length > 0) {
        // Look up existing DB state for finished_at checks
        const fixtureIds = fixtures.map((f: any) => f.fixture.id);
        const { data: existingRows } = await supabase
          .from('matches')
          .select('id, finished_at, kickoff_time')
          .in('id', fixtureIds);

        const existingMap = new Map(
          (existingRows || []).map((m: any) => [m.id, { finished_at: m.finished_at, kickoff_time: m.kickoff_time }])
        );

        const payloads: any[] = [];
        for (const item of fixtures) {
          const fixtureId = item.fixture.id;
          const existing = existingMap.get(fixtureId);
          const kickoff = new Date(item.fixture.date);
          const msUntilKickoff = kickoff.getTime() - now.getTime();
          const isPreLive = msUntilKickoff > 0 && msUntilKickoff <= PRE_LIVE_WINDOW_MS;

          payloads.push(buildPayload(item, now, existing?.finished_at || null, isPreLive));
          result.processedMatches++;
        }

        const { error } = await supabase
          .from('matches')
          .upsert(payloads, { onConflict: 'id' });

        if (error) {
          const msg = `[WATCHER] [LIVE] DB upsert error: ${error.message} (code: ${error.code})`;
          console.error(msg);
          result.errors.push(msg);
        } else {
          result.syncedToDb = payloads.length;
          console.log(`[WATCHER] [LIVE] Upserted ${payloads.length} matches`);

          // Keep nudge table status in sync so finished matches drop out of
          // future Watcher invocations without waiting for the next Planner run
          await Promise.all(payloads.map((p: any) =>
            supabase
              .from('watcher_nudge')
              .update({ status: p.status })
              .eq('id', p.id)
          ));
        }
      }
    } catch (err) {
      const msg = `[WATCHER] [LIVE] Fetch error: ${err}`;
      console.error(msg);
      result.errors.push(msg);
    }
  } else {
    result.mode = 'PRE-LIVE_ONLY';
    console.log('[WATCHER] No LIVE targets — PRE-LIVE batch only this invocation');
  }

  // ── Step 4: Await PRE-LIVE promise (cleanup) ──
  if (preLivePromise) {
    await preLivePromise;
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
      `[HANDLER] ══════ WATCHER complete — mode=${result.mode} synced=${result.syncedToDb} preLive=${result.preLiveSynced} API=${result.apiCalls} ══════`
    );

    return new Response(JSON.stringify({
      success: result.errors.length === 0,
      service: 'WATCHER',
      mode: result.mode,
      processedMatches: result.processedMatches,
      syncedToDb: result.syncedToDb,
      preLiveSynced: result.preLiveSynced,
      apiCalls: result.apiCalls,
      errors: result.errors,
    }), {
      status: result.errors.length === 0 ? 200 : 207,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});