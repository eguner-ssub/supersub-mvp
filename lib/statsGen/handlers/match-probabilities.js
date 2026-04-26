// GET /api/stats-gen/match-probabilities?fixture_id=X
//
// Param: `fixture_id` — matches the convention used across the rest of the
// stats-gen surface (banker, h2h, lineups, over-under, referee-watch, etc.).
//
// 2026-04 ARCHITECTURE PIVOT: this handler used to read from match_simulations
// (our 10k-iter Poisson Monte Carlo). It now reads SportMonks predictions
// directly from match_intel.report_sections — single source of truth across
// /api/intel and the StatsGen Match Probabilities surface, no editorial drift.
// The Monte Carlo pipeline is archived in scripts/_archived/. The
// match_simulations table is preserved as an inert archive.
// See scripts/_archived/README.md for context and revival path.
//
// CRITICAL: editorial language only. No "odds", "bet", "bookmaker", "value",
// "edge", "tip" anywhere. Always "chance" or "probability". Frame as
// analytical insight, never betting advice. Narrative_summary deliberately
// does NOT cite specific scoreline percentages — those live only in the
// top_scorelines array, sourced from the same data.

import { requireStatsGenToken, getSupabase } from '../auth.js';

// ─── Section helpers ────────────────────────────────────────────────────────
// match_intel.report_sections is shaped like
//   { commandOfPitch: { available: true, data: {...} }, ... }
// All probability fields from SportMonks are integer percentages (0-100).
// We normalise to 0-1 floats at the API boundary so the FE has a single shape.

function pickSection(sections, key) {
  const s = sections?.[key];
  if (!s?.available || !s.data) return null;
  return s.data;
}

// ─── Narrative templates ────────────────────────────────────────────────────
// Deterministic — no LLM. Every emitted percentage comes from the same data
// source the structured fields are computed from, so prose can never drift
// from numbers in the same payload. STEP 8 unit test enforces this.

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

function generateGoalsNarrative(over25) {
  const o25Pct = Math.round(over25 * 100);
  if (over25 >= 0.65) return `Goals look likely — a ${o25Pct}% chance of more than 2.5.`;
  if (over25 >= 0.50) return `A balanced goals outlook — ${o25Pct}% chance of more than 2.5.`;
  return `A cagey affair is on the cards — only ${o25Pct}% chance of going over 2.5.`;
}

function generateBttsNarrative(p) {
  const pct = Math.round(p * 100);
  if (p >= 0.70) return `Both teams scoring is highly likely — ${pct}%.`;
  if (p >= 0.50) return `Both teams scoring is the more likely outcome at ${pct}%.`;
  if (p >= 0.35) return `Both teams scoring is plausible but not the favourite at ${pct}%.`;
  return `At least one clean sheet looks likely — only ${pct}% chance both teams score.`;
}

// Match summary — deliberately W/D/L only, NO specific scorelines. Scoreline
// numbers live in the top_scorelines array; mixing them into prose was the
// root cause of the editorial drift bug that triggered the 2026-04 pivot.
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

// Uncertainty bucket from W/D/L spread (Shannon-style without taking logs —
// the previous Monte Carlo path used real entropy, this is a cheap approximation
// that bins identically on the same boundaries for spread cases that matter).
function bucketUncertainty(home, draw, away) {
  const max = Math.max(home, draw, away);
  if (max >= 0.55) return 'low';        // one outcome dominates
  if (max >= 0.42) return 'moderate';   // mild lean
  return 'high';                         // genuine three-way
}

