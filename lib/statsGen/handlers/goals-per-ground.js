// GET /api/stats-gen/goals-per-ground?league_id=X&season=Y
// Average total goals per home venue, ranked. Uses home_team string as
// venue proxy (Sportmonks venues aren't resolved onto matches yet).
// The `season` query param is accepted but ignored — matches.season is
// unpopulated — we filter completed matches by league_id alone.

import { requireStatsGenToken, getSupabase } from '../auth.js';

const TERMINAL = ['FT', 'AET', 'FT_PEN'];

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const leagueId = parseInt(req.query.league_id, 10);
  if (!leagueId) return res.status(400).json({ error: 'league_id is required' });

  const supabase = getSupabase();
  const { data: matches, error } = await supabase
    .from('matches')
    .select('home_team, home_logo, home_score, away_score')
    .eq('league_id', leagueId)
    .in('status', TERMINAL);
  if (error) return res.status(500).json({ error: error.message });

  const byTeam = new Map();
  for (const m of (matches || [])) {
    const key = m.home_team;
    if (!key) continue;
    let agg = byTeam.get(key);
    if (!agg) {
      agg = { home_team: key, home_logo: m.home_logo, matches: 0, total_goals: 0, over_2_5: 0 };
      byTeam.set(key, agg);
    }
    const goals = (m.home_score ?? 0) + (m.away_score ?? 0);
    agg.matches += 1;
    agg.total_goals += goals;
    if (goals > 2) agg.over_2_5 += 1;
  }

  const grounds = [...byTeam.values()]
    .map(r => ({
      ...r,
      avg_goals: r.matches > 0 ? Math.round((r.total_goals / r.matches) * 100) / 100 : 0,
      over_2_5_pct: r.matches > 0 ? Math.round((r.over_2_5 / r.matches) * 100) : 0,
    }))
    .sort((a, b) => b.avg_goals - a.avg_goals);

  return res.status(200).json({
    league_id: leagueId,
    grounds,
  });
}
