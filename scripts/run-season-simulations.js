#!/usr/bin/env node
// scripts/run-season-simulations.js
// Usage: node scripts/run-season-simulations.js
//
// For each supported league + current season, simulate the rest of the
// season 10,000 times by sampling each remaining fixture's outcome from
// the per-match Monte Carlo distribution stored in match_simulations.
// Aggregates: title / top-4 / relegation / expected final points.
// Upserts into season_probabilities. No Sportmonks API calls.
//
// Prerequisite: scripts/run-match-simulations.js must have run recently —
// the season sim is only as fresh as match_simulations.

import { createClient } from '@supabase/supabase-js';
import { resolveLeagueContext } from '../lib/statsGen/resolveSeason.js';

const PREFIX = '[run-season-simulations]';
const SUPPORTED_LEAGUE_IDS = [8, 301, 82, 564, 384];
const ITERATIONS = 10000;
const TERMINAL = ['FT', 'AET', 'FT_PEN', 'POSTPONED', 'CANCELLED', 'ABANDONED', 'AWARDED', 'WO', 'DELETED'];
const TOP_4_CUTOFF = 4;
const RELEGATION_CUTOFF_FROM_BOTTOM = 3;

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

/**
 * Sample a single fixture outcome ('H' | 'D' | 'A') from per-match
 * (home_win, draw, away_win) probabilities. Robust to slight rounding
 * (probabilities not summing to exactly 1).
 */
function sampleOutcome(pHome, pDraw, pAway) {
  const total = pHome + pDraw + pAway;
  const r = Math.random() * total;
  if (r < pHome) return 'H';
  if (r < pHome + pDraw) return 'D';
  return 'A';
}

// Form-based fallback for fixtures lacking a Sportmonks-calibrated sim row.
// match_intel only covers the next 14 days, so end-of-season fixtures fall
// outside the per-match sim window. Without a fallback they were silently
// skipped, which collapsed the season simulation: every team got their
// current points back ± a tiny variance, and the league leader took the
// title in 100% of iterations.
//
// This model is deliberately simple — relative season-to-date PPG, a fixed
// home-field nudge, a constant draw weight. Far less sharp than the Poisson
// path, but FAR better than no signal at all.
const HOME_ADVANTAGE = 1.15;
const DRAW_BASE = 0.8;

function fallbackFixtureProbabilities(homePpg, awayPpg, leagueAvgPpg) {
  const safeAvg = leagueAvgPpg > 0 ? leagueAvgPpg : 1; // avoid div-by-zero pre-season
  const homeStrength = (homePpg / safeAvg) * HOME_ADVANTAGE;
  const awayStrength = (awayPpg / safeAvg);
  const denom = homeStrength + awayStrength + DRAW_BASE;
  return {
    pHome: homeStrength / denom,
    pDraw: DRAW_BASE     / denom,
    pAway: awayStrength  / denom,
  };
}

