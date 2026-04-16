// GET /api/stats-gen/h2h?fixture_id=X
// Head-to-head summary derived from h2h_cache. Cache is populated by
// scripts/sync-match-intel.js per-fixture with a 72h TTL.

import { requireStatsGenToken, getSupabase } from '../auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const fixtureId = parseInt(req.query.fixture_id, 10);
  if (!fixtureId) return res.status(400).json({ error: 'fixture_id is required' });

  const supabase = getSupabase();

  // Pull cache row + current fixture so we know which side is "home" now
  const [{ data: cache }, { data: match }] = await Promise.all([
    supabase.from('h2h_cache').select('team1_id, team2_id, data, fetched_at').eq('fixture_id', fixtureId).maybeSingle(),
    supabase.from('matches').select('home_team_id, away_team_id, home_team, away_team').eq('id', fixtureId).maybeSingle(),
  ]);

  if (!cache) return res.status(200).json({ available: false });

  const homeId = match?.home_team_id ?? cache.team1_id;
  const awayId = match?.away_team_id ?? cache.team2_id;

  // Sportmonks head-to-head response: { data: [{ id, scores:[...], participants:[...], starting_at, ... }] }
  const historicalFixtures = Array.isArray(cache.data?.data) ? cache.data.data : [];

  let homeWins = 0;
  let awayWins = 0;
  let draws    = 0;
  let totalGoals = 0;
  let over25Count = 0;
  const scorelines = [];

  for (const fx of historicalFixtures) {
    // Sportmonks score shape: scores = [{ participant_id, score:{goals, participant:'home'|'away'} }, ...]
    const scoresArr = Array.isArray(fx.scores) ? fx.scores : [];
    let home = null, away = null;
    for (const s of scoresArr) {
      // Prefer the 'CURRENT' description; fall back to 'FT' or first match
      const participantSide = s.score?.participant;
      if (s.description !== 'CURRENT') continue;
      if (participantSide === 'home') home = s.score.goals;
      else if (participantSide === 'away') away = s.score.goals;
    }
    if (home == null || away == null) continue;

    totalGoals += home + away;
    if (home + away > 2) over25Count += 1;

    // Identify which historical participant is our current home/away
    const participants = Array.isArray(fx.participants) ? fx.participants : [];
    const pHome = participants.find(p => p?.meta?.location === 'home');
    const pAway = participants.find(p => p?.meta?.location === 'away');

    // Winner from that match
    let winnerSide = home > away ? 'home' : away > home ? 'away' : null;
    let winnerTeamId = null;
    if (winnerSide === 'home') winnerTeamId = pHome?.id;
    else if (winnerSide === 'away') winnerTeamId = pAway?.id;

    if (winnerTeamId == null) draws++;
    else if (winnerTeamId === homeId) homeWins++;
    else if (winnerTeamId === awayId) awayWins++;
    else draws++;

    scorelines.push({
      fixture_id: fx.id,
      starting_at: fx.starting_at,
      home_team: pHome?.name,
      away_team: pAway?.name,
      score: `${home}-${away}`,
    });
  }

  const sorted = scorelines.sort((a, b) => new Date(b.starting_at) - new Date(a.starting_at));
  const last3  = sorted.slice(0, 3);
  const last   = sorted[0] || null;
  const total  = homeWins + awayWins + draws;

  return res.status(200).json({
    available: true,
    fetched_at: cache.fetched_at,
    total_meetings: total,
    home_wins: homeWins,
    away_wins: awayWins,
    draws,
    avg_goals: total > 0 ? Math.round((totalGoals / total) * 100) / 100 : 0,
    over_2_5_pct: total > 0 ? Math.round((over25Count / total) * 100) : 0,
    last_meeting: last,
    recent_scorelines: last3,
  });
}
