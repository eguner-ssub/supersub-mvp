import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ────────────────────────────────────────────────────
// CONFIGURATION
// ────────────────────────────────────────────────────
const SUPPORTED_LEAGUE_IDS = [8, 9, 82, 564, 384]; // EPL, Championship, Bundesliga, La Liga, Serie A

// Statuses where the match is actively in progress (ball is in play or half-time)
const IN_PLAY_STATUSES = ['INPLAY_1ST_HALF', 'HT', 'INPLAY_2ND_HALF', 'INPLAY_ET', 'EXTRA_TIME_BREAK', 'INPLAY_ET_SECOND_HALF', 'INPLAY_PENALTIES', 'BREAK'];

// Statuses that mean the match is definitively over in any form
const TERMINAL_STATUSES = ['FT', 'AET', 'FT_PEN', 'POSTPONED', 'SUSPENDED', 'CANCELLED', 'ABANDONED', 'AWARDED', 'WO', 'DELETED'];

const PRE_LIVE_WINDOW_MS      = 60 * 60_000;  // 60 minutes before kickoff → PRE-LIVE
const LIVE_WINDOW_MS          =  5 * 60_000;  // 5 minutes before kickoff → LIVE

// Finish-guard: 105 minutes after started_at, poll every minute for up to 30 minutes
// to ensure we capture FT/terminal status even if the regular live feed missed it.
const FINISH_GUARD_OFFSET_MS  = 105 * 60_000;
const FINISH_GUARD_WINDOW_MS  =  30 * 60_000;

const SPORTMONKS_BASE = 'https://api.sportmonks.com/v3/football';

// ────────────────────────────────────────────────────
// SPORTMONKS REQUEST HELPER
// ────────────────────────────────────────────────────

