// GET /api/stats-gen/banker?fixture_id=X
// Returns match result probabilities and predicted score.
// Data source: Sportmonks predictions via match_intel.report_sections.

import { requireStatsGenToken, getSupabase } from '../auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const fixtureId = parseInt(req.query.fixture_id, 10);
  if (!fixtureId) return res.status(400).json({ error: 'fixture_id required' });

  try {
    const supabase = getSupabase();

    const [{ data: match }, { data: intel }] = await Promise.all([
      supabase.from('matches').select('home_team, away_team').eq('id', fixtureId).single(),
      supabase.from('match_intel').select('sportmonks_available, report_sections').eq('match_id', fixtureId).maybeSingle(),
    ]);
    if (!match) return res.status(404).json({ error: 'Fixture not found' });

    if (!intel?.report_sections) {
      return res.status(200).json({
        home_team: match.home_team,
        away_team: match.away_team,
        home_win_pct: null,
        draw_pct: null,
        away_win_pct: null,
        predicted_score: null,
        confidence: null,
        sportmonks_available: false,
      });
    }

    const cop = intel.report_sections.commandOfPitch;
    const sbf = intel.report_sections.scoreboardForecast;

    const home_win_pct = cop?.available ? cop.data?.home ?? null : null;
    const draw_pct     = cop?.available ? cop.data?.draw ?? null : null;
    const away_win_pct = cop?.available ? cop.data?.away ?? null : null;

    let predicted_score = null;
    const top = sbf?.available && Array.isArray(sbf.data?.topScores) ? sbf.data.topScores[0] : null;
    if (top?.score && typeof top.score === 'string') {
      const [h, a] = top.score.split('-').map(n => parseInt(n, 10));
      if (!isNaN(h) && !isNaN(a)) predicted_score = { home: h, away: a };
    }

    const confidence = [home_win_pct, draw_pct, away_win_pct]
      .filter(v => typeof v === 'number')
      .reduce((m, v) => Math.max(m, v), 0) || null;

    return res.status(200).json({
      home_team: match.home_team,
      away_team: match.away_team,
      home_win_pct,
      draw_pct,
      away_win_pct,
      predicted_score,
      confidence,
      sportmonks_available: !!intel.sportmonks_available,
    });
  } catch (err) {
    console.error('[stats-gen/banker]', err);
    return res.status(500).json({ error: err.message });
  }
}
