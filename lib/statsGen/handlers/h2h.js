// GET /api/stats-gen/h2h?fixture_id=X
// Returns head-to-head record for the two teams in this fixture.
// Data source: matches table filtered by both team_ids, last 10 meetings.

import { requireStatsGenToken, getSupabase } from '../auth.js';

const TERMINAL = ['FT', 'AET', 'FT_PEN'];

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const fixtureId = parseInt(req.query.fixture_id, 10);
  if (!fixtureId) return res.status(400).json({ error: 'fixture_id required' });

  try {
    const supabase = getSupabase();

    const { data: match, error } = await supabase
      .from('matches')
      .select('id, home_team, away_team, home_team_id, away_team_id')
      .eq('id', fixtureId)
      .single();
    if (error || !match) return res.status(404).json({ error: 'Fixture not found' });

    const { home_team_id, away_team_id } = match;

    // Find last 10 completed meetings between these two teams (in either order)
    const { data: meetings } = await supabase
      .from('matches')
      .select('id, home_team, away_team, home_team_id, away_team_id, home_score, away_score, kickoff_time, date')
      .in('status', TERMINAL)
      .or(`and(home_team_id.eq.${home_team_id},away_team_id.eq.${away_team_id}),and(home_team_id.eq.${away_team_id},away_team_id.eq.${home_team_id})`)
      .neq('id', fixtureId)
      .order('kickoff_time', { ascending: false })
      .limit(10);

    let homeWins = 0, awayWins = 0, draws = 0;

    const recentMatches = (meetings || []).map(m => {
      const h = m.home_score ?? 0;
      const a = m.away_score ?? 0;

      // Determine winner relative to the CURRENT fixture's home/away
      if (h > a) {
        if (m.home_team_id === home_team_id) homeWins++;
        else awayWins++;
      } else if (a > h) {
        if (m.away_team_id === home_team_id) homeWins++;
        else awayWins++;
      } else {
        draws++;
      }

      return {
        date: m.date || m.kickoff_time?.split('T')[0],
        home_team: m.home_team,
        away_team: m.away_team,
        score: `${h}-${a}`,
      };
    });

    return res.status(200).json({
      home_team: match.home_team,
      away_team: match.away_team,
      home_wins: homeWins,
      draws,
      away_wins: awayWins,
      recent_matches: recentMatches,
    });
  } catch (err) {
    console.error('[stats-gen/h2h]', err);
    return res.status(500).json({ error: err.message });
  }
}
