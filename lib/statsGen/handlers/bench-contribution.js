// GET /api/stats-gen/bench-contribution?league_id=X
// Teams ranked by total bench goals this season.

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
    if (!seasonSmId) return res.status(200).json({ teams: [] });

    // Get team_ids for this league from matches
    const { data: matchTeams } = await supabase
      .from('matches').select('home_team_id, away_team_id').eq('league_id', leagueId).limit(100);
    const leagueTeamIds = [...new Set((matchTeams || []).flatMap(m => [m.home_team_id, m.away_team_id]).filter(Boolean))];

    const { data: benchStats } = leagueTeamIds.length
      ? await supabase
          .from('team_bench_stats')
          .select('team_id, total_bench_goals, matches_played, total_subs_made, avg_first_sub_minute')
          .eq('season_id', seasonSmId)
          .in('team_id', leagueTeamIds)
          .order('total_bench_goals', { ascending: false })
      : { data: [] };

    // Fetch team names + logos
    const teamIds = (benchStats || []).map(s => s.team_id);
    const { data: teamCache } = teamIds.length
      ? await supabase.from('teams').select('sportmonks_id, name, logo_url').in('sportmonks_id', teamIds)
      : { data: [] };
    const teamBySmId = Object.fromEntries((teamCache || []).map(t => [t.sportmonks_id, t]));

    const teams = (benchStats || []).map((s, i) => {
      const team = teamBySmId[s.team_id] || {};
      return {
        team_id: s.team_id,
        team_name: team.name || null,
        team_badge_url: team.logo_url || null,
        league_name: ctx.league_name,
        sub_goals_season: s.total_bench_goals,
        sub_goals_per_match: s.matches_played > 0
          ? Math.round((s.total_bench_goals / s.matches_played) * 100) / 100
          : 0,
        matches_played: s.matches_played,
        sub_appearances_total: s.total_subs_made,
        avg_sub_minute: s.avg_first_sub_minute ? Math.round(s.avg_first_sub_minute) : null,
        rank: i + 1,
      };
    });

    return res.status(200).json({ teams });
  } catch (err) {
    console.error('[stats-gen/bench-contribution]', err);
    return res.status(500).json({ error: err.message });
  }
}
