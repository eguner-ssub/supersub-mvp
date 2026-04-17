// GET /api/stats-gen/bench-vs-starter?league_id=X
// Players who score more as subs than starters. Top 10 by differential.
// Data source: player_supersub_stats (has both starter + sub columns).

import { requireStatsGenToken, getSupabase } from '../auth.js';
import { resolveLeagueContext, resolveSeasonSmId } from '../resolveSeason.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const leagueId = parseInt(req.query.league_id, 10);
  if (!leagueId) return res.status(400).json({ error: 'league_id required' });

  try {
    const supabase = getSupabase();
    const [ctx, seasonSmId] = await Promise.all([
      resolveLeagueContext(supabase, leagueId),
      resolveSeasonSmId(supabase, leagueId),
    ]);
    if (!seasonSmId) return res.status(200).json({ players: [] });

    // Get league team_ids
    const { data: matchTeams } = await supabase
      .from('matches').select('home_team_id, away_team_id').eq('league_id', leagueId).limit(100);
    const leagueTeamIds = [...new Set((matchTeams || []).flatMap(m => [m.home_team_id, m.away_team_id]).filter(Boolean))];

    const { data: stats } = leagueTeamIds.length
      ? await supabase
          .from('player_supersub_stats')
          .select('player_id, team_id, goals_as_sub, assists_as_sub, apps_as_sub, minutes_as_sub, goals_as_starter, assists_as_starter, apps_as_starter, minutes_as_starter')
          .eq('season_id', seasonSmId)
          .in('team_id', leagueTeamIds)
          .gt('minutes_as_sub', 0)
          .gt('minutes_as_starter', 0)
      : { data: [] };

    // Enrich with names + logos
    const playerIds = (stats || []).map(s => s.player_id);
    const teamIds   = [...new Set((stats || []).map(s => s.team_id))];

    const [{ data: playerCache }, { data: teamCache }] = await Promise.all([
      playerIds.length ? supabase.from('player_squad_cache').select('player_id, player_name, team_name').in('player_id', playerIds) : { data: [] },
      teamIds.length   ? supabase.from('teams').select('sportmonks_id, logo_url').in('sportmonks_id', teamIds) : { data: [] },
    ]);
    const nameByPlayer = Object.fromEntries((playerCache || []).map(r => [r.player_id, r]));
    const logoByTeamSm = Object.fromEntries((teamCache || []).map(r => [r.sportmonks_id, r.logo_url]));

    const per90 = (goals, mins) => mins > 0 ? Math.round((goals / mins) * 90 * 100) / 100 : 0;

    const rows = (stats || []).map(s => {
      const subP90     = per90(s.goals_as_sub, s.minutes_as_sub);
      const starterP90 = per90(s.goals_as_starter, s.minutes_as_starter);
      const cache = nameByPlayer[s.player_id];
      return {
        player_id: s.player_id,
        player_name: cache?.player_name || `Player ${s.player_id}`,
        team_name: cache?.team_name || null,
        team_badge_url: logoByTeamSm[s.team_id] || null,
        season_label: ctx.season_label,
        starter_appearances: s.apps_as_starter,
        starter_goals: s.goals_as_starter,
        starter_assists: s.assists_as_starter,
        starter_minutes: s.minutes_as_starter,
        starter_goals_per_90: starterP90,
        sub_appearances: s.apps_as_sub,
        sub_goals: s.goals_as_sub,
        sub_assists: s.assists_as_sub,
        sub_minutes: s.minutes_as_sub,
        sub_goals_per_90: subP90,
        differential: Math.round((subP90 - starterP90) * 100) / 100,
      };
    })
      .sort((a, b) => b.differential - a.differential)
      .slice(0, 10);

    return res.status(200).json({ players: rows });
  } catch (err) {
    console.error('[stats-gen/bench-vs-starter]', err);
    return res.status(500).json({ error: err.message });
  }
}