async function simulateLeague(supabase, leagueSmId) {
  const ctx = await resolveLeagueContext(supabase, leagueSmId);
  if (!ctx.season_uuid || !ctx.season_sm_id) {
    console.log(`${PREFIX}   ✗ league ${leagueSmId}: season unresolved — skipping`);
    return { league: leagueSmId, skipped: true };
  }

  // 1. Current standings (team_id + season_id are UUIDs in this table)
  // `played` is needed to compute PPG for the form-based fallback model.
  const { data: standings, error: stErr } = await supabase
    .from('standings')
    .select('team_id, position, played, points, goals_for, goals_against')
    .eq('season_id', ctx.season_uuid);
  if (stErr) throw new Error(`standings: ${stErr.message}`);
  if (!standings?.length) {
    console.log(`${PREFIX}   ✗ league ${leagueSmId}: no standings rows — skipping`);
    return { league: leagueSmId, skipped: true };
  }

  // 2. UUID → Sportmonks integer ID + name + logo for the league's teams
  const teamUuids = standings.map(s => s.team_id);
  const { data: teamRows } = await supabase
    .from('teams')
    .select('id, sportmonks_id, name, logo_url')
    .in('id', teamUuids);
  const byUuid = Object.fromEntries((teamRows || []).map(t => [t.id, t]));

  // 3. Build per-team baseline: { sportmonksId, name, logo, currentPoints, currentPos, gd, ppg }
  const teams = standings
    .map(s => {
      const t = byUuid[s.team_id];
      if (!t?.sportmonks_id) return null;
      const played = s.played || 0;
      const points = s.points || 0;
      return {
        teamUuid: s.team_id,
        teamSmId: t.sportmonks_id,
        teamName: t.name,
        teamLogo: t.logo_url,
        currentPos: s.position,
        currentPoints: points,
        gd: (s.goals_for || 0) - (s.goals_against || 0),
        // Played-zero (pre-season) → fall back to league-average later.
        ppg: played > 0 ? points / played : null,
      };
    })
    .filter(Boolean);

  if (teams.length === 0) {
    console.log(`${PREFIX}   ✗ league ${leagueSmId}: no teams resolvable — skipping`);
    return { league: leagueSmId, skipped: true };
  }

  // 4. Remaining fixtures (non-terminal status) for this league + their sims
  const { data: remainingMatches } = await supabase
    .from('matches')
    .select('id, home_team_id, away_team_id, status')
    .eq('league_id', leagueSmId)
    .not('status', 'in', `(${TERMINAL.join(',')})`);

  const remainingIds = (remainingMatches || []).map(m => m.id);
  const { data: simRows } = remainingIds.length
    ? await supabase
        .from('match_simulations')
        .select('fixture_id, home_team_id, away_team_id, home_win_probability, draw_probability, away_win_probability')
        .in('fixture_id', remainingIds)
    : { data: [] };

  const simByFixture = new Map((simRows || []).map(s => [s.fixture_id, s]));

  // Build the per-fixture probability source. PREFER the Sportmonks-calibrated
  // sim from match_simulations; FALL BACK to a form-based model for fixtures
  // outside the 14-day intel window. The previous version silently skipped
  // fallback fixtures entirely, which made the season sim collapse to
  // "current standings ± tiny variance" → leader = 100% title prob.
  const teamIdx = new Map(teams.map((t, i) => [t.teamSmId, i]));
  const ppgValues = teams.map(t => t.ppg).filter(v => v != null);
  const leagueAvgPpg = ppgValues.length > 0
    ? ppgValues.reduce((a, b) => a + b, 0) / ppgValues.length
    : 1.4; // sane default if mid-season standings are missing 'played'

  const probsByFixture = new Map();
  let withSim = 0;
  let withFallback = 0;

  for (const fx of (remainingMatches || [])) {
    const sim = simByFixture.get(fx.id);
    if (sim) {
      probsByFixture.set(fx.id, {
        pHome:    Number(sim.home_win_probability),
        pDraw:    Number(sim.draw_probability),
        pAway:    Number(sim.away_win_probability),
        homeTeam: sim.home_team_id ?? fx.home_team_id,
        awayTeam: sim.away_team_id ?? fx.away_team_id,
        source:   'sportmonks',
      });
      withSim++;
      continue;
    }
    // Fallback path
    const homeIdxF = teamIdx.get(fx.home_team_id);
    const awayIdxF = teamIdx.get(fx.away_team_id);
    if (homeIdxF == null || awayIdxF == null) continue; // unknown team — can't model
    const homePpg = teams[homeIdxF].ppg ?? leagueAvgPpg;
    const awayPpg = teams[awayIdxF].ppg ?? leagueAvgPpg;
    const { pHome, pDraw, pAway } = fallbackFixtureProbabilities(homePpg, awayPpg, leagueAvgPpg);
    probsByFixture.set(fx.id, {
      pHome, pDraw, pAway,
      homeTeam: fx.home_team_id,
      awayTeam: fx.away_team_id,
      source: 'fallback',
    });
    withFallback++;
  }

  const totalRemaining = (remainingMatches || []).length;
  if (withFallback > 0) {
    console.log(`${PREFIX}   ℹ league ${leagueSmId}: ${withSim}/${totalRemaining} fixtures use Sportmonks-calibrated sims; ${withFallback} use form-based fallback (outside 14-day intel window).`);
  }

  // 5. Run iterations
  const finalPoints = new Array(teams.length).fill(0);
  const titleCount  = new Array(teams.length).fill(0);
  const top4Count   = new Array(teams.length).fill(0);
  const relegCount  = new Array(teams.length).fill(0);

  // Tiebreak (deterministic in any single iteration): final points → current GD → current position
  // We don't simulate goal totals so GD is constant across iterations — this is the best v1 has.
  const compareForRanking = (a, b) => {
    if (b.simPoints !== a.simPoints) return b.simPoints - a.simPoints;
    if (b.gd !== a.gd) return b.gd - a.gd;
    return a.currentPos - b.currentPos;
  };

  for (let it = 0; it < ITERATIONS; it++) {
    const simState = teams.map(t => ({ ...t, simPoints: t.currentPoints }));

    for (const probs of probsByFixture.values()) {
      const outcome = sampleOutcome(probs.pHome, probs.pDraw, probs.pAway);
      const homeIdx = teamIdx.get(probs.homeTeam);
      const awayIdx = teamIdx.get(probs.awayTeam);
      if (homeIdx == null || awayIdx == null) continue;

      if (outcome === 'H') simState[homeIdx].simPoints += 3;
      else if (outcome === 'A') simState[awayIdx].simPoints += 3;
      else { simState[homeIdx].simPoints += 1; simState[awayIdx].simPoints += 1; }
    }

    simState.sort(compareForRanking);
    for (let rank = 0; rank < simState.length; rank++) {
      const idx = teamIdx.get(simState[rank].teamSmId);
      if (idx == null) continue;
      finalPoints[idx] += simState[rank].simPoints;
      if (rank === 0) titleCount[idx]++;
      if (rank < TOP_4_CUTOFF) top4Count[idx]++;
      if (rank >= simState.length - RELEGATION_CUTOFF_FROM_BOTTOM) relegCount[idx]++;
    }
  }

  // 6. Build + upsert rows
  const computedAt = new Date().toISOString();
  const rows = teams.map((t, i) => ({
    league_id:              leagueSmId,
    season_id:              ctx.season_sm_id,
    team_id:                t.teamSmId,
    team_name:              t.teamName,
    team_logo:              t.teamLogo,
    current_position:       t.currentPos,
    current_points:         t.currentPoints,
    expected_final_points:  Number((finalPoints[i] / ITERATIONS).toFixed(2)),
    title_probability:      Number((titleCount[i] / ITERATIONS).toFixed(4)),
    top_4_probability:      Number((top4Count[i] / ITERATIONS).toFixed(4)),
    relegation_probability: Number((relegCount[i] / ITERATIONS).toFixed(4)),
    computed_at:            computedAt,
  }));

  // Upsert in batches to stay under PostgREST limits
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from('season_probabilities')
      .upsert(chunk, { onConflict: 'league_id,season_id,team_id' });
    if (error) throw new Error(`upsert: ${error.message}`);
  }

  return {
    league: leagueSmId,
    leagueName: ctx.league_name,
    fixturesWithSim: withSim,
    fixturesFallback: withFallback,
    fixturesTotal: totalRemaining,
    teams: rows.length,
  };
}

