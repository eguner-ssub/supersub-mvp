// GET /api/stats-gen/relegation-probabilities?league_id=X
// Top 10 teams ranked by relegation probability for the league's current season.
//
// For Championship (league_id 9): "relegation" here means a bottom-3 finish,
// even though only 2 are auto-relegated and one plays a playoff. We use the
// same metric semantics across all leagues for consistency. Frontends that
// want league-specific framing can interpret accordingly.

import { requireStatsGenToken, getSupabase } from '../auth.js';
import { resolveLeagueContext } from '../resolveSeason.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const leagueId = parseInt(req.query.league_id, 10);
  if (!leagueId) return res.status(400).json({ error: 'league_id required' });

  try {
    const supabase = getSupabase();
    const ctx = await resolveLeagueContext(supabase, leagueId);
    if (!ctx.season_sm_id) {
      return res.status(200).json({ available: false, reason: 'season_unresolved' });
    }

    const { data, error } = await supabase
      .from('season_probabilities')
      .select('*')
      .eq('league_id', leagueId)
      .eq('season_id', ctx.season_sm_id)
      .order('relegation_probability', { ascending: false })
      .limit(10);
    if (error) throw error;

    const teams = (data || []).map((r, i) => ({
      team_id: r.team_id,
      team_name: r.team_name,
      team_logo: r.team_logo,
      current_position: r.current_position,
      current_points: r.current_points,
      expected_final_points: Number(r.expected_final_points),
      relegation_probability: Number(r.relegation_probability),
      rank: i + 1,
    }));

    return res.status(200).json({
      league_id: leagueId,
      league_name: ctx.league_name,
      season: ctx.season_label,
      computed_at: data?.[0]?.computed_at || null,
      relegation_metric_note: leagueId === 9
        ? 'Bottom-3 finish probability (Championship has 2 auto-relegated + 1 playoff). Same metric semantics across all leagues.'
        : 'Bottom-3 finish probability.',
      teams,
    });
  } catch (err) {
    console.error('[stats-gen/relegation-probabilities]', err);
    return res.status(500).json({ error: err.message });
  }
}
