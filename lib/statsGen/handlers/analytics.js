// GET /api/stats-gen/analytics?league_id=X
// League-wide season aggregates: total goals, sub goals, percentages.

import { requireStatsGenToken, getSupabase } from '../auth.js';
import { resolveLeagueContext } from '../resolveSeason.js';
import { buildSubsOnMap, findSubGoalsAfterEntry } from '../subsOnMap.js';

const TERMINAL = ['FT', 'AET', 'FT_PEN'];

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const leagueId = parseInt(req.query.league_id, 10);
  if (!leagueId) return res.status(400).json({ error: 'league_id required' });

  try {
    const supabase = getSupabase();
    const ctx = await resolveLeagueContext(supabase, leagueId);

    // Paginate all completed matches
    const allMatches = [];
    const BATCH = 1000;
    for (let offset = 0; ; offset += BATCH) {
      const { data, error } = await supabase
        .from('matches')
        .select('id, home_score, away_score, events')
        .eq('league_id', leagueId)
        .in('status', TERMINAL)
        .range(offset, offset + BATCH - 1);
      if (error) throw error;
      if (!data?.length) break;
      allMatches.push(...data);
      if (data.length < BATCH) break;
    }

    let totalGoals = 0;
    let totalSubGoals = 0;

    for (const m of allMatches) {
      totalGoals += (m.home_score ?? 0) + (m.away_score ?? 0);
      const events = Array.isArray(m.events) ? m.events : [];
      const subsOn = buildSubsOnMap(events, null);
      totalSubGoals += findSubGoalsAfterEntry(events, subsOn).length;
    }

    const matchesPlayed = allMatches.length;

    return res.status(200).json({
      league_name: ctx.league_name,
      league_id: leagueId,
      season_label: ctx.season_label,
      total_goals_season: totalGoals,
      total_sub_goals: totalSubGoals,
      sub_goal_percentage: totalGoals > 0 ? Math.round((totalSubGoals / totalGoals) * 1000) / 10 : 0,
      sub_goals_per_match: matchesPlayed > 0 ? Math.round((totalSubGoals / matchesPlayed) * 100) / 100 : 0,
      matches_played: matchesPlayed,
    });
  } catch (err) {
    console.error('[stats-gen/analytics]', err);
    return res.status(500).json({ error: err.message });
  }
}
