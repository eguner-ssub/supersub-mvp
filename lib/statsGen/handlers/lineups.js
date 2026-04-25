// GET /api/stats-gen/lineups?fixture_id=X&view=probable|confirmed|auto
// Returns starting XI + bench for both teams.
//
// view=probable  → only return data if lineup_confirmed === false AND
//                  kickoff is in the future. Otherwise unavailable.
// view=confirmed → only return data if lineup_confirmed === true.
//                  Otherwise unavailable with estimated_release hint.
// view=auto      → return whichever is available; response carries `view`.

import { requireStatsGenToken, getSupabase } from '../auth.js';

const STARTER_TYPE_ID = 11;
const BENCH_TYPE_ID   = 12;

function buildLineupPayload(match, view) {
  const lineups = Array.isArray(match.lineups) ? match.lineups : [];
  const mapPlayer = (e) => ({
    player_id: e.player_id,
    player_name: e.player_name,
    position: e.position_id ?? null,
    shirt_number: e.jersey_number ?? null,
  });
  const forTeam = (teamId) => lineups.filter(e => e?.team_id === teamId);

  return {
    fixture_id: match.id,
    home_team: match.home_team,
    away_team: match.away_team,
    lineup_confirmed: !!match.lineup_confirmed,
    view,
    home_starters: forTeam(match.home_team_id).filter(e => e.type_id === STARTER_TYPE_ID).map(mapPlayer),
    home_bench:    forTeam(match.home_team_id).filter(e => e.type_id === BENCH_TYPE_ID).map(mapPlayer),
    away_starters: forTeam(match.away_team_id).filter(e => e.type_id === STARTER_TYPE_ID).map(mapPlayer),
    away_bench:    forTeam(match.away_team_id).filter(e => e.type_id === BENCH_TYPE_ID).map(mapPlayer),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const fixtureId = parseInt(req.query.fixture_id, 10);
  if (!fixtureId) return res.status(400).json({ error: 'fixture_id required' });

  const requestedView = (req.query.view || 'auto').toLowerCase();
  if (!['probable', 'confirmed', 'auto'].includes(requestedView)) {
    return res.status(400).json({ error: 'view must be one of: probable, confirmed, auto' });
  }

  try {
    const supabase = getSupabase();
    const { data: match, error } = await supabase
      .from('matches')
      .select('id, home_team, away_team, home_team_id, away_team_id, home_logo, away_logo, kickoff_time, lineups, lineup_confirmed, status')
      .eq('id', fixtureId)
      .single();
    if (error || !match) return res.status(404).json({ error: 'Fixture not found' });

    const isConfirmed = !!match.lineup_confirmed;
    const kickoffInFuture = match.kickoff_time
      ? new Date(match.kickoff_time).getTime() > Date.now()
      : false;

    if (requestedView === 'probable') {
      if (isConfirmed) {
        return res.status(200).json({
          fixture_id: fixtureId,
          available: false,
          view: 'probable',
          reason: 'lineup_already_confirmed',
        });
      }
      if (!kickoffInFuture) {
        return res.status(200).json({
          fixture_id: fixtureId,
          available: false,
          view: 'probable',
          reason: 'match_already_started',
        });
      }
      return res.status(200).json({ available: true, ...buildLineupPayload(match, 'probable') });
    }

    if (requestedView === 'confirmed') {
      if (!isConfirmed) {
        return res.status(200).json({
          fixture_id: fixtureId,
          available: false,
          view: 'confirmed',
          reason: 'lineup_not_yet_confirmed',
          estimated_release: 'approximately 1 hour before kickoff',
        });
      }
      return res.status(200).json({ available: true, ...buildLineupPayload(match, 'confirmed') });
    }

    // auto: return whichever fits, biased to confirmed when both true
    const view = isConfirmed ? 'confirmed' : 'probable';
    return res.status(200).json({ available: true, ...buildLineupPayload(match, view) });
  } catch (err) {
    console.error('[stats-gen/lineups]', err);
    return res.status(500).json({ error: err.message });
  }
}
