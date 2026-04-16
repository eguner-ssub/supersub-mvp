// GET /api/stats-gen/form-table?fixture_id=X
// League form data for both teams in the given fixture. Mirrors the UUID
// resolver used by the Form Guide fix in api/intel.js — matches stores
// integer team IDs; standings is UUID-keyed, so we look up both UUIDs
// (season + teams) before the standings query.

import { requireStatsGenToken, getSupabase } from '../../lib/statsGen/auth.js';
import { resolveSeasonUuid, resolveTeamUuids } from '../../lib/statsGen/resolveSeason.js';

function parseFormString(s) {
  if (!s || typeof s !== 'string') return [];
  return s.slice(-5).toUpperCase().split('').filter(c => 'WDL'.includes(c));
}

function pointsForForm(arr) {
  let pts = 0;
  for (const c of arr) {
    if (c === 'W') pts += 3;
    else if (c === 'D') pts += 1;
  }
  return pts;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const fixtureId = parseInt(req.query.fixture_id, 10);
  if (!fixtureId) return res.status(400).json({ error: 'fixture_id is required' });

  const supabase = getSupabase();
  const { data: match, error } = await supabase
    .from('matches')
    .select('id, home_team, away_team, home_team_id, away_team_id, home_logo, away_logo, league_id')
    .eq('id', fixtureId)
    .single();
  if (error || !match) return res.status(404).json({ error: 'Match not found' });

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
  if (teamUuids.length === 0) {
    return res.status(200).json({ available: false, reason: 'teams_unresolved' });
  }

  const { data: standings } = await supabase
    .from('standings')
    .select('team_id, position, played, points, form')
    .eq('season_id', seasonUuid)
    .in('team_id', teamUuids);

  const byUuid = Object.fromEntries((standings || []).map(s => [s.team_id, s]));

  const buildSide = (teamSmId, teamUuid, teamName, teamLogo, context) => {
    const s = teamUuid ? byUuid[teamUuid] : null;
    const formArr = parseFormString(s?.form);
    return {
      team_id: teamSmId,
      team_name: teamName,
      team_logo: teamLogo,
      league_position: s?.position ?? null,
      played: s?.played ?? null,
      points: s?.points ?? null,
      form_last_5: formArr,
      form_points_last_5: pointsForForm(formArr),
      home_away_context: context,
    };
  };

  return res.status(200).json({
    available: true,
    fixture_id: fixtureId,
    home: buildSide(match.home_team_id, homeUuid, match.home_team, match.home_logo, 'home'),
    away: buildSide(match.away_team_id, awayUuid, match.away_team, match.away_logo, 'away'),
  });
}
