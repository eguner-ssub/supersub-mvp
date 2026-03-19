/**
 * sync-supersub-stats.js
 *
 * Processes finished match data to compute supersub, team bench, and coach
 * substitution statistics, then upserts aggregated rows to:
 *   - player_supersub_stats
 *   - team_bench_stats
 *   - coach_substitution_patterns
 *
 * Usage:
 *   node scripts/sync-supersub-stats.js [--full]
 *
 * --full: reprocess all finished matches (default behaviour for now).
 * Without --full: same as --full for now.
 * TODO: Add a processed_matches tracking table to enable incremental runs.
 *
 * Requires .env at project root:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SPORTMONKS_API_TOKEN
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ── League config ─────────────────────────────────────────────────────────────
const LEAGUES = [
  { id: 8,   season: 25583, name: 'Premier League' },
  { id: 9,   season: 25603, name: 'Championship' },
  { id: 82,  season: 25565, name: 'Bundesliga' },
  { id: 564, season: 25648, name: 'La Liga' },
  { id: 384, season: 25533, name: 'Serie A' },
];

// ── Position ID → position bucket ─────────────────────────────────────────────
// SportMonks position IDs: 24=GK, 25=DEF, 26=MID, 27=FWD
const POSITION_BUCKET = {
  24: 'gk',
  25: 'def',
  26: 'mid',
  27: 'fwd',
};

// Event type IDs
const EVENT_TYPE_SUBSTITUTION = 18;
const EVENT_TYPE_GOAL         = 14;
const EVENT_TYPE_OWN_GOAL     = 97; // own goals included per spec — they count as goals in lineup events

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      `Missing env vars — SUPABASE_URL: ${url ? '✓' : '✗'}, SUPABASE_SERVICE_ROLE_KEY: ${key ? '✓' : '✗'}`
    );
  }
  return createClient(url, key);
}

// ── Per-match processing ───────────────────────────────────────────────────────

/**
 * processMatch processes a single finished match and accumulates stats into the
 * provided player, team, and coach accumulator maps.
 *
 * @param {object}  match        - Match row from DB
 * @param {Map}     positionMap  - player_id → position_id
 * @param {number}  seasonId     - SportMonks season ID
 * @param {Map}     playerAcc    - Accumulator: player_id → playerStats
 * @param {Map}     teamAcc      - Accumulator: team_id → teamStats
 * @param {Map}     coachAcc     - Accumulator: coach_id → coachStats
 */
