import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ────────────────────────────────────────────────────
// CONFIGURATION
// ────────────────────────────────────────────────────
const SUPPORTED_LEAGUE_IDS = [39, 40, 78, 135, 94];

// Current season for all supported leagues.
// Update this when the season rolls over, or replace with a leagues DB table.
const CURRENT_SEASON = 2025;

// Statuses where the match is actively in progress (ball is in play or half-time)
const IN_PLAY_STATUSES = ['1H', 'HT', '2H', 'ET', 'BT', 'P'];

// Statuses that mean the match is definitively over in any form
const TERMINAL_STATUSES = ['FT', 'AET', 'PEN', 'SUSP', 'INT', 'PST', 'CANC', 'ABD', 'AWD', 'WO'];

// Legacy alias kept for DB filter compatibility (subset of TERMINAL_STATUSES)
const FINAL_STATUSES = TERMINAL_STATUSES;

const PRE_LIVE_WINDOW_MS  = 60 * 60_000;  // 60 minutes before kickoff → PRE-LIVE
const LIVE_WINDOW_MS      = 5 * 60_000;   // 5 minutes before kickoff → LIVE

// Finish-guard: 105 minutes after started_at, poll every minute for up to 30 minutes
// to ensure we capture FT/terminal status even if the regular live feed missed it.
const FINISH_GUARD_OFFSET_MS  = 105 * 60_000; // T+105min → start finish-guard polling
const FINISH_GUARD_WINDOW_MS  =  30 * 60_000; // poll for 30 minutes after that

// Zombie: a match with no sync activity for 3h is considered safe to drop.
const ZOMBIE_IDLE_MS = 3 * 60 * 60_000;

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
  if (TERMINAL_STATUSES.includes(apiStatus)) return 'COMPLETED';
  if (IN_PLAY_STATUSES.includes(apiStatus))  return 'LIVE';

  const msUntilKickoff = kickoffTime.getTime() - now.getTime();
  if (msUntilKickoff <= LIVE_WINDOW_MS && msUntilKickoff > 0) return 'LIVE';
  if (msUntilKickoff <= PRE_LIVE_WINDOW_MS)                   return 'PRE-LIVE';
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
 *
 * NEW: stamps started_at on the first invocation where the API status
 * transitions into an in-play status (1H, HT, 2H, ET, BT, P).
 * This timestamp is later used by the finish-guard to begin polling
 * at T+105min regardless of whether the regular live feed is still active.
 */
