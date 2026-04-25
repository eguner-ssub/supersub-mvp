// GET /api/stats-gen/match-probabilities?fixture_id=X
// Param: `fixture_id` — matches the convention used across the rest of the
// stats-gen surface (banker, h2h, lineups, over-under, referee-watch, etc.).
//
// Editorial framing of the per-match Monte Carlo simulation results.
//
// CRITICAL: editorial language only. No "odds", "bet", "bookmaker",
// "value", "edge", "tip" anywhere. Always "chance" or "probability".
// Frame as analytical insight, never betting advice.
//
// Reads from match_simulations. If no simulation exists for the fixture
// (e.g. intel was just synced and the post-hook hasn't run), falls back
// to deriving from match_intel + flags simulation_pending: true.

import { requireStatsGenToken, getSupabase } from '../auth.js';
import { simulateMatch, calibrateLambdas } from '../../simulation/engine.js';

// ─── Narrative templates ─────────────────────────────────────────────────────

function generateResultHeadline(home, draw, away, homeTeam, awayTeam) {
  const max = Math.max(home, draw, away);
  const min = Math.min(home, draw, away);
  if (max - min < 0.10) {
    return `${homeTeam} v ${awayTeam} looks tight — all three results are in play.`;
  }
  if (home === max && home > 0.50) {
    return `${homeTeam} are clear favourites — ${Math.round(home * 100)}% chance of winning, with ${awayTeam} at ${Math.round(away * 100)}%.`;
  }
  if (away === max && away > 0.50) {
    return `${awayTeam} are clear favourites — ${Math.round(away * 100)}% chance of winning, with ${homeTeam} at ${Math.round(home * 100)}%.`;
  }
  if (home === max) {
    return `${homeTeam} are favoured — ${Math.round(home * 100)}% chance of winning, but the door is open at ${Math.round(draw * 100)}% draw and ${Math.round(away * 100)}% ${awayTeam}.`;
  }
  if (away === max) {
    return `${awayTeam} are favoured — ${Math.round(away * 100)}% chance of winning, with ${homeTeam} at ${Math.round(home * 100)}%.`;
  }
  if (draw === max) {
    return `Draw is the most likely outcome at ${Math.round(draw * 100)}% — neither side has a clear advantage.`;
  }
  return `${homeTeam} v ${awayTeam}: ${Math.round(home * 100)}% / ${Math.round(draw * 100)}% / ${Math.round(away * 100)}%.`;
}

function generateGoalsNarrative(expectedTotal, over25) {
  const o25Pct = Math.round(over25 * 100);
  if (over25 >= 0.65) {
    return `Goals look likely — the model expects ${expectedTotal.toFixed(1)} on average, with a ${o25Pct}% chance of more than 2.5.`;
  }
  if (over25 >= 0.50) {
    return `A balanced goals outlook — the model expects ${expectedTotal.toFixed(1)} on average, with a ${o25Pct}% chance of more than 2.5.`;
  }
  return `A cagey affair is on the cards — the model expects only ${expectedTotal.toFixed(1)} goals, with just ${o25Pct}% chance of going over 2.5.`;
}

function generateBttsNarrative(p) {
  const pct = Math.round(p * 100);
  if (p >= 0.70) return `Both teams scoring is highly likely — ${pct}%.`;
  if (p >= 0.50) return `Both teams scoring is the more likely outcome at ${pct}%.`;
  if (p >= 0.35) return `Both teams scoring is plausible but not the favourite at ${pct}%.`;
  return `At least one clean sheet looks likely — only ${pct}% chance both teams score.`;
}

function generateMatchSummary(home, draw, away, homeTeam, awayTeam) {
  const max = Math.max(home, draw, away);
  if (home === max) {
    return `${homeTeam} are the favourites — ${Math.round(home * 100)}% chance of winning, with ${awayTeam} at ${Math.round(away * 100)}% and a ${Math.round(draw * 100)}% chance of a draw.`;
  }
  if (away === max) {
    return `${awayTeam} are the favourites — ${Math.round(away * 100)}% chance of winning, with ${homeTeam} at ${Math.round(home * 100)}% and a ${Math.round(draw * 100)}% chance of a draw.`;
  }
  return `Draw is the most likely outcome at ${Math.round(draw * 100)}%, with ${homeTeam} at ${Math.round(home * 100)}% and ${awayTeam} at ${Math.round(away * 100)}%.`;
}

