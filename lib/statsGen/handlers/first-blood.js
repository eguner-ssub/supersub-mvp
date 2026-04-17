// GET /api/stats-gen/first-blood?league_id=X
// Returns players ranked by opening goals (first goal in a match) this season.
// Data source: matches.events — earliest goal per completed match.

import { requireStatsGenToken, getSupabase } from '../auth.js';
import { resolveLeagueContext } from '../resolveSeason.js';

const TERMINAL = ['FT', 'AET', 'FT_PEN'];

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const leagueId = parseInt(req.query.league_id, 10);
  if (!leagueId) return res.status(400).json({ error: 'league_id required' });

  try {
    const supabase = getSupabase();
    const ctx = await resolveLeagueContext(supabase, leagueId);

    // Paginate matches
    const allMatches = [];
    const BATCH = 1000;
    for (let offset = 0; ; offset += BATCH) {
      const { data, error } = await supabase
        .from('matches')
        .select('id, events')
        .eq('league_id', leagueId)
        .in('status', TERMINAL)
        .order('kickoff_time', { ascending: false })
        .range(offset, offset + BATCH - 1);
      if (error) throw error;
      if (!data?.length) break;
      allMatches.push(...data);
      if (data.length < BATCH) break;
    }

    const byPlayer = new Map();

    for (const m of allMatches) {
      const events = Array.isArray(m.events) ? m.events : [];
      let earliest = null;
      for (const e of events) {
        const isGoal = e.type_id === 14 || e.type_id === 97 || e.type === 'Goal';
        if (!isGoal) continue;
        const t = e.minute ?? e.time?.elapsed ?? 0;
        if (t > 120) continue;
        if (!earliest || t < earliest.minute) {
          earliest = {
            minute: t,
            scorerId: Number(e.player_id ?? e.player?.id),
            scorerName: e.player_name || e.player?.name,
          };
        }
      }
      if (!earliest?.scorerId) continue;

      let agg = byPlayer.get(earliest.scorerId);
      if (!agg) {
        agg = { player_id: earliest.scorerId, player_name: earliest.scorerName || `Player ${earliest.scorerId}`, opening_goals: 0 };
        byPlayer.set(earliest.scorerId, agg);
      }
      agg.opening_goals++;
    }

    if (byPlayer.size === 0) {
      return res.status(200).json({ league_name: ctx.league_name, season_label: ctx.season_label, players: [] });
    }

    // Enrich with team + image from player_squad_cache
    const playerIds = [...byPlayer.keys()];
    const { data: cacheRows } = await supabase
      .from('player_squad_cache')
      .select('player_id, player_name, team_name, image_path')
      .in('player_id', playerIds);
    const cacheByPlayer = Object.fromEntries((cacheRows || []).map(r => [r.player_id, r]));

    // Enrich with total_goals from player_stats_cache
    const { data: statsRows } = await supabase
      .from('player_stats_cache')
      .select('player_id, goals')
      .in('player_id', playerIds);
    const goalsByPlayer = Object.fromEntries((statsRows || []).map(r => [r.player_id, r.goals ?? 0]));

    const players = [...byPlayer.values()]
      .map(a => {
        const cache = cacheByPlayer[a.player_id];
        return {
          player_id: a.player_id,
          player_name: cache?.player_name || a.player_name,
          team_name: cache?.team_name ?? null,
          team_badge_url: cache?.image_path ?? null,
          opening_goals: a.opening_goals,
          total_goals: goalsByPlayer[a.player_id] ?? null,
        };
      })
      .sort((a, b) => b.opening_goals - a.opening_goals)
      .slice(0, 10)
      .map((p, i) => ({ ...p, rank: i + 1 }));

    return res.status(200).json({
      league_name: ctx.league_name,
      season_label: ctx.season_label,
      players,
    });
  } catch (err) {
    console.error('[stats-gen/first-blood]', err);
    return res.status(500).json({ error: err.message });
  }
}
