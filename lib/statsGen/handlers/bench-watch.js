// GET /api/stats-gen/bench-watch?fixture_id=X
// Returns bench players for both teams ranked by sub goals with goals_per_90
// and threat level. Reads from player_supersub_stats (migration 028).
// Assists intentionally excluded — not used by the app anywhere today.

import { requireStatsGenToken, getSupabase } from '../auth.js';

const BENCH_TYPE_ID = 12;         // Sportmonks: starter=11, bench=12
const GK_POSITION_ID = 24;        // Sportmonks position_id for goalkeepers

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const fixtureId = parseInt(req.query.fixture_id, 10);
  if (!fixtureId) return res.status(400).json({ error: 'fixture_id required' });

  try {
    const supabase = getSupabase();

    const { data: match, error } = await supabase
      .from('matches')
      .select('id, home_team_id, away_team_id, home_team, away_team, lineups, lineup_confirmed')
      .eq('id', fixtureId)
      .single();
    if (error || !match) return res.status(404).json({ error: 'Fixture not found' });

    const lineups = Array.isArray(match.lineups) ? match.lineups : [];
    const bench = lineups.filter(e =>
      e?.type_id === BENCH_TYPE_ID && e.position_id !== GK_POSITION_ID
    );

    // Fetch supersub stats for every bench player in one query
    const playerIds = [...new Set(bench.map(e => e.player_id).filter(Boolean))];
    const { data: stats } = playerIds.length
      ? await supabase
          .from('player_supersub_stats')
          .select('player_id, team_id, goals_as_sub, apps_as_sub, minutes_as_sub')
          .in('player_id', playerIds)
      : { data: [] };

    const statsByPlayer = Object.fromEntries((stats || []).map(s => [s.player_id, s]));

    const threatLevel = (goalsPer90) => {
      if (goalsPer90 >= 0.4) return 'high';
      if (goalsPer90 >= 0.15) return 'medium';
      return 'low';
    };

    const buildPlayer = (entry) => {
      const s = statsByPlayer[entry.player_id];
      const goals   = s?.goals_as_sub   ?? 0;
      const minutes = s?.minutes_as_sub ?? 0;
      const per90   = minutes > 0 ? Math.round((goals / minutes) * 90 * 100) / 100 : 0;
      return {
        player_id: entry.player_id,
        player_name: entry.player_name || `Player ${entry.player_id}`,
        position: entry.position_id ?? null,
        sub_goals_season: goals,
        goals_per_90_sub: per90,
        threat_level: threatLevel(per90),
      };
    };

    const homeBench = bench.filter(e => e.team_id === match.home_team_id)
      .map(buildPlayer).sort((a, b) => b.goals_per_90_sub - a.goals_per_90_sub);
    const awayBench = bench.filter(e => e.team_id === match.away_team_id)
      .map(buildPlayer).sort((a, b) => b.goals_per_90_sub - a.goals_per_90_sub);

    return res.status(200).json({
      fixture_id: fixtureId,
      home_team: match.home_team,
      away_team: match.away_team,
      lineup_confirmed: !!match.lineup_confirmed,
      home_bench: homeBench,
      away_bench: awayBench,
    });
  } catch (err) {
    console.error('[stats-gen/bench-watch]', err);
    return res.status(500).json({ error: err.message });
  }
}