// ─── Match-intel fallback ────────────────────────────────────────────────────
// When match_simulations has no row yet, run a one-shot simulation in-process
// (no DB write) using the intel data. Lets the endpoint stay functional in
// the gap between an intel sync and the next sim:matches run.
async function fallbackFromIntel(supabase, fixtureId) {
  const { data: intel } = await supabase
    .from('match_intel').select('report_sections').eq('match_id', fixtureId).maybeSingle();
  const cop = intel?.report_sections?.commandOfPitch;
  if (!cop?.available || !cop.data) return null;
  const { home, draw, away } = cop.data;
  if (typeof home !== 'number' || typeof draw !== 'number' || typeof away !== 'number') return null;

  const { homeLambda, awayLambda } = calibrateLambdas({
    pHomeWin: home / 100,
    pDraw:    draw / 100,
    pAwayWin: away / 100,
  });
  return simulateMatch(homeLambda, awayLambda, 10000);
}

// ─── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const fixtureId = parseInt(req.query.fixture_id, 10);
  if (!fixtureId) return res.status(400).json({ error: 'fixture_id required' });

  try {
    const supabase = getSupabase();

    const [{ data: match }, { data: sim }] = await Promise.all([
      supabase.from('matches')
        .select('id, home_team, away_team, home_logo, away_logo, kickoff_time')
        .eq('id', fixtureId).maybeSingle(),
      supabase.from('match_simulations').select('*').eq('fixture_id', fixtureId).maybeSingle(),
    ]);

    if (!match) return res.status(404).json({ error: 'Fixture not found' });

    let source = sim;
    let simulationPending = false;
    let computedAt = sim?.computed_at;

    if (!sim) {
      const fallback = await fallbackFromIntel(supabase, fixtureId);
      if (!fallback) {
        return res.status(200).json({
          fixture_id: fixtureId,
          home_team: match.home_team,
          home_logo: match.home_logo,
          away_team: match.away_team,
          away_logo: match.away_logo,
          kickoff_time: match.kickoff_time,
          available: false,
          reason: 'no_simulation_or_intel',
        });
      }
      source = fallback;
      simulationPending = true;
      computedAt = new Date().toISOString();
    }

    const home = Number(source.home_win_probability);
    const draw = Number(source.draw_probability);
    const away = Number(source.away_win_probability);
    const expTotal = Number(source.expected_total_goals);
    const expHome  = Number(source.expected_home_goals);
    const expAway  = Number(source.expected_away_goals);
    const over25   = Number(source.over_2_5_probability);
    const over35   = Number(source.over_3_5_probability);
    const btts     = Number(source.btts_probability);

    return res.status(200).json({
      fixture_id: fixtureId,
      home_team: match.home_team,
      home_logo: match.home_logo,
      away_team: match.away_team,
      away_logo: match.away_logo,
      kickoff_time: match.kickoff_time,
      narrative_summary: generateMatchSummary(home, draw, away, match.home_team, match.away_team),
      match_result: {
        home_win: home,
        draw,
        away_win: away,
        headline: generateResultHeadline(home, draw, away, match.home_team, match.away_team),
      },
      goals: {
        expected_total: expTotal,
        expected_home: expHome,
        expected_away: expAway,
        over_2_5_probability: over25,
        over_3_5_probability: over35,
        narrative: generateGoalsNarrative(expTotal, over25),
      },
      btts: {
        probability: btts,
        narrative: generateBttsNarrative(btts),
      },
      top_scorelines: source.scoreline_distribution || [],
      uncertainty_level: source.uncertainty_level,
      simulation_count: source.simulation_count ?? 10000,
      simulation_pending: simulationPending,
      computed_at: computedAt,
    });
  } catch (err) {
    console.error('[stats-gen/match-probabilities]', err);
    return res.status(500).json({ error: err.message });
  }
}
