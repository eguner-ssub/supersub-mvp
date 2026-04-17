// GET /api/stats-gen/wasted-bench?fixture_id=X&team_id=Y
// Returns bench players for the given team with their usage in a completed match.
// Data source: matches.events and lineups JSON.

import { requireStatsGenToken, getSupabase } from '../auth.js';

const BENCH_TYPE_ID = 12;
const TERMINAL = ['FT', 'AET', 'FT_PEN'];

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const fixtureId = parseInt(req.query.fixture_id, 10);
  const teamId    = parseInt(req.query.team_id, 10);
  if (!fixtureId || !teamId) return res.status(400).json({ error: 'fixture_id and team_id required' });

  try {
    const supabase = getSupabase();
    const { data: match, error } = await supabase
      .from('matches')
      .select('id, status, lineups, events, home_team_id, away_team_id, home_team, away_team')
      .eq('id', fixtureId)
      .single();
    if (error || !match) return res.status(404).json({ error: 'Fixture not found' });

    if (!TERMINAL.includes(match.status)) {
      return res.status(200).json({ available: false, reason: 'match_not_finished' });
    }

    const lineups = Array.isArray(match.lineups) ? match.lineups : [];
    const events  = Array.isArray(match.events)  ? match.events  : [];

    const bench = lineups.filter(e => e?.type_id === BENCH_TYPE_ID && e.team_id === teamId);

    // Build map of incoming player_id → entry minute from subst events
    const entryByPlayer = new Map();
    for (const e of events) {
      const isSub = e.type_id === 18 || e.type === 'subst';
      if (!isSub) continue;
      const evTeam = e.participant_id ?? e.team?.id;
      if (evTeam !== teamId) continue;
      const incoming = e.player_id ?? e.assist?.id;
      if (incoming == null) continue;
      entryByPlayer.set(Number(incoming), e.minute ?? e.time?.elapsed ?? 0);
    }

    const benchPlayers = bench.map(p => {
      const entry = entryByPlayer.get(Number(p.player_id));
      const minutes = entry !== undefined ? Math.max(0, 90 - entry) : 0;
      return {
        player_name: p.player_name,
        position: p.position_id ?? null,
        status: entry === undefined ? 'UNUSED' : (minutes <= 15 ? 'LOW_MINUTES' : `${minutes}'`),
        minutes_played: minutes,
      };
    });

    // Sort: UNUSED first, then LOW_MINUTES, then by minutes asc
    const rank = r => r.status === 'UNUSED' ? 0 : r.status === 'LOW_MINUTES' ? 1 : 2;
    benchPlayers.sort((a, b) => rank(a) - rank(b) || a.minutes_played - b.minutes_played);

    return res.status(200).json({
      fixture_id: fixtureId,
      team_name: teamId === match.home_team_id ? match.home_team : match.away_team,
      bench_players: benchPlayers,
    });
  } catch (err) {
    console.error('[stats-gen/wasted-bench]', err);
    return res.status(500).json({ error: err.message });
  }
}
