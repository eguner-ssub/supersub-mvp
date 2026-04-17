// GET /api/stats-gen/lineups?fixture_id=X
// Returns starting XI + bench for both teams with lineup_confirmed flag.

import { requireStatsGenToken, getSupabase } from '../auth.js';

const STARTER_TYPE_ID = 11;
const BENCH_TYPE_ID   = 12;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const fixtureId = parseInt(req.query.fixture_id, 10);
  if (!fixtureId) return res.status(400).json({ error: 'fixture_id required' });

  try {
    const supabase = getSupabase();
    const { data: match, error } = await supabase
      .from('matches')
      .select('id, home_team, away_team, home_team_id, away_team_id, home_logo, away_logo, kickoff_time, lineups, lineup_confirmed')
      .eq('id', fixtureId)
      .single();
    if (error || !match) return res.status(404).json({ error: 'Fixture not found' });

    const lineups = Array.isArray(match.lineups) ? match.lineups : [];

    const mapPlayer = (e) => ({
      player_id: e.player_id,
      player_name: e.player_name,
      position: e.position_id ?? null,
      shirt_number: e.jersey_number ?? null,
    });

    const forTeam = (teamId) => lineups.filter(e => e?.team_id === teamId);

    return res.status(200).json({
      fixture_id: fixtureId,
      home_team: match.home_team,
      away_team: match.away_team,
      lineup_confirmed: !!match.lineup_confirmed,
      home_starters: forTeam(match.home_team_id).filter(e => e.type_id === STARTER_TYPE_ID).map(mapPlayer),
      home_bench:    forTeam(match.home_team_id).filter(e => e.type_id === BENCH_TYPE_ID).map(mapPlayer),
      away_starters: forTeam(match.away_team_id).filter(e => e.type_id === STARTER_TYPE_ID).map(mapPlayer),
      away_bench:    forTeam(match.away_team_id).filter(e => e.type_id === BENCH_TYPE_ID).map(mapPlayer),
    });
  } catch (err) {
    console.error('[stats-gen/lineups]', err);
    return res.status(500).json({ error: err.message });
  }
}
