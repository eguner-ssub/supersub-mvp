// GET /api/stats-gen/banker?fixture_id=X
// Prediction data for the Banker card. Reads pre-processed
// match_intel.report_sections: commandOfPitch (type 233 FULLTIME_1X2) for
// win probs; scoreboardForecast (type 240 CORRECT_SCORE) for predicted score.

import { requireStatsGenToken, getSupabase } from '../auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const fixtureId = parseInt(req.query.fixture_id, 10);
  if (!fixtureId) return res.status(400).json({ error: 'fixture_id is required' });

  const supabase = getSupabase();
  const { data: intel } = await supabase
    .from('match_intel')
    .select('sportmonks_available, report_sections')
    .eq('match_id', fixtureId)
    .maybeSingle();

  if (!intel || !intel.report_sections) {
    return res.status(200).json({ available: false, sportmonks_available: false });
  }

  const cop = intel.report_sections.commandOfPitch;
  const sbf = intel.report_sections.scoreboardForecast;

  const home_win_pct = cop?.available ? cop.data?.home ?? null : null;
  const draw_pct     = cop?.available ? cop.data?.draw ?? null : null;
  const away_win_pct = cop?.available ? cop.data?.away ?? null : null;

  // Predicted score: take the topScores[0] entry ("2-1" shape) and split
  const top = sbf?.available && Array.isArray(sbf.data?.topScores) ? sbf.data.topScores[0] : null;
  let predicted_score_home = null;
  let predicted_score_away = null;
  if (top?.score && typeof top.score === 'string') {
    const [h, a] = top.score.split('-').map(n => parseInt(n, 10));
    if (!isNaN(h) && !isNaN(a)) {
      predicted_score_home = h;
      predicted_score_away = a;
    }
  }

  const confidence_pct = [home_win_pct, draw_pct, away_win_pct]
    .filter(v => typeof v === 'number')
    .reduce((m, v) => Math.max(m, v), 0) || null;

  return res.status(200).json({
    available: true,
    sportmonks_available: !!intel.sportmonks_available,
    home_win_pct,
    draw_pct,
    away_win_pct,
    predicted_score_home,
    predicted_score_away,
    predicted_score_probability: top?.probability ?? null,
    confidence_pct,
  });
}