async function smRequest(path: string, params: Record<string, string> = {}): Promise<any> {
  const apiToken = Deno.env.get('SPORTMONKS_API_TOKEN')?.trim() ?? '';
  if (!apiToken) throw new Error('Missing env var SPORTMONKS_API_TOKEN');

  const url = new URL(`${SPORTMONKS_BASE}${path}`);
  url.searchParams.set('api_token', apiToken);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url.toString());

  if (res.status === 401 || res.status === 403) {
    throw new Error(`Sportmonks auth error ${res.status} on ${path}`);
  }
  if (res.status === 429) {
    throw new Error(`Sportmonks rate limit exceeded on ${path}`);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sportmonks ${res.status} on ${path}: ${text}`);
  }

  return res.json();
}

// ────────────────────────────────────────────────────
// SPORTMONKS RESPONSE HELPERS
// ────────────────────────────────────────────────────

function extractParticipants(fixture: any): { homeTeam: any; awayTeam: any } {
  let homeTeam: any = null;
  let awayTeam: any = null;

  for (const p of fixture.participants || []) {
    if (p.meta?.location === 'home') homeTeam = p;
    if (p.meta?.location === 'away') awayTeam = p;
  }

  return { homeTeam, awayTeam };
}

function extractCurrentScore(fixture: any): { scoreHome: number | null; scoreAway: number | null } {
  let scoreHome: number | null = null;
  let scoreAway: number | null = null;

  for (const s of fixture.scores || []) {
    if (s.description === 'CURRENT') {
      if (s.score?.participant === 'home') scoreHome = s.score.goals;
      if (s.score?.participant === 'away') scoreAway = s.score.goals;
    }
  }

  return { scoreHome, scoreAway };
}

function extractStateName(fixture: any): string {
  return fixture.state?.developer_name || 'NS';
}

// ────────────────────────────────────────────────────
// STATUS DERIVATION
// ────────────────────────────────────────────────────


// ────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────

function todayStr(now: Date): string {
  return now.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Build a full upsert payload from a raw Sportmonks fixture object.
 *
 * Sportmonks fixture shape:
 *   - fixture.id              (top-level ID)
 *   - fixture.starting_at     (kickoff datetime)
 *   - fixture.state.developer_name  (e.g. "FT", "INPLAY_1ST_HALF")
 *   - fixture.participants[]  with meta.location = "home" | "away"
 *   - fixture.scores[]        with score.participant = "home" | "away", description = "CURRENT"
 *   - fixture.league_id       (Sportmonks league ID)
 *   - fixture.events[]        (match events)
 *   - fixture.lineups[]       (player lineups)
 */
function buildPayload(
  fixture: any,
  now: Date,
  existingFinishedAt: string | null,
  existingStartedAt: string | null,
  existingLineups: any,
  isPreLive: boolean
): any {
  const apiStatus    = extractStateName(fixture);

  const { homeTeam, awayTeam }     = extractParticipants(fixture);
  const { scoreHome, scoreAway }   = extractCurrentScore(fixture);

  const payload: any = {
    id:             fixture.id,
    league_id:      fixture.league_id,
    home_team:      homeTeam?.name ?? 'Unknown',
    away_team:      awayTeam?.name ?? 'Unknown',
    home_logo:      homeTeam?.image_path ?? null,
    away_logo:      awayTeam?.image_path ?? null,
    status:         apiStatus,
    home_score:     scoreHome ?? 0,
    away_score:     scoreAway ?? 0,
    kickoff_time:   fixture.starting_at,
    date:           fixture.starting_at?.split('T')[0] ?? todayStr(now),
    last_updated:   now.toISOString(),
    last_synced_at: now.toISOString(),
    raw_data:       fixture,
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
  if (fixture.events && Array.isArray(fixture.events) && fixture.events.length > 0) {
    payload.events = fixture.events;
  }

  // Lineups — write fresh lineups from API if available and we're in pre-live,
  // otherwise carry forward whatever is already stored so upsert never wipes them.
  if (isPreLive && fixture.lineups && Array.isArray(fixture.lineups) && fixture.lineups.length > 0) {
    payload.lineups             = fixture.lineups;
    payload.pre_live_synced_at  = now.toISOString();
  } else if (existingLineups) {
    payload.lineups = existingLineups;
  }

  // Statistics (Sportmonks includes statistics in the fixture when requested)
  if (fixture.statistics && Array.isArray(fixture.statistics) && fixture.statistics.length > 0) {
    payload.statistics = fixture.statistics;
  }

  return payload;
}

// ────────────────────────────────────────────────────
// SHARED: upsert fixtures into matches table
// ────────────────────────────────────────────────────
async function upsertFixtures(
  supabase: ReturnType<typeof createClient>,
  fixtures: any[],
  now: Date,
  isPreLive: boolean,
  label: string,
  result: { errors: string[] },
  // Optional: pre-loaded lineups map from the caller to avoid a redundant DB fetch.
  externalLineupsMap?: Map<number, any>
): Promise<any[]> {
  if (fixtures.length === 0) return [];

  // Sportmonks fixtures have the ID at the top level (fixture.id), not fixture.fixture.id
  const fixtureIds = fixtures.map((f: any) => f.id);
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
  for (const fixture of fixtures) {
    const existing        = existingMap.get(fixture.id);
    const kickoff         = new Date(fixture.starting_at);
    const msUntilKickoff  = kickoff.getTime() - now.getTime();
    const itemIsPreLive   = isPreLive || (msUntilKickoff > 0 && msUntilKickoff <= PRE_LIVE_WINDOW_MS);

    const existingLineups = externalLineupsMap
      ? (externalLineupsMap.get(fixture.id) ?? null)
      : (existing?.lineups ?? null);

    payloads.push(buildPayload(
      fixture,
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
  now: Date
): Promise<PlannerResult> {
  const result: PlannerResult = { apiCalls: 0, upserted: 0, errors: [] };
  const hour  = now.getUTCHours();
  const today = todayStr(now);

  const allFixtures: any[] = [];

  try {
    if (hour < 12) {
      // ── Midnight run: fetch today's fixtures by date ──
      // Sportmonks: GET /fixtures/date/{date} with league filter
      console.log(`[PLANNER] Midnight run — fetching fixtures for ${today}`);
      result.apiCalls++;
      const json = await smRequest(`/fixtures/date/${today}`, {
        include: 'scores;state;participants',
        filters: `fixtureLeagues:${SUPPORTED_LEAGUE_IDS.join(',')}`,
      });
      for (const f of (json.data || [])) allFixtures.push(f);
      console.log(`[PLANNER] Midnight fetch returned ${json.data?.length ?? 0} fixtures`);
    } else {
      // ── Midday run: fetch today + next 14 days per supported league ──
      // Sportmonks: GET /fixtures/between/{from}/{to} with per-league filter
      const futureDate = todayStr(addDays(now, 14));
      console.log(`[PLANNER] Midday run — fetching fixtures ${today} → ${futureDate} per league`);

      for (const leagueId of SUPPORTED_LEAGUE_IDS) {
        result.apiCalls++;
        const json = await smRequest(`/fixtures/between/${today}/${futureDate}`, {
          include: 'scores;state;participants',
          filters: `fixtureLeagues:${leagueId}`,
        });
        const count = json.data?.length ?? 0;
        console.log(`[PLANNER] League ${leagueId}: ${count} fixtures`);
        for (const f of (json.data || [])) allFixtures.push(f);
      }
    }

    // Deduplicate by fixture id
    const seen = new Set<number>();
    const uniqueFixtures: any[] = [];
    for (const f of allFixtures) {
      if (!seen.has(f.id)) {
        seen.add(f.id);
        uniqueFixtures.push(f);
      }
    }

    // Filter to supported leagues (should already be filtered by API, but belt-and-braces)
    const supported = uniqueFixtures.filter((f: any) => SUPPORTED_LEAGUE_IDS.includes(f.league_id));
    console.log(`[PLANNER] Total fetched: ${uniqueFixtures.length} fixtures, ${supported.length} in supported leagues`);

    if (supported.length === 0) {
      console.log('[PLANNER] No supported fixtures — logging and exiting');
      await supabase.from('sync_logs').upsert(
        { date: today, service: 'PLANNER', result_count: 0 },
        { onConflict: 'date,service' }
      );
      return result;
    }

    const payloads = supported.map((fixture: any) => {
      const apiStatus  = extractStateName(fixture);
      const { homeTeam, awayTeam }   = extractParticipants(fixture);
      const { scoreHome, scoreAway } = extractCurrentScore(fixture);

      return {
        id:            fixture.id,
        date:          fixture.starting_at?.split('T')[0] ?? today,
        kickoff_time:  fixture.starting_at,
        league_id:     fixture.league_id,
        status:        apiStatus,
        home_team:     homeTeam?.name ?? 'Unknown',
        away_team:     awayTeam?.name ?? 'Unknown',
        home_logo:     homeTeam?.image_path ?? null,
        away_logo:     awayTeam?.image_path ?? null,
        home_score:    scoreHome ?? 0,
        away_score:    scoreAway ?? 0,
        last_updated:  now.toISOString(),
      };
    });

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
  const today               = todayStr(now);

  // ── Step 1: Load today's unfinished matches directly from matches table ──
  const preLiveCutoff = new Date(now.getTime() + PRE_LIVE_WINDOW_MS).toISOString();

  const { data: activeMatches, error: matchesErr } = await supabase
    .from('matches')
    .select('id, kickoff_time, league_id, status, started_at')
    .eq('date', today)
    .lte('kickoff_time', preLiveCutoff)
    .not('status', 'in', `(${TERMINAL_STATUSES.join(',')})`);

  if (matchesErr) console.error('[WATCHER] Matches query error:', matchesErr);

  const todayMatches: any[] = activeMatches || [];
  console.log(`[WATCHER] Found ${todayMatches.length} active match(es) for ${today}`);

  if (todayMatches.length === 0) {
    console.log('[WATCHER] Nothing active this invocation — exiting');
    return result;
  }

  // ── Step 2: Fetch pre_live_synced_at and lineups for throttle + lineup logic ──
  const todayIds = todayMatches.map((m: any) => m.id);

  let preLiveSyncedMap = new Map<number, string | null>();
  let lineupsMap       = new Map<number, any>();

  const { data: metaRows } = await supabase
    .from('matches')
    .select('id, pre_live_synced_at, lineups')
    .in('id', todayIds);

  for (const r of (metaRows || [])) {
    preLiveSyncedMap.set(r.id, r.pre_live_synced_at ?? null);
    lineupsMap.set(r.id,       r.lineups            ?? null);
  }

  // ── Step 3: Identify FINISH-GUARD targets ──
  const finishGuardTargets: any[] = [];
  const remainingMatches:   any[] = [];

  for (const m of todayMatches) {
    const startedAt = m.started_at ?? null;
    if (startedAt) {
      const startedMs    = new Date(startedAt).getTime();
      const guardStartMs = startedMs + FINISH_GUARD_OFFSET_MS;
      const guardEndMs   = guardStartMs + FINISH_GUARD_WINDOW_MS;
      const nowMs        = now.getTime();

      if (nowMs >= guardStartMs && nowMs <= guardEndMs) {
        finishGuardTargets.push(m);
        continue;
      }
    }
    remainingMatches.push(m);
  }

  // ── Step 4: Finish-guard track (highest priority, always fetched by ID) ──
  // Sportmonks: GET /fixtures/{id} for each match individually
  if (finishGuardTargets.length > 0) {
    console.log(`[WATCHER] [FINISH-GUARD] Polling ${finishGuardTargets.length} match(es)`);

    const fgFixtures: any[] = [];
    for (const m of finishGuardTargets) {
      try {
        result.apiCalls++;
        const json = await smRequest(`/fixtures/${m.id}`, {
          include: 'scores;state;participants;events;statistics',
        });
        if (json.data) fgFixtures.push(json.data);
      } catch (err) {
        const msg = `[WATCHER] [FINISH-GUARD] Fetch error for id=${m.id}: ${err}`;
        console.error(msg);
        result.errors.push(msg);
      }
    }

    console.log(`[WATCHER] [FINISH-GUARD] Fetched ${fgFixtures.length} fixture(s)`);

    if (fgFixtures.length > 0) {
      const payloads = await upsertFixtures(
        supabase, fgFixtures, now, false, 'WATCHER/FINISH-GUARD', result
      );
      result.finishGuardSynced  = payloads.length;
      result.processedMatches  += payloads.length;
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
  // Sportmonks: GET /livescores (pre-live / upcoming fixtures)
  // with include=lineups;participants;scores;state
  const stalePreLive = preLiveTargets.filter((m: any) => {
    if (!m.pre_live_synced_at) return true;
    return now.getTime() - new Date(m.pre_live_synced_at).getTime() >= PRELIVE_THROTTLE_MS;
  });

  let preLivePromise: Promise<void> | null = null;

  if (stalePreLive.length > 0) {
    console.log(`[WATCHER] [PRE-LIVE] Fetching ${stalePreLive.length} stale match(es) individually`);

    preLivePromise = (async () => {
      try {
        const plFixtures: any[] = [];
        for (const m of stalePreLive) {
          try {
            result.apiCalls++;
            const json = await smRequest(`/fixtures/${m.id}`, {
              include: 'scores;state;participants;lineups',
            });
            if (json.data) plFixtures.push(json.data);
          } catch (err) {
            console.error(`[WATCHER] [PRE-LIVE] Fetch error for id=${m.id}: ${err}`);
          }
        }

        if (plFixtures.length === 0) {
          console.log('[WATCHER] [PRE-LIVE] No fixtures fetched');
          return;
        }

        const payloads = await upsertFixtures(
          supabase, plFixtures, now, true, 'WATCHER/PRE-LIVE', result
        );
        result.preLiveSynced = payloads.length;
      } catch (err) {
        const msg = `[WATCHER] [PRE-LIVE] Error: ${err}`;
        console.error(msg);
        result.errors.push(msg);
      }
    })();
  } else {
    console.log(`[WATCHER] [PRE-LIVE] All ${preLiveTargets.length} pre-live match(es) are fresh — skipping`);
  }

  // ── Step 7: LIVE track ──
  // Sportmonks: GET /livescores/inplay for all currently live fixtures,
  // filtered by league. For single-match mode, use GET /fixtures/{id}.
  if (liveTargets.length > 0) {
    try {
      let liveFixtures: any[] = [];

      if (combinedCount === 1 && liveTargets.length === 1) {
        // SINGLE mode: fetch by individual fixture ID
        result.mode = 'SINGLE';
        console.log(`[WATCHER] [LIVE] SINGLE mode: id=${liveTargets[0].id}`);
        result.apiCalls++;
        const json = await smRequest(`/fixtures/${liveTargets[0].id}`, {
          include: 'scores;state;participants;events;statistics',
        });
        if (json.data) liveFixtures.push(json.data);
      } else {
        // MULTI mode: use /livescores/inplay with league filter
        result.mode = 'MULTI';
        const uniqueLiveLeagues = [...new Set(liveTargets.map((t: any) => t.league_id))];
        console.log(`[WATCHER] [LIVE] MULTI mode: leagues=${uniqueLiveLeagues.join(',')}`);
        result.apiCalls++;
        const json = await smRequest('/livescores/inplay', {
          include: 'scores;state;events;participants;statistics',
          filters: `fixtureLeagues:${uniqueLiveLeagues.join(',')}`,
        });
        liveFixtures = json.data || [];
      }

      console.log(`[WATCHER] [LIVE] API returned ${liveFixtures.length} fixture(s)`);

      // Ghost resolution: any liveTarget absent from the response may have just
      // reached FT and dropped off /livescores/inplay. Fetch individually to confirm.
      const returnedIds  = new Set(liveFixtures.map((f: any) => f.id));
      const ghostTargets = liveTargets.filter((t: any) => !returnedIds.has(t.id));

      if (ghostTargets.length > 0) {
        console.log(`[WATCHER] [LIVE] ${ghostTargets.length} ghost match(es) — resolving individually`);

        for (const ghost of ghostTargets) {
          try {
            result.apiCalls++;
            const ghostJson = await smRequest(`/fixtures/${ghost.id}`, {
              include: 'scores;state;participants;events;statistics',
            });
            if (ghostJson.data) liveFixtures.push(ghostJson.data);
          } catch (ghostErr) {
            const msg = `[WATCHER] [LIVE] Ghost resolution error for id=${ghost.id}: ${ghostErr}`;
            console.error(msg);
            result.errors.push(msg);
          }
        }
        console.log(`[WATCHER] [LIVE] After ghost resolution: ${liveFixtures.length} total fixture(s)`);
      }

      const payloads = await upsertFixtures(
        supabase, liveFixtures, now, false, 'WATCHER/LIVE', result, lineupsMap
      );
      result.syncedToDb       = payloads.length;
      result.processedMatches += payloads.length;

      // ── Lineup supplement ──
      // The /livescores/inplay endpoint does not return lineups. After the main
      // live upsert, check if any live match is still missing lineups and fetch
      // them individually with lineups included.
      const missingLineupIds = liveTargets
        .filter((t: any) => !lineupsMap.get(t.id))
        .map((t: any) => t.id);

      if (missingLineupIds.length > 0) {
        console.log(`[WATCHER] [LIVE] Lineup supplement: fetching ${missingLineupIds.length} match(es)`);
        const suppFixtures: any[] = [];

        for (const fId of missingLineupIds) {
          try {
            result.apiCalls++;
            const suppJson = await smRequest(`/fixtures/${fId}`, {
              include: 'scores;state;participants;lineups',
            });
            if (suppJson.data) suppFixtures.push(suppJson.data);
          } catch (suppErr) {
            console.error(`[WATCHER] [LIVE] Lineup supplement error for id=${fId}: ${suppErr}`);
          }
        }

        if (suppFixtures.length > 0) {
          await upsertFixtures(
            supabase, suppFixtures, now, true, 'WATCHER/LIVE/LINEUP-SUPPLEMENT', result
          );
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
    const result = await fixturesService(supabase, now);
    console.log(`[HANDLER] ══════ PLANNER complete — ${result.upserted} fixtures upserted, ${result.apiCalls} API calls ══════`);

    return new Response(JSON.stringify({
      success:  result.errors.length === 0,
      service:  'PLANNER',
      upserted: result.upserted,
      apiCalls: result.apiCalls,
      errors:   result.errors,
    }), {
      status:  result.errors.length === 0 ? 200 : 207,
      headers: { 'Content-Type': 'application/json' },
    });

  } else {
    console.log(`[HANDLER] ══════ WATCHER invocation ══════`);
    const result = await liveScoresService(supabase, now);
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
