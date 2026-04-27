// GET /api/stats-gen/title-probabilities?league_id=X
// Top 10 teams ranked by title probability for the league's current season.
// Reads from season_probabilities — populated by run-season-simulations.js.

import { requireStatsGenToken, getSupabase } from '../auth.js';
import { resolveLeagueContext } from '../resolveSeason.js';
import { getCoverageBlock } from '../coverage.js';

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

    const [{ data, error }, coverage] = await Promise.all([
      supabase
        .from('season_probabilities')
        .select('*')
        .eq('league_id', leagueId)
        .eq('season_id', ctx.season_sm_id)
        // Secondary sort: when title_probability ties (e.g. multiple teams at
        // 0.0 in a runaway league, or multiple at 1.0 mid-season), expected
        // final points is a meaningful tiebreaker that keeps the API response
        // deterministic and human-readable.
        .order('title_probability',     { ascending: false })
        .order('expected_final_points', { ascending: false })
        .limit(10),
      getCoverageBlock(supabase, leagueId, ctx.season_sm_id),
    ]);
    if (error) throw error;

    const teams = (data || []).map((r, i) => ({
      team_id: r.team_id,
      team_name: r.team_name,
      team_logo: r.team_logo,
      current_position: r.current_position,
      current_points: r.current_points,
      expected_final_points: Number(r.expected_final_points),
      title_probability: Number(r.title_probability),
      rank: i + 1,
    }));

    return res.status(200).json({
      league_id: leagueId,
      league_name: ctx.league_name,
      season: ctx.season_label,
      computed_at: data?.[0]?.computed_at || null,
      teams,
      // null when sim:seasons hasn't run since migration 064 was applied;
      // FE treats null as "Complete" (hides the badge).
      coverage,
    });
  } catch (err) {
    console.error('[stats-gen/title-probabilities]', err);
    return res.status(500).json({ error: err.message });
  }
}