async function run() {
  const supabase = getSupabase();
  const t0 = Date.now();
  const summaries = [];

  for (const lid of SUPPORTED_LEAGUE_IDS) {
    const t1 = Date.now();
    try {
      const summary = await simulateLeague(supabase, lid);
      const dt = ((Date.now() - t1) / 1000).toFixed(1);
      if (summary.skipped) {
        console.log(`${PREFIX} league ${lid}: skipped (${dt}s)`);
      } else {
        console.log(`${PREFIX} league ${lid} (${summary.leagueName}): ${summary.teams} teams, ${summary.fixturesWithSim} sportmonks-sims + ${summary.fixturesFallback} fallback (${summary.fixturesTotal} total) — ${dt}s`);
      }
      summaries.push(summary);
    } catch (err) {
      console.error(`${PREFIX} league ${lid}: ${err.message}`);
      summaries.push({ league: lid, error: err.message });
    }
  }

  const total = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`${PREFIX}`);
  console.log(`${PREFIX} ─── Summary ───────────────────────────────`);
  console.log(`${PREFIX}   Total compute time: ${total}s`);
  for (const s of summaries) {
    if (s.skipped) console.log(`${PREFIX}   league ${s.league}: SKIPPED`);
    else if (s.error) console.log(`${PREFIX}   league ${s.league}: ERROR ${s.error}`);
    else console.log(`${PREFIX}   league ${s.league}: ${s.teams} teams, ${s.fixturesWithSim} sportmonks + ${s.fixturesFallback} fallback`);
  }
  console.log(`${PREFIX} ────────────────────────────────────────────`);
}

const isMain = process.argv[1]?.endsWith('run-season-simulations.js');
if (isMain) {
  const { default: dotenv } = await import('dotenv');
  dotenv.config();
  dotenv.config({ path: '.env.local', override: false });
  run().catch(err => {
    console.error(`${PREFIX} Fatal:`, err);
    process.exit(1);
  });
}

export { run };
