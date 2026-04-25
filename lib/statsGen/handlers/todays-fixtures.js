// GET /api/stats-gen/todays-fixtures?league_id=X
// Today's fixtures for a single league. Pure SQL read, no compute.

import { requireStatsGenToken, getSupabase } from '../auth.js';
import { resolveLeagueContext } from '../resolveSeason.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const leagueId = parseInt(req.query.league_id, 10);
  if (!leagueId) return res.status(400).json({ error: 'league_id required' });

  try {
    const supabase = getSupabase();
    const ctx = await resolveLeagueContext(supabase, leagueId);
    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('matches')
      .select('id, home_team, away_team, home_logo, away_logo, kickoff_time, status, round_name, raw_data')
      .eq('date', today)
      .eq('league_id', leagueId)
      .order('kickoff_time', { ascending: true });
    if (error) throw error;

    const fixtures = (data || []).map(m => ({
      id: m.id,
      home_team: m.home_team,
      away_team: m.away_team,
      home_logo: m.home_logo,
      away_logo: m.away_logo,
      kickoff_time: m.kickoff_time,
      status: m.status,
      round_name: m.round_name,
      venue: m.raw_data?.venue?.name ?? m.raw_data?.venue ?? null,
    }));

    return res.status(200).json({
      league_id: leagueId,
      league_name: ctx.league_name,
      date: today,
      fixtures,
    });
  } catch (err) {
    console.error('[stats-gen/todays-fixtures]', err);
    return res.status(500).json({ error: err.message });
  }
}
