// GET /api/stats-gen/fpl-watch?gameweek=Y
// Wraps fpl_transfers table data. EPL-only — no league_id param.
// Available fields from fpl_transfers: web_name, team_name, now_cost,
// transfers_in_event, form, total_points. Some spec'd fields
// (fpl_ownership_pct, fpl_points_last_gw) aren't stored — returned as null.

import { requireStatsGenToken, getSupabase } from '../auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const gameweek = req.query.gameweek?.trim() || null;

  try {
    const supabase = getSupabase();

    const { data: players, error } = await supabase
      .from('fpl_transfers')
      .select('player_id, web_name, team_name, now_cost, transfers_in_event, form, total_points, photo_url')
      .order('transfers_in_event', { ascending: false })
      .limit(20);
    if (error) throw error;

    const rows = (players || []).map((p, i) => ({
      player_name: p.web_name,
      team_name: p.team_name,
      team_badge_url: p.photo_url || null,
      fpl_ownership_pct: null,       // not stored in fpl_transfers
      fpl_points_last_gw: null,      // not stored — total_points is season total
      fpl_total_points: p.total_points,
      fpl_price: p.now_cost,
      fpl_form: p.form,
      transfers_in_gw: p.transfers_in_event,
      rank: i + 1,
    }));

    return res.status(200).json({
      gameweek: gameweek || 'current',
      players: rows,
    });
  } catch (err) {
    console.error('[stats-gen/fpl-watch]', err);
    return res.status(500).json({ error: err.message });
  }
}
