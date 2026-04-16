// GET /api/stats-gen/wasted-bench?fixture_id=X&team_id=Y
// Bench players who were unused or had minimal impact in a completed match.
// Minutes-played is approximated as (90 - entry_minute) since Sportmonks
// substitution events only carry entry minute, not exit minute.

import { requireStatsGenToken, getSupabase } from '../../lib/statsGen/auth.js';

const BENCH_TYPE_ID = 12;
const TERMINAL = ['FT', 'AET', 'FT_PEN'];
const LOW_MINUTES_THRESHOLD = 15;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const fixtureId = parseInt(req.query.fixture_id, 10);
  const teamId    = parseInt(req.query.team_id, 10);
  if (!fixtureId || !teamId) return res.status(400).json({ error: 'fixture_id and team_id are required' });

  const supabase = getSupabase();
  const { data: match, error } = await supabase
    .from('matches')
    .select('id, status, lineups, events, home_team_id, away_team_id, home_team, away_team')
    .eq('id', fixtureId)
    .single();
  if (error || !match) return res.status(404).json({ error: 'Match not found' });

  if (!TERMINAL.includes(match.status)) {
    return res.status(200).json({ available: false, reason: 'match_not_finished' });
  }

  const lineups = Array.isArray(match.lineups) ? match.lineups : [];
  const events  = Array.isArray(match.events)  ? match.events  : [];

  // Bench players for the requested team
  const bench = lineups.filter(e => e?.type_id === BENCH_TYPE_ID && e.team_id === teamId);

  // Subst events for the team, by incoming player id → entry minute
  const entryByPlayer = new Map();
  for (const e of events) {
    const isSub = e.type_id === 18 || e.type === 'subst';
    if (!isSub) continue;
    const evTeam = e.participant_id ?? e.team?.id;
    if (evTeam !== teamId) continue;
    const incoming = e.player_id ?? e.assist?.id;
    if (incoming == null) continue;
    const minute = e.minute ?? e.time?.elapsed ?? 0;
    entryByPlayer.set(Number(incoming), minute);
  }

  const rows = bench.map(p => {
    const entry = entryByPlayer.get(Number(p.player_id));
    if (entry === undefined) {
      return {
        player_id: p.player_id,
        player_name: p.player_name,
        jersey_number: p.jersey_number,
        position_id: p.position_id,
        entry_minute: null,
        minutes_played: 0,
        status_label: 'UNUSED',
      };
    }
    const mins = Math.max(0, 90 - entry);
    return {
      player_id: p.player_id,
      player_name: p.player_name,
      jersey_number: p.jersey_number,
      position_id: p.position_id,
      entry_minute: entry,
      minutes_played: mins,
      status_label: mins <= LOW_MINUTES_THRESHOLD ? 'LOW MINUTES' : `${mins}'`,
    };
  });

  // Sort: UNUSED first, then LOW MINUTES, then by minutes asc
  const rank = r => r.status_label === 'UNUSED' ? 0 : r.status_label === 'LOW MINUTES' ? 1 : 2;
  rows.sort((a, b) => rank(a) - rank(b) || a.minutes_played - b.minutes_played);

  return res.status(200).json({
    available: true,
    fixture_id: fixtureId,
    team_id: teamId,
    team_name: teamId === match.home_team_id ? match.home_team : match.away_team,
    players: rows,
  });
}
