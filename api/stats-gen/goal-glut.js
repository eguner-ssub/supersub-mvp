// GET /api/stats-gen/goal-glut?league_id=X&season=Y
// Goals per gameweek across a season. Groups completed matches by
// round_name and returns them sorted by extractable round number.
//
// `season` query param accepted but unused — matches.season is unpopulated.

import { requireStatsGenToken, getSupabase } from '../../lib/statsGen/auth.js';

const TERMINAL = ['FT', 'AET', 'FT_PEN'];

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const leagueId = parseInt(req.query.league_id, 10);
  if (!leagueId) return res.status(400).json({ error: 'league_id is required' });

  const supabase = getSupabase();
  const { data: matches, error } = await supabase
    .from('matches')
    .select('round_name, home_score, away_score')
    .eq('league_id', leagueId)
    .in('status', TERMINAL)
    .not('round_name', 'is', null);
  if (error) return res.status(500).json({ error: error.message });

  const byRound = new Map();
  for (const m of (matches || [])) {
    const key = m.round_name;
    let agg = byRound.get(key);
    if (!agg) {
      agg = { round_name: key, matches: 0, total_goals: 0 };
      byRound.set(key, agg);
    }
    agg.matches += 1;
    agg.total_goals += (m.home_score ?? 0) + (m.away_score ?? 0);
  }

  const extractNum = (name) => {
    const m = /(\d+)/.exec(name || '');
    return m ? parseInt(m[1], 10) : 0;
  };

  const rows = [...byRound.values()]
    .map(r => ({
      round_name: r.round_name,
      round_number: extractNum(r.round_name),
      matches: r.matches,
      total_goals: r.total_goals,
      avg_goals: r.matches > 0 ? Math.round((r.total_goals / r.matches) * 100) / 100 : 0,
    }))
    .sort((a, b) => a.round_number - b.round_number);

  // Flag the peak round by total_goals
  let peak = null;
  let peakIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (!peak || rows[i].total_goals > peak.total_goals) {
      peak = rows[i]; peakIdx = i;
    }
  }
  const withPeak = rows.map((r, i) => ({ ...r, is_peak: i === peakIdx }));

  return res.status(200).json({
    league_id: leagueId,
    rounds: withPeak,
    peak_round: peak,
  });
}
