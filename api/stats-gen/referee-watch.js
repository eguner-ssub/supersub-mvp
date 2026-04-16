// GET /api/stats-gen/referee-watch?fixture_id=X
// Returns aggregate stats for the referee assigned to the upcoming fixture.
// Depends on (a) sync-scores including `referees` in the pre-live fetch so
// raw_data.referees is populated, and (b) sync-referee-stats.js having been
// run at least once for historical aggregation.

import { requireStatsGenToken, getSupabase } from '../../lib/statsGen/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const fixtureId = parseInt(req.query.fixture_id, 10);
  if (!fixtureId) return res.status(400).json({ error: 'fixture_id is required' });

  const supabase = getSupabase();

  const { data: match, error } = await supabase
    .from('matches')
    .select('id, league_id, raw_data')
    .eq('id', fixtureId)
    .single();
  if (error || !match) return res.status(404).json({ error: 'Match not found' });

  const referees = Array.isArray(match.raw_data?.referees) ? match.raw_data.referees : [];
  const head = referees.find(r => r?.type?.developer_name === 'REFEREE');
  if (!head?.id) {
    return res.status(200).json({ available: false, reason: 'no_referee_on_fixture' });
  }

  // We don't filter by season here — the aggregate script keys on
  // (referee_id, season_id, league_id), but any single referee should have
  // at most one active season row per league. Grab the most recently synced.
  const { data: stats } = await supabase
    .from('referee_stats')
    .select('*')
    .eq('referee_id', head.id)
    .eq('league_id', match.league_id)
    .order('last_synced_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!stats) {
    return res.status(200).json({
      available: false,
      reason: 'no_stats_synced',
      referee_id: head.id,
      referee_name: head.fullname || head.name || head.common_name || `Referee ${head.id}`,
    });
  }

  const n = stats.matches_officiated || 0;
  const avg = (v) => n > 0 ? Math.round(((v || 0) / n) * 100) / 100 : 0;

  return res.status(200).json({
    available: true,
    referee_id: stats.referee_id,
    referee_name: stats.referee_name,
    matches_officiated: n,
    avg_goals:         avg(stats.total_goals),
    avg_yellows:       avg(stats.total_yellow_cards),
    avg_reds:          avg(stats.total_red_cards),
    penalties_per_match: avg(stats.total_penalties),
    over_2_5_pct: n > 0 ? Math.round(((stats.over_2_5_count || 0) / n) * 100) : 0,
    recent_fixtures: stats.recent_fixtures || [],
  });
}
