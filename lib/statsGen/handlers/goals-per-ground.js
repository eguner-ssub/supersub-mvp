// GET /api/stats-gen/goals-per-ground?league_id=X
// Returns avg goals per match at each home ground, ranked descending.
// Data source: matches table, completed fixtures for the league.
// Uses home_team as venue proxy (no venue table).

import { requireStatsGenToken, getSupabase } from '../auth.js';
import { resolveLeagueContext } from '../resolveSeason.js';

const TERMINAL = ['FT', 'AET', 'FT_PEN'];

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const leagueId = parseInt(req.query.league_id, 10);
  if (!leagueId) return res.status(400).json({ error: 'league_id required' });

  try {
    const supabase = getSupabase();
    const ctx = await resolveLeagueContext(supabase, leagueId);

    const { data: matches, error } = await supabase
      .from('matches')
      .select('home_team, home_logo, home_score, away_score')
      .eq('league_id', leagueId)
      .in('status', TERMINAL);
    if (error) throw error;

    const byTeam = new Map();
    for (const m of (matches || [])) {
      const key = m.home_team;
      if (!key) continue;
      let agg = byTeam.get(key);
      if (!agg) {
        agg = { team_name: key, team_badge_url: m.home_logo, matches_played: 0, total_goals: 0, over_2_5_count: 0 };
        byTeam.set(key, agg);
      }
      const goals = (m.home_score ?? 0) + (m.away_score ?? 0);
      agg.matches_played++;
      agg.total_goals += goals;
      if (goals > 2) agg.over_2_5_count++;
    }

    const grounds = [...byTeam.values()]
      .map(r => ({
        ...r,
        ground_name: r.team_name,  // venue proxy
        avg_goals_per_match: r.matches_played > 0
          ? Math.round((r.total_goals / r.matches_played) * 100) / 100
          : 0,
      }))
      .sort((a, b) => b.avg_goals_per_match - a.avg_goals_per_match);

    return res.status(200).json({
      league_name: ctx.league_name,
      season_label: ctx.season_label,
      grounds,
    });
  } catch (err) {
    console.error('[stats-gen/goals-per-ground]', err);
    return res.status(500).json({ error: err.message });
  }
}
