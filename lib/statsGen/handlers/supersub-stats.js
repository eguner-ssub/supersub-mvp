// GET /api/stats-gen/supersub-stats?league_id=X&team_id=Y(optional)
// League-wide or team-scoped supersub overview with gameweek breakdown.

import { requireStatsGenToken, getSupabase } from '../auth.js';
import { resolveLeagueContext, resolveSeasonSmId } from '../resolveSeason.js';
import { buildSubsOnMap, findSubGoalsAfterEntry } from '../subsOnMap.js';

const TERMINAL = ['FT', 'AET', 'FT_PEN'];

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const leagueId = parseInt(req.query.league_id, 10);
  if (!leagueId) return res.status(400).json({ error: 'league_id required' });
  const teamId = req.query.team_id ? parseInt(req.query.team_id, 10) : null;

  try {
    const supabase = getSupabase();
    const [ctx, seasonSmId] = await Promise.all([
      resolveLeagueContext(supabase, leagueId),
      resolveSeasonSmId(supabase, leagueId),
    ]);

    // Fetch completed matches (optionally filtered to one team)
    let query = supabase
      .from('matches')
      .select('id, events, round_name, home_team_id, away_team_id')
      .eq('league_id', leagueId)
      .in('status', TERMINAL)
      .not('round_name', 'is', null);

    if (teamId) query = query.or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);

    const { data: matches, error } = await query;
    if (error) throw error;

    let totalSubGoals = 0;
    const gwBreakdown = new Map();

    for (const m of (matches || [])) {
      const events = Array.isArray(m.events) ? m.events : [];
      const subsOn = teamId ? buildSubsOnMap(events, teamId) : buildSubsOnMap(events, null);
      const subGoals = findSubGoalsAfterEntry(events, subsOn);
      totalSubGoals += subGoals.length;

      const gw = m.round_name;
      gwBreakdown.set(gw, (gwBreakdown.get(gw) || 0) + subGoals.length);
    }

    const matchesPlayed = (matches || []).length;
    const extractNum = (n) => { const m = /(\d+)/.exec(n||''); return m ? parseInt(m[1],10) : 0; };
    const gameweekBreakdown = [...gwBreakdown.entries()]
      .map(([gw, sg]) => ({ gameweek: gw, sub_goals: sg }))
      .sort((a, b) => extractNum(a.gameweek) - extractNum(b.gameweek));

    // Top sub scorer
    let topSubScorer = null;
    if (seasonSmId) {
      let pQuery = supabase
        .from('player_supersub_stats')
        .select('player_id, goals_as_sub')
        .eq('season_id', seasonSmId)
        .order('goals_as_sub', { ascending: false })
        .limit(1);

      if (teamId) pQuery = pQuery.eq('team_id', teamId);

      const { data: topP } = await pQuery;
      if (topP?.length) {
        const { data: nameRow } = await supabase
          .from('player_squad_cache').select('player_name').eq('player_id', topP[0].player_id).maybeSingle();
        topSubScorer = { name: nameRow?.player_name || `Player ${topP[0].player_id}`, goals: topP[0].goals_as_sub };
      }
    }

    // Rank vs peers (for team mode: rank among league teams by total bench goals)
    let rankVsPeers = null;
    if (teamId && seasonSmId) {
      const { data: allBench } = await supabase
        .from('team_bench_stats').select('team_id, total_bench_goals')
        .eq('season_id', seasonSmId).order('total_bench_goals', { ascending: false });
      const idx = (allBench || []).findIndex(r => r.team_id === teamId);
      if (idx >= 0) rankVsPeers = idx + 1;
    }

    // Entity info
    let entityName = ctx.league_name;
    let entityBadge = null;
    if (teamId) {
      const { data: team } = await supabase.from('teams').select('name, logo_url').eq('sportmonks_id', teamId).maybeSingle();
      entityName = team?.name || `Team ${teamId}`;
      entityBadge = team?.logo_url || null;
    }

    return res.status(200).json({
      entity_type: teamId ? 'team' : 'league',
      entity_name: entityName,
      entity_badge_url: entityBadge,
      season_label: ctx.season_label,
      total_sub_goals: totalSubGoals,
      sub_goals_per_match: matchesPlayed > 0 ? Math.round((totalSubGoals / matchesPlayed) * 100) / 100 : 0,
      matches_played: matchesPlayed,
      gameweek_breakdown: gameweekBreakdown,
      rank_vs_peers: rankVsPeers,
      top_sub_scorer_name: topSubScorer?.name || null,
      top_sub_scorer_goals: topSubScorer?.goals || 0,
    });
  } catch (err) {
    console.error('[stats-gen/supersub-stats]', err);
    return res.status(500).json({ error: err.message });
  }
}
