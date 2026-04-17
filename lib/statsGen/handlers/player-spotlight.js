// GET /api/stats-gen/player-spotlight?league_id=X&rank_by=sub_goals
// Top 10 supersub players ranked by sub_goals (or sub appearances etc).

import { requireStatsGenToken, getSupabase } from '../auth.js';
import { resolveLeagueContext, resolveSeasonSmId } from '../resolveSeason.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const leagueId = parseInt(req.query.league_id, 10);
  if (!leagueId) return res.status(400).json({ error: 'league_id required' });

  const rankBy = req.query.rank_by || 'sub_goals';

  try {
    const supabase = getSupabase();
    const [ctx, seasonSmId] = await Promise.all([
      resolveLeagueContext(supabase, leagueId),
      resolveSeasonSmId(supabase, leagueId),
    ]);

    // Map rank_by param to DB column
    const orderCol = { sub_goals: 'goals_as_sub', sub_assists: 'assists_as_sub', sub_apps: 'apps_as_sub' }[rankBy] || 'goals_as_sub';

    // player_supersub_stats uses integer season_id + integer team_id
    // We need to filter by teams in this league — get team_ids from matches
    const { data: teamRows } = await supabase
      .from('matches')
      .select('home_team_id, away_team_id')
      .eq('league_id', leagueId)
      .limit(100);

    const leagueTeamIds = [...new Set((teamRows || []).flatMap(m => [m.home_team_id, m.away_team_id]).filter(Boolean))];
    if (!leagueTeamIds.length || !seasonSmId) {
      return res.status(200).json({ players: [] });
    }

    const { data: stats } = await supabase
      .from('player_supersub_stats')
      .select('player_id, team_id, goals_as_sub, assists_as_sub, apps_as_sub, minutes_as_sub')
      .eq('season_id', seasonSmId)
      .in('team_id', leagueTeamIds)
      .gt('goals_as_sub', 0)
      .order(orderCol, { ascending: false })
      .limit(10);

    // Enrich with player names + team logos
    const playerIds = (stats || []).map(s => s.player_id);
    const teamIds   = [...new Set((stats || []).map(s => s.team_id))];

    const [{ data: playerCache }, { data: teamCache }] = await Promise.all([
      playerIds.length ? supabase.from('player_squad_cache').select('player_id, player_name, team_name').in('player_id', playerIds) : { data: [] },
      teamIds.length   ? supabase.from('teams').select('sportmonks_id, logo_url').in('sportmonks_id', teamIds) : { data: [] },
    ]);

    const nameByPlayer = Object.fromEntries((playerCache || []).map(r => [r.player_id, r]));
    const logoByTeamSm = Object.fromEntries((teamCache || []).map(r => [r.sportmonks_id, r.logo_url]));

    const players = (stats || []).map((s, i) => {
      const cache = nameByPlayer[s.player_id];
      const per90 = s.minutes_as_sub > 0 ? Math.round((s.goals_as_sub / s.minutes_as_sub) * 90 * 100) / 100 : 0;
      return {
        player_id: s.player_id,
        player_name: cache?.player_name || `Player ${s.player_id}`,
        team_name: cache?.team_name || null,
        team_badge_url: logoByTeamSm[s.team_id] || null,
        sub_goals_season: s.goals_as_sub,
        sub_assists_season: s.assists_as_sub,
        sub_appearances: s.apps_as_sub,
        sub_minutes_played: s.minutes_as_sub,
        goals_per_90_sub: per90,
        goal_contributions_sub: s.goals_as_sub + s.assists_as_sub,
        rank: i + 1,
        season_label: ctx.season_label,
      };
    });

    return res.status(200).json({ players });
  } catch (err) {
    console.error('[stats-gen/player-spotlight]', err);
    return res.status(500).json({ error: err.message });
  }
}
