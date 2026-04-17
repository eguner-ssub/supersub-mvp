// GET /api/stats-gen/goal-glut?league_id=X&gameweek=Y
// Dual mode:
//   No gameweek → season-wide: goals per GW across all weeks
//   gameweek=Y  → single GW: matches + goals for that round only
// Data source: matches table, completed fixtures grouped by round_name.

import { requireStatsGenToken, getSupabase } from '../auth.js';
import { resolveLeagueContext } from '../resolveSeason.js';

const TERMINAL = ['FT', 'AET', 'FT_PEN'];

function extractRoundNumber(name) {
  const m = /(\d+)/.exec(name || '');
  return m ? parseInt(m[1], 10) : 0;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const leagueId = parseInt(req.query.league_id, 10);
  if (!leagueId) return res.status(400).json({ error: 'league_id required' });

  const gameweek = req.query.gameweek?.trim() || null;

  try {
    const supabase = getSupabase();
    const ctx = await resolveLeagueContext(supabase, leagueId);

    // ── Single GW mode ─────────────────────────────────────────────────
    if (gameweek) {
      const { data: gwMatches, error } = await supabase
        .from('matches')
        .select('id, home_team, away_team, home_score, away_score, round_name, date')
        .eq('league_id', leagueId)
        .ilike('round_name', `%${gameweek}%`)
        .in('status', TERMINAL)
        .order('kickoff_time', { ascending: true });
      if (error) throw error;

      const totalGoals = (gwMatches || []).reduce(
        (s, m) => s + (m.home_score ?? 0) + (m.away_score ?? 0), 0
      );

      return res.status(200).json({
        league_name: ctx.league_name,
        season_label: ctx.season_label,
        mode: 'single',
        gameweek,
        total_goals: totalGoals,
        matches: (gwMatches || []).map(m => ({
          home_team: m.home_team,
          away_team: m.away_team,
          score: `${m.home_score ?? 0}-${m.away_score ?? 0}`,
          date: m.date,
        })),
      });
    }

    // ── Season-wide mode ───────────────────────────────────────────────
    const { data: matches, error } = await supabase
      .from('matches')
      .select('round_name, home_score, away_score')
      .eq('league_id', leagueId)
      .in('status', TERMINAL)
      .not('round_name', 'is', null);
    if (error) throw error;

    const byRound = new Map();
    for (const m of (matches || [])) {
      let agg = byRound.get(m.round_name);
      if (!agg) { agg = { total_goals: 0, matches: 0 }; byRound.set(m.round_name, agg); }
      agg.matches++;
      agg.total_goals += (m.home_score ?? 0) + (m.away_score ?? 0);
    }

    const gameweeks = [...byRound.entries()]
      .map(([name, agg]) => ({ gameweek: name, total_goals: agg.total_goals, round_number: extractRoundNumber(name) }))
      .sort((a, b) => a.round_number - b.round_number)
      .map(({ round_number, ...rest }) => rest);

    const peak = gameweeks.reduce((best, g) =>
      !best || g.total_goals > best.total_goals ? g : best, null
    );

    return res.status(200).json({
      league_name: ctx.league_name,
      season_label: ctx.season_label,
      mode: 'season',
      gameweeks,
      peak_gameweek: peak?.gameweek ?? null,
    });
  } catch (err) {
    console.error('[stats-gen/goal-glut]', err);
    return res.status(500).json({ error: err.message });
  }
}