function processMatch(match, positionMap, seasonId, playerAcc, teamAcc, coachAcc) {
  const events  = Array.isArray(match.events)  ? match.events  : [];
  const lineups = Array.isArray(match.lineups) ? match.lineups : [];

  const homeTeamId  = match.home_team_id;
  const awayTeamId  = match.away_team_id;
  const homeCoachId = match.home_coach_id ?? null;
  const awayCoachId = match.away_coach_id ?? null;
  const homeScore   = match.home_score ?? 0;
  const awayScore   = match.away_score ?? 0;

  // ── 1. Build subMap: player_id (coming ON) → { minute, teamId, playerOffId } ──
  const subMap = new Map();
  for (const ev of events) {
    if (ev.type_id !== EVENT_TYPE_SUBSTITUTION) continue;
    const minute   = ev.minute ?? ev.extra_minute ?? 0;
    const playerId = ev.player_id ?? null;         // player coming ON
    const offId    = ev.related_player_id ?? null; // player going OFF
    const teamId   = ev.participant_id ?? null;
    if (!playerId) continue;
    subMap.set(playerId, { minute, teamId, playerOffId: offId });
  }

  // ── 2. Build goalEvents: { player_id, teamId, minute } ──
  const goalEvents = [];
  for (const ev of events) {
    if (ev.type_id !== EVENT_TYPE_GOAL && ev.type_id !== EVENT_TYPE_OWN_GOAL) continue;
    const minute   = ev.minute ?? ev.extra_minute ?? 0;
    if (minute > 120) continue;
    const playerId = ev.player_id ?? null;
    const teamId   = ev.participant_id ?? null;
    if (!playerId) continue;
    goalEvents.push({ player_id: playerId, teamId, minute });
  }

  // ── 3. Find supersub goals (scorer came on as sub, goal after sub minute, same team) ──
  const supersubGoals = goalEvents.filter((g) => {
    const sub = subMap.get(g.player_id);
    return sub && g.minute >= sub.minute && g.teamId === sub.teamId;
  });

  // ── 4. Identify starters from lineups (formation_field = "lineup", not on subMap as incoming) ──
  const starterIds = new Set();
  for (const entry of lineups) {
    // Skip coach entries
    if (entry.coach_id != null) continue;
    // A starter is in the lineup and NOT a substitution incoming player
    const playerId = entry.player_id ?? null;
    if (!playerId) continue;
    if (!subMap.has(playerId)) {
      starterIds.add(playerId);
    }
  }

  // ── 5. Accumulate player stats ────────────────────────────────────────────
  // Sub appearances
  for (const [playerId, subInfo] of subMap) {
    const teamId = subInfo.teamId ?? (homeTeamId);
    const key = `${playerId}:${seasonId}`;
    if (!playerAcc.has(key)) {
      playerAcc.set(key, {
        player_id: playerId,
        season_id: seasonId,
        team_id:   teamId,
        goals_as_sub: 0, assists_as_sub: 0,
        apps_as_sub: 0, minutes_as_sub: 0,
        goals_as_starter: 0, assists_as_starter: 0,
        apps_as_starter: 0, minutes_as_starter: 0,
        subMinutes: [],    // for avg_sub_on_minute
        minutesToGoal: [], // for avg_minutes_to_goal
        fastestGoal: null,
      });
    }
    const ps = playerAcc.get(key);
    ps.apps_as_sub++;
    ps.subMinutes.push(subInfo.minute);
    // Approximate minutes played as sub (90 - sub_minute, capped)
    ps.minutes_as_sub += Math.max(0, 90 - subInfo.minute);
  }

  // Starter appearances
  for (const playerId of starterIds) {
    // Determine team from lineups entry
    const entry = lineups.find((l) => l.player_id === playerId);
    const teamId = entry?.team_id ?? homeTeamId;
    const key = `${playerId}:${seasonId}`;
    if (!playerAcc.has(key)) {
      playerAcc.set(key, {
        player_id: playerId,
        season_id: seasonId,
        team_id:   teamId,
        goals_as_sub: 0, assists_as_sub: 0,
        apps_as_sub: 0, minutes_as_sub: 0,
        goals_as_starter: 0, assists_as_starter: 0,
        apps_as_starter: 0, minutes_as_starter: 0,
        subMinutes: [],
        minutesToGoal: [],
        fastestGoal: null,
      });
    }
    const ps = playerAcc.get(key);
    ps.apps_as_starter++;
    ps.minutes_as_starter += 90; // approximate
  }

  // Supersub goals
  for (const goal of supersubGoals) {
    const key = `${goal.player_id}:${seasonId}`;
    if (!playerAcc.has(key)) continue;
    const ps = playerAcc.get(key);
    ps.goals_as_sub++;
    const subMin = subMap.get(goal.player_id)?.minute ?? 0;
    const minsAfterSub = Math.max(0, goal.minute - subMin);
    ps.minutesToGoal.push(minsAfterSub);
    if (ps.fastestGoal === null || minsAfterSub < ps.fastestGoal) {
      ps.fastestGoal = minsAfterSub;
    }
  }

  // ── 6. Accumulate team bench stats ────────────────────────────────────────
  for (const teamId of [homeTeamId, awayTeamId]) {
    if (!teamId) continue;
    const tKey = `${teamId}:${seasonId}`;
    if (!teamAcc.has(tKey)) {
      teamAcc.set(tKey, {
        team_id: teamId, season_id: seasonId,
        total_bench_goals: 0, total_bench_assists: 0,
        matches_played: 0, matches_with_bench_goal: 0, matches_with_bench_assist: 0,
        total_subs_made: 0,
        firstSubMinutes: [], secondSubMinutes: [], thirdSubMinutes: [],
        subs_before_60: 0, subs_60_to_75: 0, subs_after_75: 0,
        subs_off_gk: 0, subs_off_def: 0, subs_off_mid: 0, subs_off_fwd: 0,
        subs_on_gk: 0, subs_on_def: 0, subs_on_mid: 0, subs_on_fwd: 0,
        subs_while_winning: 0, subs_while_drawing: 0, subs_while_losing: 0,
        wins_total: 0, wins_with_bench_goal: 0,
      });
    }
    const ts = teamAcc.get(tKey);
    ts.matches_played++;

    const isHome  = teamId === homeTeamId;
    const teamWon = isHome ? homeScore > awayScore : awayScore > homeScore;
    if (teamWon) ts.wins_total++;

    // Collect team-specific subs
    const teamSubs = [...subMap.entries()]
      .filter(([, info]) => info.teamId === teamId)
      .sort(([, a], [, b]) => a.minute - b.minute);

    ts.total_subs_made += teamSubs.length;

    const teamSupersubGoals = supersubGoals.filter((g) => g.teamId === teamId);
    ts.total_bench_goals += teamSupersubGoals.length;
    if (teamSupersubGoals.length > 0) {
      ts.matches_with_bench_goal++;
      if (teamWon) ts.wins_with_bench_goal++;
    }

    // Sub timing distribution
    for (let i = 0; i < teamSubs.length; i++) {
      const [, info] = teamSubs[i];
      const min = info.minute;
      if (i === 0) ts.firstSubMinutes.push(min);
      else if (i === 1) ts.secondSubMinutes.push(min);
      else if (i === 2) ts.thirdSubMinutes.push(min);

      if (min < 60) ts.subs_before_60++;
      else if (min <= 75) ts.subs_60_to_75++;
      else ts.subs_after_75++;

      // Position buckets for player coming ON
      const [onId] = teamSubs[i];
      const onPos  = positionMap.get(onId);
      const onBucket = POSITION_BUCKET[onPos] ?? null;
      if (onBucket === 'gk')  ts.subs_on_gk++;
      else if (onBucket === 'def') ts.subs_on_def++;
      else if (onBucket === 'mid') ts.subs_on_mid++;
      else if (onBucket === 'fwd') ts.subs_on_fwd++;

      // Position bucket for player going OFF
      const offId  = info.playerOffId;
      const offPos = offId ? positionMap.get(offId) : null;
      const offBucket = POSITION_BUCKET[offPos] ?? null;
      if (offBucket === 'gk')  ts.subs_off_gk++;
      else if (offBucket === 'def') ts.subs_off_def++;
      else if (offBucket === 'mid') ts.subs_off_mid++;
      else if (offBucket === 'fwd') ts.subs_off_fwd++;

      // Match state at sub time — approximated from final score (simplification)
      // A more accurate version would require score-at-minute data
      const scoreDiff = isHome ? (homeScore - awayScore) : (awayScore - homeScore);
      if (scoreDiff > 0) ts.subs_while_winning++;
      else if (scoreDiff === 0) ts.subs_while_drawing++;
      else ts.subs_while_losing++;
    }
  }

  // ── 7. Accumulate coach stats ─────────────────────────────────────────────
  const coachTeamPairs = [
    { coachId: homeCoachId, teamId: homeTeamId, isHome: true },
    { coachId: awayCoachId, teamId: awayTeamId, isHome: false },
  ];

  for (const { coachId, teamId, isHome } of coachTeamPairs) {
    if (!coachId || !teamId) continue;

    const cKey = `${coachId}:${seasonId}`;
    if (!coachAcc.has(cKey)) {
      coachAcc.set(cKey, {
        coach_id: coachId, season_id: seasonId, team_id: teamId,
        matches_managed: 0, total_subs_made: 0,
        firstSubMinutes: [], secondSubMinutes: [], thirdSubMinutes: [],
        earliest_first_sub: null,
        subs_before_60: 0, subs_60_to_75: 0, subs_after_75: 0,
        halftime_subs: 0, early_subs: 0,
        reactive_subs_losing: 0, protective_subs_winning: 0,
        subs_off_gk: 0, subs_off_def: 0, subs_off_mid: 0, subs_off_fwd: 0,
        subs_on_gk: 0, subs_on_def: 0, subs_on_mid: 0, subs_on_fwd: 0,
        bench_goals: 0, bench_assists: 0, matches_with_bench_goal: 0,
        wins_total: 0, wins_with_early_sub: 0, wins_with_bench_goal: 0,
      });
    }
    const cs = coachAcc.get(cKey);
    cs.matches_managed++;

    const teamWon = isHome ? homeScore > awayScore : awayScore > homeScore;
    if (teamWon) cs.wins_total++;

    const teamSubs = [...subMap.entries()]
      .filter(([, info]) => info.teamId === teamId)
      .sort(([, a], [, b]) => a.minute - b.minute);

    cs.total_subs_made += teamSubs.length;

    const teamSupersubGoals = supersubGoals.filter((g) => g.teamId === teamId);
    cs.bench_goals += teamSupersubGoals.length;
    if (teamSupersubGoals.length > 0) {
      cs.matches_with_bench_goal++;
      if (teamWon) cs.wins_with_bench_goal++;
    }

    let hadEarlySub = false;
    for (let i = 0; i < teamSubs.length; i++) {
      const [onId, info] = teamSubs[i];
      const min = info.minute;

      if (i === 0) {
        cs.firstSubMinutes.push(min);
        if (cs.earliest_first_sub === null || min < cs.earliest_first_sub) {
          cs.earliest_first_sub = min;
        }
      } else if (i === 1) cs.secondSubMinutes.push(min);
      else if (i === 2) cs.thirdSubMinutes.push(min);

      if (min < 60) { cs.subs_before_60++; cs.early_subs++; hadEarlySub = true; }
      else if (min <= 75) cs.subs_60_to_75++;
      else cs.subs_after_75++;

      if (min === 45 || min === 46) cs.halftime_subs++;

      // Match state (approximated from final score)
      const scoreDiff = isHome ? (homeScore - awayScore) : (awayScore - homeScore);
      if (scoreDiff < 0) cs.reactive_subs_losing++;
      else if (scoreDiff > 0) cs.protective_subs_winning++;

      // Position buckets
      const onPos    = positionMap.get(onId);
      const onBucket = POSITION_BUCKET[onPos] ?? null;
      if (onBucket === 'gk')  cs.subs_on_gk++;
      else if (onBucket === 'def') cs.subs_on_def++;
      else if (onBucket === 'mid') cs.subs_on_mid++;
      else if (onBucket === 'fwd') cs.subs_on_fwd++;

      const offId    = info.playerOffId;
      const offPos   = offId ? positionMap.get(offId) : null;
      const offBucket = POSITION_BUCKET[offPos] ?? null;
      if (offBucket === 'gk')  cs.subs_off_gk++;
      else if (offBucket === 'def') cs.subs_off_def++;
      else if (offBucket === 'mid') cs.subs_off_mid++;
      else if (offBucket === 'fwd') cs.subs_off_fwd++;
    }

    if (hadEarlySub && teamWon) cs.wins_with_early_sub++;
  }
}