function buildPayload(
  item: any,
  now: Date,
  existingFinishedAt: string | null,
  existingStartedAt: string | null,
  existingLineups: any,
  isPreLive: boolean
): any {
  const apiStatus   = item.fixture.status.short;
  const kickoffTime = new Date(item.fixture.date);
  const customStatus = deriveCustomStatus(apiStatus, kickoffTime, now);

  const payload: any = {
    id:             item.fixture.id,
    league_id:      item.league.id,
    season:         item.league.season,
    home_team:      item.teams.home.name,
    away_team:      item.teams.away.name,
    home_logo:      item.teams.home.logo,
    away_logo:      item.teams.away.logo,
    league_name:    item.league.name,
    league_logo:    item.league.logo,
    status:         apiStatus,
    custom_status:  customStatus,
    home_score:     item.goals.home ?? 0,
    away_score:     item.goals.away ?? 0,
    kickoff_time:   item.fixture.date,
    date:           item.fixture.date.split('T')[0],
    last_updated:   now.toISOString(),
    last_synced_at: now.toISOString(),
    raw_data:       item,
  };

  // Stamp started_at on first transition into any in-play status
  if (IN_PLAY_STATUSES.includes(apiStatus) && !existingStartedAt) {
    payload.started_at = now.toISOString();
  }

  // Stamp finished_at on first transition into any terminal status
  if (TERMINAL_STATUSES.includes(apiStatus) && !existingFinishedAt) {
    payload.finished_at = now.toISOString();
  }

  // Events
  if (item.events && Array.isArray(item.events) && item.events.length > 0) {
    payload.events = item.events;
  }

  // Lineups — write fresh lineups from API if available and we're in pre-live,
  // otherwise carry forward whatever is already stored so upsert never wipes them.
  if (isPreLive && item.lineups && Array.isArray(item.lineups) && item.lineups.length > 0) {
    payload.lineups          = item.lineups;
    payload.pre_live_synced_at = now.toISOString();
  } else if (existingLineups) {
    payload.lineups = existingLineups;
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
// SHARED: upsert fixtures + sync nudge table
// ────────────────────────────────────────────────────
async function upsertFixtures(
  supabase: ReturnType<typeof createClient>,
  fixtures: any[],
  now: Date,
  isPreLive: boolean,
  label: string,
  result: { errors: string[] },
  // Optional: pre-loaded lineups map from the caller to avoid a redundant DB fetch.
  // When provided, skips the internal lineups lookup.
  externalLineupsMap?: Map<number, any>
): Promise<any[]> {
  if (fixtures.length === 0) return [];

  const fixtureIds = fixtures.map((f: any) => f.fixture.id);
  const { data: existingRows } = await supabase
    .from('matches')
    .select('id, finished_at, started_at, lineups')
    .in('id', fixtureIds);

  const existingMap = new Map(
    (existingRows || []).map((r: any) => [r.id, {
      finished_at: r.finished_at,
      started_at:  r.started_at,
      lineups:     r.lineups ?? null,
    }])
  );

  const payloads: any[] = [];
  for (const item of fixtures) {
    const existing = existingMap.get(item.fixture.id);
    const kickoff = new Date(item.fixture.date);
    const msUntilKickoff = kickoff.getTime() - now.getTime();
    const itemIsPreLive = isPreLive || (msUntilKickoff > 0 && msUntilKickoff <= PRE_LIVE_WINDOW_MS);

    // Use caller-supplied lineups map if available, otherwise fall back to DB value
    const existingLineups = externalLineupsMap
      ? (externalLineupsMap.get(item.fixture.id) ?? null)
      : (existing?.lineups ?? null);

    payloads.push(buildPayload(
      item,
      now,
      existing?.finished_at || null,
      existing?.started_at  || null,
      existingLineups,
      itemIsPreLive
    ));
  }

  const { error } = await supabase
    .from('matches')
    .upsert(payloads, { onConflict: 'id' });

  if (error) {
    const msg = `[${label}] DB upsert error: ${error.message}`;
    console.error(msg);
    result.errors.push(msg);
  } else {
    console.log(`[${label}] Upserted ${payloads.length} match(es)`);

    // Keep nudge table status in sync so finished matches drop out of
    // future Watcher invocations without waiting for the next Planner run
    await Promise.all(payloads.map((p: any) =>
      supabase
        .from('watcher_nudge')
        .update({ status: p.status })
        .eq('id', p.id)
    ));
  }

  return payloads;
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
  const hour  = now.getUTCHours();
  const today = todayStr(now);

  // Collect all raw fixtures from the API before filtering
  const allFixtures: any[] = [];

  try {
    if (hour < 12) {
      // ── Midnight run: fetch today's fixtures in a single call by date ──
      console.log(`[PLANNER] Midnight run — fetching fixtures for ${today}`);
      result.apiCalls++;
      const res  = await fetch(`${API_BASE}/fixtures?date=${today}`, { headers: apiHeaders(apiKey) });
      const json = await res.json();
      for (const f of (json.response || [])) allFixtures.push(f);
      console.log(`[PLANNER] Midnight fetch returned ${json.response?.length ?? 0} fixtures`);
    } else {
      // ── Midday run: the API requires league+season alongside from/to.
      //    Make one request per supported league and merge the results. ──
      const futureDate = todayStr(addDays(now, 14));
      console.log(`[PLANNER] Midday run — fetching fixtures ${today} → ${futureDate} per league`);

      for (const leagueId of SUPPORTED_LEAGUE_IDS) {
        const url = `${API_BASE}/fixtures?league=${leagueId}&season=${CURRENT_SEASON}&from=${today}&to=${futureDate}`;
        result.apiCalls++;
        const res  = await fetch(url, { headers: apiHeaders(apiKey) });
        const json = await res.json();
        const count = json.response?.length ?? 0;
        console.log(`[PLANNER] League ${leagueId}: ${count} fixtures`);
        for (const f of (json.response || [])) allFixtures.push(f);
      }
    }

    // Deduplicate by fixture id (midday per-league calls can overlap on today's matches)
    const seen = new Set<number>();
    const uniqueFixtures: any[] = [];
    for (const f of allFixtures) {
      if (!seen.has(f.fixture.id)) {
        seen.add(f.fixture.id);
        uniqueFixtures.push(f);
      }
    }

    const supported = uniqueFixtures.filter((f: any) => SUPPORTED_LEAGUE_IDS.includes(f.league.id));
    console.log(`[PLANNER] Total fetched: ${uniqueFixtures.length} fixtures, ${supported.length} in supported leagues`);

    if (supported.length === 0) {
      console.log('[PLANNER] No supported fixtures — logging and exiting');
      await supabase.from('sync_logs').upsert(
        { date: today, service: 'PLANNER', result_count: 0 },
        { onConflict: 'date,service' }
      );
      return result;
    }

    const payloads = supported.map((item: any) => ({
      id:           item.fixture.id,
      date:         item.fixture.date.split('T')[0],
      kickoff_time: item.fixture.date,
      league_id:    item.league.id,
      league_name:  item.league.name,
      league_logo:  item.league.logo,
      season:       item.league.season,
      status:       item.fixture.status.short,
      custom_status: deriveCustomStatus(
        item.fixture.status.short,
        new Date(item.fixture.date),
        now
      ),
      home_team:  item.teams.home.name,
      away_team:  item.teams.away.name,
      home_logo:  item.teams.home.logo,
      away_logo:  item.teams.away.logo,
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

    // ── NUDGE ──
    const todayFixtures = supported.filter(
      (item: any) => item.fixture.date.split('T')[0] === today
    );

    if (todayFixtures.length > 0) {
      const nudgePayloads = todayFixtures.map((item: any) => ({
        id:           item.fixture.id,
        date:         item.fixture.date.split('T')[0],
        kickoff_time: item.fixture.date,
        league_id:    item.league.id,
        season:       item.league.season,
        status:       item.fixture.status.short,
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

    await supabase.from('sync_logs').upsert(
      { date: today, service: 'PLANNER', result_count: result.upserted },
      { onConflict: 'date,service' }
    );
    console.log(`[PLANNER] Logged sync for ${today}`);
  } catch (err) {
    const msg = `[PLANNER] Error: ${err}`;
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
  finishGuardSynced: number;
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
    finishGuardSynced: 0,
    errors: [],
    mode: 'NONE',
  };

  const PRELIVE_THROTTLE_MS = 9 * 60_000;
  const today = todayStr(now);

  // ── Step 1: Load today's unfinished matches from watcher_nudge ──
  const { data: nudgedMatches, error: nudgeErr } = await supabase
    .from('watcher_nudge')
    .select('id, kickoff_time, league_id, season, status')
    .eq('date', today)
    .not('status', 'in', `(${TERMINAL_STATUSES.join(',')})`);

  if (nudgeErr) console.error('[WATCHER] Nudge table query error:', nudgeErr);

  let todayMatches: any[] = [];

  if (nudgedMatches && nudgedMatches.length > 0) {
    console.log(`[WATCHER] Using nudge table — ${nudgedMatches.length} matches for ${today}`);
    todayMatches = nudgedMatches;
  } else {
    // Cold-start fallback
    console.log(`[WATCHER] No nudge data for ${today} — falling back to matches table`);
    const zombieCutoff  = new Date(now.getTime() - ZOMBIE_IDLE_MS).toISOString();
    const preLiveCutoff = new Date(now.getTime() + PRE_LIVE_WINDOW_MS).toISOString();

    const { data: fallbackMatches, error: fallbackErr } = await supabase
      .from('matches')
      .select('id, kickoff_time, league_id, season, status, last_synced_at')
      .eq('date', today)
      .lte('kickoff_time', preLiveCutoff)
      .not('status', 'in', `(${TERMINAL_STATUSES.join(',')})`)
      .or(`last_synced_at.is.null,last_synced_at.gte.${zombieCutoff}`);

    if (fallbackErr) console.error('[WATCHER] Fallback query error:', fallbackErr);
    todayMatches = fallbackMatches || [];
  }

  // ── Step 2: Fetch per-match metadata for throttle + guard logic ──
  //
  // pre_live_synced_at is a dedicated column updated ONLY by the PRE-LIVE track.
  // Using last_synced_at for the 9-min throttle was wrong: the LIVE track updates
  // last_synced_at every minute, which permanently blocks the pre-live throttle
  // from ever triggering for a pre-live match that co-exists with live matches.
  const todayIds = todayMatches.map((m: any) => m.id);

  let startedAtMap     = new Map<number, string | null>();
  let preLiveSyncedMap = new Map<number, string | null>();
  let lineupsMap       = new Map<number, any>();

  if (todayIds.length > 0) {
    const { data: metaRows } = await supabase
      .from('matches')
      .select('id, started_at, pre_live_synced_at, lineups')
      .in('id', todayIds);

    for (const r of (metaRows || [])) {
      startedAtMap.set(r.id,     r.started_at        ?? null);
      preLiveSyncedMap.set(r.id, r.pre_live_synced_at ?? null);
      lineupsMap.set(r.id,       r.lineups            ?? null);
    }
  }

  // ── Step 3: Identify FINISH-GUARD targets ──
  //
  // A match enters finish-guard when:
  //   - started_at is set (it went in-play at some point), AND
  //   - now >= started_at + 105min (nominal full-time window), AND
  //   - now <= started_at + 105min + 30min (still within the guard window), AND
  //   - status is not yet terminal
  //
  // These matches are fetched individually every minute regardless of the
  // regular live track, to guarantee we capture FT/AET/PEN/CANC/ABD/PST.
  const finishGuardTargets: any[] = [];
  const remainingMatches: any[]   = [];

  for (const m of todayMatches) {
    const startedAt = startedAtMap.get(m.id) ?? null;
    if (startedAt) {
      const startedMs      = new Date(startedAt).getTime();
      const guardStartMs   = startedMs + FINISH_GUARD_OFFSET_MS;
      const guardEndMs     = guardStartMs + FINISH_GUARD_WINDOW_MS;
      const nowMs          = now.getTime();

      if (nowMs >= guardStartMs && nowMs <= guardEndMs) {
        finishGuardTargets.push(m);
        continue; // handled separately, skip normal window logic
      }
    }
    remainingMatches.push(m);
  }

  // ── Step 4: Finish-guard track (highest priority, always by ID) ──
  if (finishGuardTargets.length > 0) {
    const ids    = finishGuardTargets.map((m: any) => m.id).join('-');
    const fgUrl  = `${API_BASE}/fixtures?ids=${ids}`;
    console.log(`[WATCHER] [FINISH-GUARD] Polling ${finishGuardTargets.length} match(es) → ?ids=${ids}`);
    result.apiCalls++;

    try {
      const res      = await fetch(fgUrl, { headers: apiHeaders(apiKey) });
      const json     = await res.json();
      const fixtures = (json.response || []) as any[];

      console.log(`[WATCHER] [FINISH-GUARD] API returned ${fixtures.length} fixture(s)`);

      const payloads = await upsertFixtures(
        supabase, fixtures, now, false, 'WATCHER/FINISH-GUARD', result
      );
      result.finishGuardSynced = payloads.length;
      result.processedMatches += payloads.length;
    } catch (err) {
      const msg = `[WATCHER] [FINISH-GUARD] Fetch error: ${err}`;
      console.error(msg);
      result.errors.push(msg);
    }
  }

  // ── Step 5: Partition remaining matches into PRE-LIVE and LIVE ──
  const liveTargets:    any[] = [];
  const preLiveTargets: any[] = [];

  for (const m of remainingMatches) {
    const kickoff = new Date(m.kickoff_time);
    const msUntil = kickoff.getTime() - now.getTime();

    if (msUntil <= LIVE_WINDOW_MS) {
      liveTargets.push(m);
    } else if (msUntil <= PRE_LIVE_WINDOW_MS) {
      // Attach pre_live_synced_at so the throttle check uses the right timestamp
      preLiveTargets.push({ ...m, pre_live_synced_at: preLiveSyncedMap.get(m.id) ?? null });
    }
  }

  const combinedCount = liveTargets.length + preLiveTargets.length;
  console.log(`[WATCHER] Active window: ${liveTargets.length} LIVE, ${preLiveTargets.length} PRE-LIVE, ${finishGuardTargets.length} FINISH-GUARD`);

  if (combinedCount === 0 && finishGuardTargets.length === 0) {
    console.log('[WATCHER] Nothing active this invocation — exiting');
    result.mode = 'NONE';
    return result;
  }

  // ── Step 6: PRE-LIVE track (non-blocking, 9-min throttle) ──
  // Throttle is based on pre_live_synced_at — a column written ONLY by this track.
  // last_synced_at is updated every minute by the live track and must not be used here.
  const stalePreLive = preLiveTargets.filter((m: any) => {
    if (!m.pre_live_synced_at) return true;
    return now.getTime() - new Date(m.pre_live_synced_at).getTime() >= PRELIVE_THROTTLE_MS;
  });

  let preLivePromise: Promise<void> | null = null;

  if (stalePreLive.length > 0) {
    const batchedIds = stalePreLive.map((m: any) => m.id).join('-');
    const preLiveUrl = `${API_BASE}/fixtures?ids=${batchedIds}`;
    console.log(`[WATCHER] [PRE-LIVE] Fetching ${stalePreLive.length} stale match(es) → ?ids=${batchedIds}`);
    result.apiCalls++;

    preLivePromise = (async () => {
      try {
        const res      = await fetch(preLiveUrl, { headers: apiHeaders(apiKey) });
        const json     = await res.json();
        const fixtures = (json.response || []) as any[];

        if (fixtures.length === 0) {
          console.log('[WATCHER] [PRE-LIVE] No fixtures in API response');
          return;
        }

        const payloads = await upsertFixtures(
          supabase, fixtures, now, true, 'WATCHER/PRE-LIVE', result
        );
        result.preLiveSynced = payloads.length;
      } catch (err) {
        const msg = `[WATCHER] [PRE-LIVE] Fetch error: ${err}`;
        console.error(msg);
        result.errors.push(msg);
      }
    })();
  } else {
    console.log(`[WATCHER] [PRE-LIVE] All ${preLiveTargets.length} pre-live match(es) are fresh — skipping`);
  }

  // ── Step 7: LIVE track ──
  // Mode is driven by combinedCount (PRE-LIVE + LIVE), but the ?live= URL
  // only includes leagues from liveTargets — never pre-live leagues.
  if (liveTargets.length > 0) {
    const uniqueLiveLeagues = [...new Set(liveTargets.map((t: any) => t.league_id))];
    let fetchUrl: string;

    if (combinedCount === 1) {
      result.mode = 'SINGLE';
      fetchUrl    = `${API_BASE}/fixtures?id=${liveTargets[0].id}`;
      console.log(`[WATCHER] [LIVE] SINGLE mode: id=${liveTargets[0].id}`);
    } else if (uniqueLiveLeagues.length > 1) {
      result.mode = 'MULTI';
      fetchUrl    = `${API_BASE}/fixtures?live=${uniqueLiveLeagues.join('-')}`;
      console.log(`[WATCHER] [LIVE] MULTI mode: ?live=${uniqueLiveLeagues.join('-')}`);
    } else {
      result.mode = 'MULTI_SINGLE_LEAGUE';
      const leagueId = uniqueLiveLeagues[0];
      const season   = liveTargets[0].season;
      fetchUrl       = `${API_BASE}/fixtures?league=${leagueId}&season=${season}&date=${today}`;
      console.log(`[WATCHER] [LIVE] MULTI_SINGLE_LEAGUE mode: league=${leagueId} season=${season} date=${today}`);
    }

    try {
      result.apiCalls++;
      const res      = await fetch(fetchUrl, { headers: apiHeaders(apiKey) });
      const json     = await res.json();
      const fixtures = (json.response || []) as any[];

      console.log(`[WATCHER] [LIVE] API returned ${fixtures.length} fixture(s)`);

      // Ghost resolution: any liveTarget absent from response may have just
      // reached FT and dropped off ?live=. Fetch individually to confirm.
      const returnedIds  = new Set(fixtures.map((f: any) => f.fixture.id));
      const ghostTargets = liveTargets.filter((t: any) => !returnedIds.has(t.id));

      if (ghostTargets.length > 0) {
        console.log(`[WATCHER] [LIVE] ${ghostTargets.length} ghost match(es) — resolving individually`);
        const ghostUrl = `${API_BASE}/fixtures?ids=${ghostTargets.map((t: any) => t.id).join('-')}`;

        try {
          result.apiCalls++;
          const ghostRes      = await fetch(ghostUrl, { headers: apiHeaders(apiKey) });
          const ghostJson     = await ghostRes.json();
          const ghostFixtures = (ghostJson.response || []) as any[];
          console.log(`[WATCHER] [LIVE] Ghost resolution returned ${ghostFixtures.length} fixture(s)`);
          for (const gf of ghostFixtures) fixtures.push(gf);
        } catch (ghostErr) {
          const msg = `[WATCHER] [LIVE] Ghost resolution error: ${ghostErr}`;
          console.error(msg);
          result.errors.push(msg);
        }
      }

      const payloads = await upsertFixtures(
        supabase, fixtures, now, false, 'WATCHER/LIVE', result, lineupsMap
      );
      result.syncedToDb       = payloads.length;
      result.processedMatches += payloads.length;

      // ── Lineup supplement ──
      // The ?live= and ?league= endpoints do not return lineups. After the main
      // live upsert, check if any live match is still missing lineups in the DB
      // and fetch them individually by ID. Once lineups are stored this check
      // short-circuits immediately, so there is no ongoing API cost.
      const missingLineupIds = liveTargets
        .filter((t: any) => !lineupsMap.get(t.id))
        .map((t: any) => t.id);

      if (missingLineupIds.length > 0) {
        const supplementUrl = `${API_BASE}/fixtures?ids=${missingLineupIds.join('-')}`;
        console.log(`[WATCHER] [LIVE] Lineup supplement: fetching ${missingLineupIds.length} match(es) missing lineups → ?ids=${missingLineupIds.join('-')}`);
        try {
          result.apiCalls++;
          const suppRes      = await fetch(supplementUrl, { headers: apiHeaders(apiKey) });
          const suppJson     = await suppRes.json();
          const suppFixtures = (suppJson.response || []) as any[];

          // Build a fresh lineups map from the supplement response and upsert.
          // Pass isPreLive=true so buildPayload writes the lineups if present.
          const suppLineupsMap = new Map<number, any>(
            suppFixtures.map((f: any) => [f.fixture.id, lineupsMap.get(f.fixture.id) ?? null])
          );
          await upsertFixtures(
            supabase, suppFixtures, now, true, 'WATCHER/LIVE/LINEUP-SUPPLEMENT', result, suppLineupsMap
          );
        } catch (suppErr) {
          const msg = `[WATCHER] [LIVE] Lineup supplement fetch error: ${suppErr}`;
          console.error(msg);
          result.errors.push(msg);
        }
      }

    } catch (err) {
      const msg = `[WATCHER] [LIVE] Fetch error: ${err}`;
      console.error(msg);
      result.errors.push(msg);
    }
  } else if (finishGuardTargets.length === 0) {
    result.mode = 'PRE-LIVE_ONLY';
    console.log('[WATCHER] No LIVE targets — PRE-LIVE track only');
  }

  // ── Step 8: Await PRE-LIVE promise ──
  if (preLivePromise) await preLivePromise;

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
  const now    = new Date();
  const url    = new URL(req.url);
  const mode   = url.searchParams.get('mode');

  if (mode === 'fixtures') {
    const { data: existingLog } = await supabase
      .from('sync_logs')
      .select('id')
      .eq('date', todayStr(now))
      .eq('service', 'PLANNER')
      .maybeSingle();

    if (existingLog) {
      console.log(`[HANDLER] ══════ PLANNER skipped — already synced ${todayStr(now)} ══════`);
      return new Response(JSON.stringify({
        success: true, service: 'PLANNER', skipped: true, reason: 'Already synced today',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    console.log(`[HANDLER] ══════ PLANNER invocation ══════`);
    const result = await fixturesService(supabase, apiKey, now);
    console.log(`[HANDLER] ══════ PLANNER complete — ${result.upserted} fixtures upserted, ${result.apiCalls} API calls ══════`);

    return new Response(JSON.stringify({
      success:   result.errors.length === 0,
      service:   'PLANNER',
      upserted:  result.upserted,
      apiCalls:  result.apiCalls,
      errors:    result.errors,
    }), {
      status:  result.errors.length === 0 ? 200 : 207,
      headers: { 'Content-Type': 'application/json' },
    });

  } else {
    console.log(`[HANDLER] ══════ WATCHER invocation ══════`);
    const result = await liveScoresService(supabase, apiKey, now);
    console.log(
      `[HANDLER] ══════ WATCHER complete — mode=${result.mode} live=${result.syncedToDb} preLive=${result.preLiveSynced} finishGuard=${result.finishGuardSynced} API=${result.apiCalls} ══════`
    );

    return new Response(JSON.stringify({
      success:           result.errors.length === 0,
      service:           'WATCHER',
      mode:              result.mode,
      processedMatches:  result.processedMatches,
      syncedToDb:        result.syncedToDb,
      preLiveSynced:     result.preLiveSynced,
      finishGuardSynced: result.finishGuardSynced,
      apiCalls:          result.apiCalls,
      errors:            result.errors,
    }), {
      status:  result.errors.length === 0 ? 200 : 207,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});