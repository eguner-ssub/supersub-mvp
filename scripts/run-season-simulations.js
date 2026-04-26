#!/usr/bin/env node
// scripts/run-season-simulations.js
// Usage: node scripts/run-season-simulations.js
//
// For each supported league + current season, simulate the rest of the
// season 10,000 times by sampling each remaining fixture's outcome from
// SportMonks W/D/L predictions stored in match_intel.report_sections.
// Aggregates: title / top-4 / relegation / expected final points.
// Upserts into season_probabilities. No Sportmonks API calls inside the
// loop (intel is already pre-synced); standings are refreshed once per
// league at the start.
//
// 2026-04 ARCHITECTURE PIVOT: this script previously read W/D/L from the
// match_simulations table (per-fixture Monte Carlo). It now reads
// match_intel.report_sections.commandOfPitch.data directly. Same SportMonks
// 1X2 numbers, one less hop, no editorial drift between this and the
// match-probabilities API. Fixtures without intel (outside the 14-day
// sync window) are SKIPPED with a warning — the simulation under-counts
// remaining fixtures rather than inventing data with a fallback model.
// See scripts/_archived/README.md for the Monte Carlo revival path.

import { createClient } from '@supabase/supabase-js';
import { resolveLeagueContext } from '../lib/statsGen/resolveSeason.js';
import { syncStandingsForLeague } from './sync-standings.js';

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

async function simulateLeague(supabase, leagueSmId) {
  const ctx = await resolveLeagueContext(supabase, leagueSmId);
  if (!ctx.season_uuid || !ctx.season_sm_id) {
    console.log(`${PREFIX}   ✗ league ${leagueSmId}: season unresolved — skipping`);
    return { league: leagueSmId, skipped: true };
  }

  // 0. ALWAYS refresh standings before reading them. sim:seasons runs daily at
  // 02:00 UTC — a guaranteed fresh fetch ensures the simulation operates on
  // current data regardless of what the lazy /api/league refresh has done.
  // Failures are logged but non-fatal — proceed with whatever standings exist.
  console.log(`${PREFIX} League ${leagueSmId} — refreshing standings before simulation`);
  try {
    const { standings, topScorers } = await syncStandingsForLeague(supabase, leagueSmId);
    console.log(`${PREFIX} League ${leagueSmId} — standings synced (${standings} rows, ${topScorers} top scorers)`);
  } catch (err) {
    console.warn(`${PREFIX} League ${leagueSmId} — standings sync failed (${err.message}); proceeding with existing data`);
  }

  // 1. Current standings (team_id + season_id are UUIDs in this table)
  const { data: standings, error: stErr } = await supabase
    .from('standings')
    .select('team_id, position, points, goals_for, goals_against')
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

  // 3. Build per-team baseline: { sportmonksId, name, logo, currentPoints, currentPos, gd }
  const teams = standings
    .map(s => {
      const t = byUuid[s.team_id];
      if (!t?.sportmonks_id) return null;
      const points = s.points || 0;
      return {
        teamUuid: s.team_id,
        teamSmId: t.sportmonks_id,
        teamName: t.name,
        teamLogo: t.logo_url,
        currentPos: s.position,
        currentPoints: points,
        gd: (s.goals_for || 0) - (s.goals_against || 0),
      };
    })
    .filter(Boolean);

  if (teams.length === 0) {
    console.log(`${PREFIX}   ✗ league ${leagueSmId}: no teams resolvable — skipping`);
    return { league: leagueSmId, skipped: true };
  }

  // 4. Remaining fixtures (non-terminal status) for this league.
  const { data: remainingMatches } = await supabase
    .from('matches')
    .select('id, home_team_id, away_team_id, status')
    .eq('league_id', leagueSmId)
    .not('status', 'in', `(${TERMINAL.join(',')})`);

  const remainingIds = (remainingMatches || []).map(m => m.id);

  // Pull match_intel rows for those fixtures. We only need report_sections
  // (specifically commandOfPitch.data with home/draw/away SportMonks 1X2
  // predictions, integer 0-100).
  const { data: intelRows } = remainingIds.length
    ? await supabase
        .from('match_intel')
        .select('match_id, report_sections')
        .in('match_id', remainingIds)
    : { data: [] };

  const intelByFixture = new Map((intelRows || []).map(r => [r.match_id, r]));

  // Per-fixture probability source: ONLY SportMonks W/D/L from intel. If
  // commandOfPitch isn't available for a fixture (no intel row OR section
  // unavailable), SKIP that fixture with a warning. No PPG/coin-flip
  // fallback — better to under-count remaining fixtures than to invent
  // probabilities. As more fixtures roll into the 14-day intel window via
  // sync-match-intel cron, season sim coverage improves automatically.
  const teamIdx = new Map(teams.map((t, i) => [t.teamSmId, i]));
  const probsByFixture = new Map();
  let withIntel = 0;
  let skipped = 0;

  for (const fx of (remainingMatches || [])) {
    const intel = intelByFixture.get(fx.id);
    const cop = intel?.report_sections?.commandOfPitch;
    if (!cop?.available || !cop.data) {
      skipped++;
      continue;
    }
    const { home, draw, away } = cop.data;
    if (typeof home !== 'number' || typeof draw !== 'number' || typeof away !== 'number') {
      skipped++;
      continue;
    }

    // commandOfPitch values are 0-100 integers; sampleOutcome works on any
    // positive units (it normalises by total), but we keep them in 0-100 to
    // avoid floating-point drift.
    probsByFixture.set(fx.id, {
      pHome: home,
      pDraw: draw,
      pAway: away,
      homeTeam: fx.home_team_id,
      awayTeam: fx.away_team_id,
    });
    withIntel++;
  }

  const totalRemaining = (remainingMatches || []).length;
  if (skipped > 0) {
    console.log(`${PREFIX}   ⚠ league ${leagueSmId}: ${skipped}/${totalRemaining} remaining fixtures lack intel (commandOfPitch unavailable) — skipped with no fallback. Run sync-match-intel to backfill.`);
  }
  console.log(`${PREFIX}   ℹ league ${leagueSmId}: ${withIntel}/${totalRemaining} fixtures sampled from match_intel.commandOfPitch.`);

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
    fixturesSampled: withIntel,
    fixturesSkipped: skipped,
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
        console.log(`${PREFIX} league ${lid} (${summary.leagueName}): ${summary.teams} teams, ${summary.fixturesSampled}/${summary.fixturesTotal} fixtures sampled from intel (${summary.fixturesSkipped} skipped) — ${dt}s`);
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
    else console.log(`${PREFIX}   league ${s.league}: ${s.teams} teams, ${s.fixturesSampled}/${s.fixturesTotal} sampled (${s.fixturesSkipped} skipped)`);
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
