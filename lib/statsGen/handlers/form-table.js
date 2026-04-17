// GET /api/stats-gen/form-table?fixture_id=X
// Returns both teams' league position and last 5 form dots.
// Data source: standings table (UUID-keyed) + matches table.

import { requireStatsGenToken, getSupabase } from '../auth.js';
import { resolveSeasonUuid, resolveTeamUuids } from '../resolveSeason.js';

function parseFormString(s) {
  if (!s || typeof s !== 'string') return [];
  return s.slice(-5).toUpperCase().split('').filter(c => 'WDL'.includes(c));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const fixtureId = parseInt(req.query.fixture_id, 10);
  if (!fixtureId) return res.status(400).json({ error: 'fixture_id required' });

  try {
    const supabase = getSupabase();
    const { data: match, error } = await supabase
      .from('matches')
      .select('id, home_team, away_team, home_team_id, away_team_id, home_logo, away_logo, league_id')
      .eq('id', fixtureId)
      .single();
    if (error || !match) return res.status(404).json({ error: 'Fixture not found' });

    const [seasonUuid, teamMap] = await Promise.all([
      resolveSeasonUuid(supabase, match.league_id),
      resolveTeamUuids(supabase, [match.home_team_id, match.away_team_id]),
    ]);

    if (!seasonUuid) {
      return res.status(200).json({ available: false, reason: 'season_unresolved' });
    }

    const homeUuid = teamMap.get(match.home_team_id);
    const awayUuid = teamMap.get(match.away_team_id);
    const teamUuids = [homeUuid, awayUuid].filter(Boolean);
    if (!teamUuids.length) {
      return res.status(200).json({ available: false, reason: 'teams_unresolved' });
    }

    const { data: standings } = await supabase
      .from('standings')
      .select('team_id, position, played, points, form')
      .eq('season_id', seasonUuid)
      .in('team_id', teamUuids);

    const byUuid = Object.fromEntries((standings || []).map(s => [s.team_id, s]));

    const buildSide = (teamUuid, teamName, teamLogo) => {
      const s = teamUuid ? byUuid[teamUuid] : null;
      return {
        name: teamName,
        badge: teamLogo,
        position: s?.position ?? null,
        form: parseFormString(s?.form),
      };
    };

    return res.status(200).json({
      home_team: buildSide(homeUuid, match.home_team, match.home_logo),
      away_team: buildSide(awayUuid, match.away_team, match.away_logo),
    });
  } catch (err) {
    console.error('[stats-gen/form-table]', err);
    return res.status(500).json({ error: err.message });
  }
}
