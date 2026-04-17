// GET /api/stats-gen/gw-bench-to-watch?league_id=X&gameweek=Y
// Top sub-scorers from recent GWs who have a fixture in the specified GW.

import { requireStatsGenToken, getSupabase } from '../auth.js';
import { resolveLeagueContext } from '../resolveSeason.js';
import { buildSubsOnMap, findSubGoalsAfterEntry } from '../subsOnMap.js';

const TERMINAL = ['FT', 'AET', 'FT_PEN'];

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const leagueId = parseInt(req.query.league_id, 10);
  const gameweek = req.query.gameweek?.trim();
  if (!leagueId || !gameweek) return res.status(400).json({ error: 'league_id and gameweek required' });

  try {
    const supabase = getSupabase();
    const ctx = await resolveLeagueContext(supabase, leagueId);

    // Upcoming matches for the target gameweek
    const { data: gwMatches } = await supabase
      .from('matches')
      .select('id, home_team, away_team, home_team_id, away_team_id')
      .eq('league_id', leagueId)
      .ilike('round_name', `%${gameweek}%`);

    const gwTeamIds = new Set((gwMatches || []).flatMap(m => [m.home_team_id, m.away_team_id]));

    // Sub goals from last 5 completed GWs
    const { data: recentMatches } = await supabase
      .from('matches')
      .select('id, events, lineups, home_team_id, away_team_id, home_team, away_team, round_name')
      .eq('league_id', leagueId)
      .in('status', TERMINAL)
      .not('round_name', 'is', null)
      .order('kickoff_time', { ascending: false })
      .limit(100); // rough proxy for ~5 GWs

    // Aggregate sub goals per player across recent matches
    const byPlayer = new Map();
    for (const m of (recentMatches || [])) {
      const events = Array.isArray(m.events) ? m.events : [];
      const lineups = Array.isArray(m.lineups) ? m.lineups : [];
      const nameById = new Map(lineups.map(l => [l.player_id, l.player_name]));
      const subsOn = buildSubsOnMap(events, null);
      const subGoals = findSubGoalsAfterEntry(events, subsOn);

      for (const g of subGoals) {
        let agg = byPlayer.get(g.scorerId);
        if (!agg) {
          // Find team for this player
          // Sportmonks v3: player_id = incoming player on sub events
          const subEvt = events.find(e => (e.type_id === 18 || e.type === 'subst') && e.player_id === g.scorerId);
          const teamId = subEvt?.participant_id ?? subEvt?.team?.id;
          agg = { player_id: g.scorerId, player_name: nameById.get(g.scorerId), team_id: teamId, sub_goals: 0, apps: 0 };
          byPlayer.set(g.scorerId, agg);
        }
        agg.sub_goals++;
      }
      // Count appearances as sub
      for (const [pid] of subsOn) {
        const agg = byPlayer.get(pid);
        if (agg) agg.apps++;
      }
    }

    // Filter to players whose team plays in the target GW, rank by sub_goals
    const candidates = [...byPlayer.values()]
      .filter(p => p.team_id && gwTeamIds.has(p.team_id))
      .sort((a, b) => b.sub_goals - a.sub_goals);

    // Enrich with team logos
    const teamIds = [...new Set(candidates.map(c => c.team_id).filter(Boolean))];
    const { data: teamCache } = teamIds.length
      ? await supabase.from('teams').select('sportmonks_id, name, logo_url').in('sportmonks_id', teamIds)
      : { data: [] };
    const teamBySmId = Object.fromEntries((teamCache || []).map(t => [t.sportmonks_id, t]));

    const buildInsight = (p) => `${p.sub_goals} sub goal${p.sub_goals > 1 ? 's' : ''} in last ${p.apps || '?'} appearances`;

    const findMatch = (teamId) => {
      const m = (gwMatches || []).find(gm => gm.home_team_id === teamId || gm.away_team_id === teamId);
      if (!m) return { match_title: null, opponent: null };
      const isHome = m.home_team_id === teamId;
      return {
        match_title: `${m.home_team} vs ${m.away_team}`,
        opponent: isHome ? m.away_team : m.home_team,
      };
    };

    const featured = candidates[0] || null;
    const secondary = candidates.slice(1, 4);

    const response = {
      gameweek,
      featured_player_name: featured?.player_name || null,
      featured_player_team: featured ? (teamBySmId[featured.team_id]?.name || null) : null,
      featured_player_badge_url: featured ? (teamBySmId[featured.team_id]?.logo_url || null) : null,
      featured_player_sub_goals: featured?.sub_goals || 0,
      featured_player_insight: featured ? buildInsight(featured) : null,
      upcoming_match_title: featured ? findMatch(featured.team_id).match_title : null,
      opponent_name: featured ? findMatch(featured.team_id).opponent : null,
      secondary_players: secondary.map(p => ({
        player_name: p.player_name,
        team_name: teamBySmId[p.team_id]?.name || null,
        badge_url: teamBySmId[p.team_id]?.logo_url || null,
        sub_goals: p.sub_goals,
        insight: buildInsight(p),
      })),
    };

    return res.status(200).json(response);
  } catch (err) {
    console.error('[stats-gen/gw-bench-to-watch]', err);
    return res.status(500).json({ error: err.message });
  }
}
