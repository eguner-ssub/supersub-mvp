// GET /api/stats-gen/referee-watch?fixture_id=X
// Returns referee stats for the assigned referee.
// Data source: matches.raw_data.referees + referee_stats table.
// If referee data not available, returns { referee_available: false } gracefully.

import { requireStatsGenToken, getSupabase } from '../auth.js';

const REFEREE_TYPE_ID = 6;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const fixtureId = parseInt(req.query.fixture_id, 10);
  if (!fixtureId) return res.status(400).json({ error: 'fixture_id required' });

  try {
    const supabase = getSupabase();
    const { data: match, error } = await supabase
      .from('matches')
      .select('id, league_id, raw_data')
      .eq('id', fixtureId)
      .single();
    if (error || !match) return res.status(404).json({ error: 'Fixture not found' });

    const referees = Array.isArray(match.raw_data?.referees) ? match.raw_data.referees : [];
    const head = referees.find(r => r?.type_id === REFEREE_TYPE_ID);
    if (!head?.referee_id) {
      return res.status(200).json({ referee_available: false });
    }

    const { data: stats } = await supabase
      .from('referee_stats')
      .select('*')
      .eq('referee_id', head.referee_id)
      .eq('league_id', match.league_id)
      .order('last_synced_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!stats) {
      return res.status(200).json({
        referee_available: false,
        referee_id: head.referee_id,
      });
    }

    const n = stats.matches_officiated || 0;
    const avg = (v) => n > 0 ? Math.round(((v || 0) / n) * 100) / 100 : 0;

    return res.status(200).json({
      referee_available: true,
      referee_name: stats.referee_name,
      matches_officiated_season: n,
      avg_goals_per_match: avg(stats.total_goals),
      avg_cards_per_match: avg((stats.total_yellow_cards || 0) + (stats.total_red_cards || 0)),
      penalties_per_match: avg(stats.total_penalties),
      recent_fixtures: stats.recent_fixtures || [],
    });
  } catch (err) {
    console.error('[stats-gen/referee-watch]', err);
    return res.status(500).json({ error: err.message });
  }
}
