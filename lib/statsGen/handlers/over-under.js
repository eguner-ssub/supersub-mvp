// GET /api/stats-gen/over-under?fixture_id=X
// Over/under 2.5 split derived from H2H history. No external API call —
// reads h2h_cache populated by sync-match-intel.

import { requireStatsGenToken, getSupabase } from '../auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const fixtureId = parseInt(req.query.fixture_id, 10);
  if (!fixtureId) return res.status(400).json({ error: 'fixture_id is required' });

  const supabase = getSupabase();
  const { data: cache } = await supabase
    .from('h2h_cache')
    .select('data, fetched_at')
    .eq('fixture_id', fixtureId)
    .maybeSingle();

  if (!cache) return res.status(200).json({ available: false });

  const historical = Array.isArray(cache.data?.data) ? cache.data.data : [];
  let over = 0;
  let under = 0;
  let totalGoals = 0;
  const scorelines = [];

  for (const fx of historical) {
    const scoresArr = Array.isArray(fx.scores) ? fx.scores : [];
    let home = null, away = null;
    for (const s of scoresArr) {
      if (s.description !== 'CURRENT') continue;
      if (s.score?.participant === 'home') home = s.score.goals;
      else if (s.score?.participant === 'away') away = s.score.goals;
    }
    if (home == null || away == null) continue;
    const g = home + away;
    totalGoals += g;
    if (g > 2) over++; else under++;

    const participants = Array.isArray(fx.participants) ? fx.participants : [];
    const pHome = participants.find(p => p?.meta?.location === 'home');
    const pAway = participants.find(p => p?.meta?.location === 'away');
    scorelines.push({
      fixture_id: fx.id,
      starting_at: fx.starting_at,
      home_team: pHome?.name,
      away_team: pAway?.name,
      score: `${home}-${away}`,
    });
  }

  const sample = over + under;
  const recent = scorelines.sort((a, b) => new Date(b.starting_at) - new Date(a.starting_at)).slice(0, 3);

  return res.status(200).json({
    available: true,
    fetched_at: cache.fetched_at,
    sample_size: sample,
    over_count: over,
    under_count: under,
    over_pct:  sample > 0 ? Math.round((over  / sample) * 100) : 0,
    under_pct: sample > 0 ? Math.round((under / sample) * 100) : 0,
    avg_goals_h2h: sample > 0 ? Math.round((totalGoals / sample) * 100) / 100 : 0,
    recent_scorelines: recent,
  });
}
