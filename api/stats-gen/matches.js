// GET /api/stats-gen/matches
// Powers the match selector — returns upcoming + recent matches from the
// last 7 days onward, ordered by kickoff_time ascending.

import { requireStatsGenToken, getSupabase } from '../../lib/statsGen/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const supabase = getSupabase();

  // date is the YYYY-MM-DD column (migration 008); kickoff_time drives ordering.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('matches')
    .select('id, home_team, away_team, home_logo, away_logo, kickoff_time, date, status, league_id, round_name, league_name')
    .gte('date', cutoffDate)
    .order('kickoff_time', { ascending: true })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ matches: data || [] });
}
