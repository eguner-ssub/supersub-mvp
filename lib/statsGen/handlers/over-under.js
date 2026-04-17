// GET /api/stats-gen/over-under?fixture_id=X
// Returns over/under 2.5 goals split for both teams' recent form.
// Data source: matches table, last 10 completed matches per team.

import { requireStatsGenToken, getSupabase } from '../auth.js';

const TERMINAL = ['FT', 'AET', 'FT_PEN'];

async function teamRecentForm(supabase, teamId, excludeFixtureId) {
  // Matches where this team played (home OR away), excluding the current fixture
  const { data } = await supabase
    .from('matches')
    .select('id, home_team_id, away_team_id, home_score, away_score, date, home_team, away_team')
    .in('status', TERMINAL)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .neq('id', excludeFixtureId)
    .order('kickoff_time', { ascending: false })
    .limit(10);

  let over = 0, under = 0;
  const scores = [];

  for (const m of (data || [])) {
    const total = (m.home_score ?? 0) + (m.away_score ?? 0);
    if (total > 2) over++; else under++;
    scores.push({
      date: m.date,
      home_team: m.home_team,
      away_team: m.away_team,
      score: `${m.home_score ?? 0}-${m.away_score ?? 0}`,
    });
  }

  const n = over + under;
  return {
    over_pct:  n > 0 ? Math.round((over / n) * 100) : 0,
    under_pct: n > 0 ? Math.round((under / n) * 100) : 0,
    sample_size: n,
    recent_scores: scores,
  };
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
      .select('id, home_team, away_team, home_team_id, away_team_id')
      .eq('id', fixtureId)
      .single();
    if (error || !match) return res.status(404).json({ error: 'Fixture not found' });

    const [home, away] = await Promise.all([
      teamRecentForm(supabase, match.home_team_id, fixtureId),
      teamRecentForm(supabase, match.away_team_id, fixtureId),
    ]);

    return res.status(200).json({
      home_team: match.home_team,
      away_team: match.away_team,
      home_over_pct: home.over_pct,
      home_under_pct: home.under_pct,
      away_over_pct: away.over_pct,
      away_under_pct: away.under_pct,
      sample_size: Math.max(home.sample_size, away.sample_size),
      recent_home_scores: home.recent_scores,
      recent_away_scores: away.recent_scores,
    });
  } catch (err) {
    console.error('[stats-gen/over-under]', err);
    return res.status(500).json({ error: err.message });
  }
}