// ── Helper: compute avg of array or null ─────────────────────────────────────
function avg(arr) {
  if (!arr || arr.length === 0) return null;
  return parseFloat((arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const isFull = args.includes('--full');

  // For now, --full and no-flag behave the same.
  // TODO: Add a processed_matches tracking table to enable true incremental runs.
  if (!isFull) {
    console.log('[sync-supersub-stats] Note: running in full mode. Use --full to be explicit.');
    console.log('[sync-supersub-stats] Incremental mode requires a processed_matches table (not yet implemented).');
  }

  const db = getSupabase();

  let totalMatchesProcessed = 0;
  let totalPlayersUpdated   = 0;
  let totalTeamsUpdated     = 0;
  let totalCoachesUpdated   = 0;

  // Global accumulators across all leagues (keyed by "id:seasonId")
  const playerAcc = new Map();
  const teamAcc   = new Map();
  const coachAcc  = new Map();

  for (const league of LEAGUES) {
    console.log(`\n[sync-supersub-stats] ── ${league.name} (season ${league.season}) ──`);

    // Build position map for this season
    const { data: squadRows, error: squadErr } = await db
      .from('player_squad_cache')
      .select('player_id, position_id')
      .eq('season_id', league.season);

    if (squadErr) {
      console.error(`[sync-supersub-stats]   ✗ Failed to load squad cache:`, squadErr.message);
      continue;
    }

    const positionMap = new Map(
      (squadRows || []).map((r) => [r.player_id, r.position_id])
    );
    console.log(`[sync-supersub-stats]   Position map: ${positionMap.size} players`);

    // Fetch finished matches for this league's season
    // We filter by season via league_id since matches table stores league_id
    const { data: matches, error: matchErr } = await db
      .from('matches')
      .select('id, home_team_id, away_team_id, home_score, away_score, home_coach_id, away_coach_id, events, lineups, league_id')
      .eq('league_id', league.id)
      .in('status', ['FT', 'AET', 'FT_PEN'])
      .not('events', 'is', null);

    if (matchErr) {
      console.error(`[sync-supersub-stats]   ✗ Failed to load matches:`, matchErr.message);
      continue;
    }

    console.log(`[sync-supersub-stats]   ${(matches || []).length} finished matches with events`);

    for (const match of (matches || [])) {
      processMatch(match, positionMap, league.season, playerAcc, teamAcc, coachAcc);
      totalMatchesProcessed++;
    }
  }

  console.log(`\n[sync-supersub-stats] Processing complete. Upserting aggregated stats …`);

  // ── Upsert player_supersub_stats ─────────────────────────────────────────
  const playerRows = [];
  for (const ps of playerAcc.values()) {
    playerRows.push({
      player_id:              ps.player_id,
      season_id:              ps.season_id,
      team_id:                ps.team_id,
      goals_as_sub:           ps.goals_as_sub,
      assists_as_sub:         ps.assists_as_sub,
      apps_as_sub:            ps.apps_as_sub,
      minutes_as_sub:         ps.minutes_as_sub,
      goals_as_starter:       ps.goals_as_starter,
      assists_as_starter:     ps.assists_as_starter,
      apps_as_starter:        ps.apps_as_starter,
      minutes_as_starter:     ps.minutes_as_starter,
      avg_sub_on_minute:      avg(ps.subMinutes),
      earliest_sub_on:        ps.subMinutes.length > 0 ? Math.min(...ps.subMinutes) : null,
      latest_sub_on:          ps.subMinutes.length > 0 ? Math.max(...ps.subMinutes) : null,
      avg_minutes_to_goal:    avg(ps.minutesToGoal),
      fastest_goal_after_sub: ps.fastestGoal,
      last_updated:           new Date().toISOString(),
    });
  }

  if (playerRows.length > 0) {
    const BATCH = 500;
    for (let i = 0; i < playerRows.length; i += BATCH) {
      const chunk = playerRows.slice(i, i + BATCH);
      const { error } = await db
        .from('player_supersub_stats')
        .upsert(chunk, { onConflict: 'player_id,season_id' });
      if (error) {
        console.error('[sync-supersub-stats]   ✗ player_supersub_stats upsert error:', error.message);
      } else {
        totalPlayersUpdated += chunk.length;
      }
    }
    console.log(`[sync-supersub-stats]   ✓ ${totalPlayersUpdated} player rows upserted`);
  }

  // ── Upsert team_bench_stats ───────────────────────────────────────────────
  const teamRows = [];
  for (const ts of teamAcc.values()) {
    teamRows.push({
      team_id:                   ts.team_id,
      season_id:                 ts.season_id,
      total_bench_goals:         ts.total_bench_goals,
      total_bench_assists:       ts.total_bench_assists,
      matches_played:            ts.matches_played,
      matches_with_bench_goal:   ts.matches_with_bench_goal,
      matches_with_bench_assist: ts.matches_with_bench_assist,
      total_subs_made:           ts.total_subs_made,
      avg_first_sub_minute:      avg(ts.firstSubMinutes),
      avg_second_sub_minute:     avg(ts.secondSubMinutes),
      avg_third_sub_minute:      avg(ts.thirdSubMinutes),
      subs_before_60:            ts.subs_before_60,
      subs_60_to_75:             ts.subs_60_to_75,
      subs_after_75:             ts.subs_after_75,
      subs_off_gk:               ts.subs_off_gk,
      subs_off_def:              ts.subs_off_def,
      subs_off_mid:              ts.subs_off_mid,
      subs_off_fwd:              ts.subs_off_fwd,
      subs_on_gk:                ts.subs_on_gk,
      subs_on_def:               ts.subs_on_def,
      subs_on_mid:               ts.subs_on_mid,
      subs_on_fwd:               ts.subs_on_fwd,
      subs_while_winning:        ts.subs_while_winning,
      subs_while_drawing:        ts.subs_while_drawing,
      subs_while_losing:         ts.subs_while_losing,
      wins_total:                ts.wins_total,
      wins_with_bench_goal:      ts.wins_with_bench_goal,
      last_updated:              new Date().toISOString(),
    });
  }

  if (teamRows.length > 0) {
    const { error } = await db
      .from('team_bench_stats')
      .upsert(teamRows, { onConflict: 'team_id,season_id' });
    if (error) {
      console.error('[sync-supersub-stats]   ✗ team_bench_stats upsert error:', error.message);
    } else {
      totalTeamsUpdated = teamRows.length;
      console.log(`[sync-supersub-stats]   ✓ ${totalTeamsUpdated} team rows upserted`);
    }
  }

  // ── Upsert coach_substitution_patterns ───────────────────────────────────
  const coachRows = [];
  for (const cs of coachAcc.values()) {
    if (!cs.coach_id) continue; // skip null coach_id
    coachRows.push({
      coach_id:                cs.coach_id,
      season_id:               cs.season_id,
      team_id:                 cs.team_id,
      matches_managed:         cs.matches_managed,
      total_subs_made:         cs.total_subs_made,
      avg_first_sub_minute:    avg(cs.firstSubMinutes),
      avg_second_sub_minute:   avg(cs.secondSubMinutes),
      avg_third_sub_minute:    avg(cs.thirdSubMinutes),
      earliest_first_sub:      cs.earliest_first_sub,
      subs_before_60:          cs.subs_before_60,
      subs_60_to_75:           cs.subs_60_to_75,
      subs_after_75:           cs.subs_after_75,
      halftime_subs:           cs.halftime_subs,
      early_subs:              cs.early_subs,
      reactive_subs_losing:    cs.reactive_subs_losing,
      protective_subs_winning: cs.protective_subs_winning,
      subs_off_gk:             cs.subs_off_gk,
      subs_off_def:            cs.subs_off_def,
      subs_off_mid:            cs.subs_off_mid,
      subs_off_fwd:            cs.subs_off_fwd,
      subs_on_gk:              cs.subs_on_gk,
      subs_on_def:             cs.subs_on_def,
      subs_on_mid:             cs.subs_on_mid,
      subs_on_fwd:             cs.subs_on_fwd,
      bench_goals:             cs.bench_goals,
      bench_assists:           cs.bench_assists,
      matches_with_bench_goal: cs.matches_with_bench_goal,
      wins_total:              cs.wins_total,
      wins_with_early_sub:     cs.wins_with_early_sub,
      wins_with_bench_goal:    cs.wins_with_bench_goal,
      last_updated:            new Date().toISOString(),
    });
  }

  if (coachRows.length > 0) {
    const { error } = await db
      .from('coach_substitution_patterns')
      .upsert(coachRows, { onConflict: 'coach_id,season_id' });
    if (error) {
      console.error('[sync-supersub-stats]   ✗ coach_substitution_patterns upsert error:', error.message);
    } else {
      totalCoachesUpdated = coachRows.length;
      console.log(`[sync-supersub-stats]   ✓ ${totalCoachesUpdated} coach rows upserted`);
    }
  }

  // ── End-of-run summary ─────────────────────────────────────────────────────
  console.log('\n[sync-supersub-stats] ─── Summary ─────────────────────────────────');
  console.log(`[sync-supersub-stats]   Matches processed: ${totalMatchesProcessed}`);
  console.log(`[sync-supersub-stats]   Players updated  : ${totalPlayersUpdated}`);
  console.log(`[sync-supersub-stats]   Teams updated    : ${totalTeamsUpdated}`);
  console.log(`[sync-supersub-stats]   Coaches updated  : ${totalCoachesUpdated}`);
  console.log('[sync-supersub-stats] ────────────────────────────────────────────────');
}

main().catch((err) => {
  console.error('[sync-supersub-stats] ✗ Fatal error:', err.message);
  process.exit(1);
});