// ─── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const fixtureId = parseInt(req.query.fixture_id, 10);
  if (!fixtureId) return res.status(400).json({ error: 'fixture_id required' });

  try {
    const supabase = getSupabase();

    const [{ data: match }, { data: intel }] = await Promise.all([
      supabase.from('matches')
        .select('id, home_team, away_team, home_logo, away_logo, kickoff_time')
        .eq('id', fixtureId).maybeSingle(),
      supabase.from('match_intel')
        .select('match_id, generated_at, report_sections')
        .eq('match_id', fixtureId).maybeSingle(),
    ]);

    if (!match) return res.status(404).json({ error: 'Fixture not found' });

    const sections = intel?.report_sections || null;
    const cop = pickSection(sections, 'commandOfPitch');

    // Hard unavailable: no intel row at all, OR intel exists but the W/D/L
    // section (commandOfPitch) is missing. Without W/D/L there's no useful
    // probability surface to render.
    if (!cop) {
      return res.status(200).json({
        fixture_id: fixtureId,
        home_team: match.home_team,
        home_logo: match.home_logo,
        away_team: match.away_team,
        away_logo: match.away_logo,
        kickoff_time: match.kickoff_time,
        available: false,
        reason: 'predictions_unavailable',
        data_source: 'sportmonks_predictions',
      });
    }

    // commandOfPitch.data.{home, draw, away} are integer 0-100; normalise.
    const home = (cop.home || 0) / 100;
    const draw = (cop.draw || 0) / 100;
    const away = (cop.away || 0) / 100;

    // Optional sections — degrade gracefully. partial_data flips true if any
    // expected section is unavailable so the FE can render a "data unavailable"
    // micro-label per missing section instead of pretending it's complete.
    const tgo = pickSection(sections, 'totalGoalOutlook');     // { over25, under25 }
    const af  = pickSection(sections, 'attackingFirepower');   // { homeOver15 }
    const dd  = pickSection(sections, 'defensiveDiscipline');  // { bttsYes, bttsNo }
    const sbf = pickSection(sections, 'scoreboardForecast');   // { topScores: [{score, probability}] }

    const partialData = !tgo || !dd || !sbf;

    // Build top_scorelines from scoreboardForecast.data.topScores. SportMonks
    // returns probabilities as integer 0-100 in this section (mapping in
    // lib/intel/sportmonks-mapping.js:scoreboardForecast.parse rounds them).
    // Normalise to 0-1 to match the rest of the response. Up to 5 (Sportmonks
    // typically returns 3 — that's fine, the FE handles 1..N).
    const topScorelines = sbf?.topScores
      ? sbf.topScores.slice(0, 5).map(s => ({
          score: s.score,
          probability: (s.probability || 0) / 100,
        }))
      : [];

    // Goals block — over25 from totalGoalOutlook (preferred), expected_total
    // is no longer an emitted field (Sportmonks doesn't expose it; the
    // previous Monte Carlo computed it from λ). FE handles its absence.
    const goals = tgo
      ? {
          over_2_5_probability: (tgo.over25 || 0) / 100,
          over_3_5_probability: null,        // Sportmonks doesn't return 3.5
          home_over_1_5_probability: af ? (af.homeOver15 || 0) / 100 : null,
          narrative: generateGoalsNarrative((tgo.over25 || 0) / 100),
        }
      : null;

    const btts = dd
      ? {
          probability: (dd.bttsYes || 0) / 100,
          narrative: generateBttsNarrative((dd.bttsYes || 0) / 100),
        }
      : null;

    return res.status(200).json({
      fixture_id: fixtureId,
      home_team: match.home_team,
      home_logo: match.home_logo,
      away_team: match.away_team,
      away_logo: match.away_logo,
      kickoff_time: match.kickoff_time,
      available: true,
      data_source: 'sportmonks_predictions',
      computed_at: intel.generated_at,
      partial_data: partialData,
      narrative_summary: generateMatchSummary(home, draw, away, match.home_team, match.away_team),
      match_result: {
        home_win: home,
        draw,
        away_win: away,
        headline: generateResultHeadline(home, draw, away, match.home_team, match.away_team),
      },
      goals,
      btts,
      top_scorelines: topScorelines,
      uncertainty_level: bucketUncertainty(home, draw, away),
    });
  } catch (err) {
    console.error('[stats-gen/match-probabilities]', err);
    return res.status(500).json({ error: err.message });
  }
}

// ─── Exports for unit tests (STEP 8) ────────────────────────────────────────
export const __testables = {
  generateResultHeadline,
  generateMatchSummary,
  generateGoalsNarrative,
  generateBttsNarrative,
  bucketUncertainty,
};
