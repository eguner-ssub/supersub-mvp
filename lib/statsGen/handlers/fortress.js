// GET /api/stats-gen/fortress?league_id=X
// Returns teams ranked by home points.
// Data source: standings table (home_* columns from migration 056).

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

    if (!ctx.season_uuid) {
      return res.status(200).json({ available: false, reason: 'season_unresolved' });
    }

    const { data: standings, error } = await supabase
      .from('standings')
      .select('team_id, position, home_matches_played, home_won, home_drawn, home_lost, home_goals_for, home_goals_against, home_points')
      .eq('season_id', ctx.season_uuid);
    if (error) throw error;

    // Fetch team names + logos for all teams in one hit
    const teamUuids = (standings || []).map(r => r.team_id).filter(Boolean);
    const { data: teams } = teamUuids.length
      ? await supabase.from('teams').select('id, name, logo_url, sportmonks_id').in('id', teamUuids)
      : { data: [] };
    const teamByUuid = Object.fromEntries((teams || []).map(t => [t.id, t]));

    const ranked = (standings || [])
      .sort((a, b) => (b.home_points ?? 0) - (a.home_points ?? 0))
      .map((r, i) => {
        const team = teamByUuid[r.team_id] || {};
        return {
          team_id: team.sportmonks_id ?? null,
          team_name: team.name ?? null,
          team_badge_url: team.logo_url ?? null,
          home_wins: r.home_won ?? 0,
          home_draws: r.home_drawn ?? 0,
          home_losses: r.home_lost ?? 0,
          home_points: r.home_points ?? 0,
          home_matches: r.home_matches_played ?? 0,
          rank: i + 1,
        };
      });

    return res.status(200).json({
      league_name: ctx.league_name,
      season_label: ctx.season_label,
      teams: ranked,
    });
  } catch (err) {
    console.error('[stats-gen/fortress]', err);
    return res.status(500).json({ error: err.message });
  }
}
