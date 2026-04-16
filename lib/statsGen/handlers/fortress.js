// GET /api/stats-gen/fortress?league_id=X&season=Y
// Top 10 teams by home record — home_points, home_won, home_drawn,
// home_lost, home_goals_against. Reads the home_* columns added by
// migration 056 and populated by sync-standings.js.
//
// `season` query param accepted but ignored — standings is keyed on
// seasons.id (UUID) and we always want the current season for a league.

import { requireStatsGenToken, getSupabase } from '../auth.js';
import { resolveSeasonUuid, resolveTeamUuids } from '../resolveSeason.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const leagueId = parseInt(req.query.league_id, 10);
  if (!leagueId) return res.status(400).json({ error: 'league_id is required' });

  const supabase = getSupabase();
  const seasonUuid = await resolveSeasonUuid(supabase, leagueId);
  if (!seasonUuid) return res.status(200).json({ available: false, reason: 'season_unresolved' });

  const { data: standings, error } = await supabase
    .from('standings')
    .select('team_id, position, home_matches_played, home_won, home_drawn, home_lost, home_goals_for, home_goals_against, home_points')
    .eq('season_id', seasonUuid);
  if (error) return res.status(500).json({ error: error.message });

  const ranked = (standings || [])
    .sort((a, b) => (b.home_points ?? 0) - (a.home_points ?? 0))
    .slice(0, 10);

  // Fetch team names + logos for the top 10 in one hit
  const teamUuids = ranked.map(r => r.team_id).filter(Boolean);
  const { data: teams } = teamUuids.length
    ? await supabase.from('teams').select('id, name, short_name, logo_url, sportmonks_id').in('id', teamUuids)
    : { data: [] };
  const teamByUuid = Object.fromEntries((teams || []).map(t => [t.id, t]));

  const rows = ranked.map(r => {
    const team = teamByUuid[r.team_id] || {};
    return {
      team_id: team.sportmonks_id ?? null,
      team_name: team.name ?? null,
      team_logo: team.logo_url ?? null,
      position: r.position,
      home_matches_played: r.home_matches_played ?? 0,
      home_won:            r.home_won ?? 0,
      home_drawn:          r.home_drawn ?? 0,
      home_lost:           r.home_lost ?? 0,
      home_goals_for:      r.home_goals_for ?? 0,
      home_goals_against:  r.home_goals_against ?? 0,
      home_points:         r.home_points ?? 0,
    };
  });

  return res.status(200).json({
    available: true,
    league_id: leagueId,
    season_uuid: seasonUuid,
    teams: rows,
  });
}
