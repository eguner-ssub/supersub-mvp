// GET /api/stats-gen/first-blood?league_id=X&season=Y
// Players who score the FIRST goal of a match most often. For each
// completed fixture we pick the goal event with the lowest elapsed minute
// (goal = type_id 14 regular or 97 penalty; elapsed ≤ 120 to exclude
// extra-time weirdness) and attribute it to the scorer. Top 10 returned.
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
    .select('id, events')
    .eq('league_id', leagueId)
    .in('status', TERMINAL);
  if (error) return res.status(500).json({ error: error.message });

  const byPlayer = new Map();

  for (const m of (matches || [])) {
    const events = Array.isArray(m.events) ? m.events : [];
    let earliest = null;
    for (const e of events) {
      const isGoal = e.type_id === 14 || e.type_id === 97 || e.type === 'Goal';
      if (!isGoal) continue;
      const t = e.minute ?? e.time?.elapsed ?? 0;
      if (t > 120) continue;
      if (!earliest || t < earliest.minute) {
        earliest = { minute: t, scorerId: Number(e.player_id ?? e.player?.id), scorerName: e.player_name || e.player?.name };
      }
    }
    if (!earliest?.scorerId) continue;

    let agg = byPlayer.get(earliest.scorerId);
    if (!agg) {
      agg = { player_id: earliest.scorerId, player_name: earliest.scorerName || `Player ${earliest.scorerId}`, opening_goals: 0, goal_minutes: [] };
      byPlayer.set(earliest.scorerId, agg);
    }
    agg.opening_goals += 1;
    agg.goal_minutes.push(earliest.minute);
  }

  if (byPlayer.size === 0) return res.status(200).json({ league_id: leagueId, players: [] });

  // Enrich with team info + image from player_squad_cache
  const playerIds = [...byPlayer.keys()];
  const { data: cacheRows } = await supabase
    .from('player_squad_cache')
    .select('player_id, player_name, team_id, team_name, image_path')
    .in('player_id', playerIds);

  const cacheByPlayer = Object.fromEntries((cacheRows || []).map(r => [r.player_id, r]));

  const rows = [...byPlayer.values()]
    .map(a => {
      const cache = cacheByPlayer[a.player_id];
      const sum = a.goal_minutes.reduce((s, v) => s + v, 0);
      return {
        player_id: a.player_id,
        player_name: cache?.player_name || a.player_name,
        team_id: cache?.team_id ?? null,
        team_name: cache?.team_name ?? null,
        image_path: cache?.image_path ?? null,
        opening_goals: a.opening_goals,
        avg_goal_minute: a.opening_goals > 0 ? Math.round((sum / a.opening_goals) * 10) / 10 : null,
      };
    })
    .sort((a, b) => b.opening_goals - a.opening_goals)
    .slice(0, 10);

  return res.status(200).json({
    league_id: leagueId,
    players: rows,
  });
}
