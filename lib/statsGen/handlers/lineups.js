// GET /api/stats-gen/lineups?fixture_id=X
// Full lineup data for both teams. Frontend uses lineup_confirmed to swap
// "Predicted XI" ↔ "Confirmed XI" labels — we ship the boolean and the XI.

import { requireStatsGenToken, getSupabase } from '../auth.js';
import { inferFormation } from '../inferFormation.js';

const STARTER_TYPE_ID = 11;
const BENCH_TYPE_ID   = 12;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const fixtureId = parseInt(req.query.fixture_id, 10);
  if (!fixtureId) return res.status(400).json({ error: 'fixture_id is required' });

  const supabase = getSupabase();
  const { data: match, error } = await supabase
    .from('matches')
    .select('id, home_team, away_team, home_team_id, away_team_id, home_logo, away_logo, kickoff_time, lineups, lineup_confirmed')
    .eq('id', fixtureId)
    .single();
  if (error || !match) return res.status(404).json({ error: 'Match not found' });

  const lineups = Array.isArray(match.lineups) ? match.lineups : [];
  const buildSide = (teamId, teamName, teamLogo) => {
    const all      = lineups.filter(e => e?.team_id === teamId);
    const starters = all.filter(e => e.type_id === STARTER_TYPE_ID);
    const subs     = all.filter(e => e.type_id === BENCH_TYPE_ID);
    return {
      team_id: teamId,
      team_name: teamName,
      team_logo: teamLogo,
      formation: inferFormation(starters),
      starters: starters.map(e => ({
        player_id: e.player_id,
        player_name: e.player_name,
        jersey_number: e.jersey_number,
        position_id: e.position_id,
        formation_field: e.formation_field,
      })),
      bench: subs.map(e => ({
        player_id: e.player_id,
        player_name: e.player_name,
        jersey_number: e.jersey_number,
        position_id: e.position_id,
      })),
    };
  };

  return res.status(200).json({
    fixture_id: fixtureId,
    kickoff_time: match.kickoff_time,
    lineup_confirmed: !!match.lineup_confirmed,
    home: buildSide(match.home_team_id, match.home_team, match.home_logo),
    away: buildSide(match.away_team_id, match.away_team, match.away_logo),
  });
}
