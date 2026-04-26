#!/usr/bin/env node
// scripts/run-match-simulations.js
// Usage:
//   node scripts/run-match-simulations.js                  # all upcoming intel'd fixtures
//   node scripts/run-match-simulations.js --fixture=<id>   # single fixture (post-hook mode)
//
// For each upcoming fixture with usable Sportmonks W/D/L probabilities in
// match_intel.report_sections.commandOfPitch, derive Poisson lambdas via
// calibration, run a 10k Monte Carlo simulation, and upsert into
// match_simulations. No Sportmonks API calls — pure local compute.

import { createClient } from '@supabase/supabase-js';
import { simulateMatch, calibrateLambdas } from '../lib/simulation/engine.js';
import { resolveSeasonSmId } from '../lib/statsGen/resolveSeason.js';

const PREFIX = '[run-match-simulations]';
const TERMINAL = ['FT', 'AET', 'FT_PEN', 'POSTPONED', 'CANCELLED', 'ABANDONED', 'AWARDED', 'WO', 'DELETED'];

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

/**
 * Pull commandOfPitch (FULLTIME_1X2 = type_id 233) probabilities from
 * stored intel. Returns null if the section is missing or unavailable.
 * Sportmonks values are integer percentages 0-100; we convert to 0..1.
 */
function extractWdlProbabilities(intel) {
  const cop = intel?.report_sections?.commandOfPitch;
  if (!cop?.available || !cop.data) return null;
  const { home, draw, away } = cop.data;
  if (typeof home !== 'number' || typeof draw !== 'number' || typeof away !== 'number') return null;
  return {
    pHomeWin: home / 100,
    pDraw:    draw / 100,
    pAwayWin: away / 100,
  };
}

/**
 * Run + persist a simulation for a single fixture. Returns
 * { ok: true, simulation } on success, { ok: false, reason } otherwise.
 * Exposed for the post-hook in scripts/sync-match-intel.js.
 */
export async function simulateOne(supabase, match, intel) {
  const wdl = extractWdlProbabilities(intel);
  if (!wdl) return { ok: false, reason: 'no_wdl_in_intel' };

  const { homeLambda, awayLambda } = calibrateLambdas(wdl);
  const sim = simulateMatch(homeLambda, awayLambda, 10000);

  // Resolve current season's Sportmonks integer ID for the fixture's league
  const seasonSmId = await resolveSeasonSmId(supabase, match.league_id);
  if (!seasonSmId) return { ok: false, reason: 'season_unresolved' };

  // Post-hoc warning on large delta vs Sportmonks O/U 2.5 (non-Poisson
  // goal distribution). Threshold 10pp per spec.
  const sportmonksOver25 = intel?.report_sections?.totalGoalOutlook?.data?.over25;
  if (typeof sportmonksOver25 === 'number') {
    const delta = Math.abs(sim.over_2_5_probability * 100 - sportmonksOver25);
    if (delta > 10) {
      console.log(`${PREFIX}   ⚠ ${match.home_team} v ${match.away_team}: O/U 2.5 delta ${delta.toFixed(1)}pp (sim=${(sim.over_2_5_probability*100).toFixed(0)}%, sportmonks=${sportmonksOver25}%) — likely non-Poisson goal profile`);
    }
  }

  const row = {
    fixture_id:    match.id,
    home_team_id:  match.home_team_id,
    away_team_id:  match.away_team_id,
    league_id:     match.league_id,
    season_id:     seasonSmId,
    ...sim,
    inputs_source: 'sportmonks_baseline',
    computed_at:   new Date().toISOString(),
  };

  const { error } = await supabase
    .from('match_simulations')
    .upsert(row, { onConflict: 'fixture_id' });

  if (error) return { ok: false, reason: 'db_upsert_failed', error: error.message };
  return { ok: true, simulation: row };
}

async function run({ fixtureId = null } = {}) {
  const supabase = getSupabase();
  const t0 = Date.now();

  // Pull intel rows + their matches. If --fixture given, scope to one.
  let intelQuery = supabase
    .from('match_intel')
    .select('match_id, report_sections');
  if (fixtureId) intelQuery = intelQuery.eq('match_id', fixtureId);

  const { data: intelRows, error: intelErr } = await intelQuery;
  if (intelErr) throw new Error(`intel select failed: ${intelErr.message}`);

  if (!intelRows?.length) {
    console.log(`${PREFIX} No match_intel rows to process${fixtureId ? ` for fixture ${fixtureId}` : ''}.`);
    return;
  }

  const matchIds = intelRows.map(r => r.match_id);
  const { data: matchRows, error: matchErr } = await supabase
    .from('matches')
    .select('id, home_team, away_team, home_team_id, away_team_id, league_id, status')
    .in('id', matchIds);
  if (matchErr) throw new Error(`matches select failed: ${matchErr.message}`);

  const matchById = new Map((matchRows || []).map(m => [m.id, m]));
  const intelByMatch = new Map(intelRows.map(r => [r.match_id, r]));

  // Filter: keep only fixtures that aren't terminal (no point simulating
  // a finished match — wasted compute).
  const candidates = matchIds
    .map(id => ({ match: matchById.get(id), intel: intelByMatch.get(id) }))
    .filter(({ match }) => match && !TERMINAL.includes(match.status));

  console.log(`${PREFIX} ${intelRows.length} intel rows; ${candidates.length} non-terminal candidates to simulate.`);

  let success = 0;
  let skipped = 0;
  let failed  = 0;

  for (let i = 0; i < candidates.length; i++) {
    const { match, intel } = candidates[i];
    const result = await simulateOne(supabase, match, intel);
    if (result.ok) {
      success++;
    } else if (result.reason === 'no_wdl_in_intel' || result.reason === 'season_unresolved') {
      skipped++;
    } else {
      failed++;
      console.warn(`${PREFIX}   ✗ ${match.id} ${match.home_team} v ${match.away_team}: ${result.reason} ${result.error || ''}`);
    }

    if ((i + 1) % 50 === 0 || i === candidates.length - 1) {
      console.log(`${PREFIX}   progress: ${i + 1}/${candidates.length} (ok=${success}, skip=${skipped}, fail=${failed})`);
    }
  }

  const seconds = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`${PREFIX}`);
  console.log(`${PREFIX} ─── Summary ───────────────────────────────`);
  console.log(`${PREFIX}   Candidates    : ${candidates.length}`);
  console.log(`${PREFIX}   Simulated     : ${success}`);
  console.log(`${PREFIX}   Skipped       : ${skipped}  (no W/D/L data or season unresolved)`);
  console.log(`${PREFIX}   Failed        : ${failed}`);
  console.log(`${PREFIX}   Wall time     : ${seconds}s`);
  console.log(`${PREFIX} ────────────────────────────────────────────`);
}

// CLI
const isMain = process.argv[1]?.endsWith('run-match-simulations.js');
if (isMain) {
  const { default: dotenv } = await import('dotenv');
  dotenv.config();
  dotenv.config({ path: '.env.local', override: false });

  const fixArg = process.argv.find(a => a.startsWith('--fixture='));
  const fixtureId = fixArg ? parseInt(fixArg.split('=')[1], 10) : null;

  run({ fixtureId }).catch(err => {
    console.error(`${PREFIX} Fatal:`, err);
    process.exit(1);
  });
}

export { run };
