// GET /api/stats-gen/impact-window?league_id=X&season=Y
// Distribution of goals scored BY substitutes, bucketed by elapsed minute.
// Reuses the subsOn/goal-after-entry pattern from scripts/settle.js.
//
// Note: the `season` query param is ignored — matches.season is unpopulated
// across the whole table. We resolve the current season via the shared
// resolver (leagues.sportmonks_id → seasons.sportmonks_id) and filter
// completed matches by league_id alone.

import { requireStatsGenToken, getSupabase } from '../../lib/statsGen/auth.js';
import { buildSubsOnMap, findSubGoalsAfterEntry } from '../../lib/statsGen/subsOnMap.js';

const TERMINAL = ['FT', 'AET', 'FT_PEN'];
const BUCKETS = [
  { label: '45-60', min: 45, max: 60 },
  { label: '60-70', min: 60, max: 70 },
  { label: '70-80', min: 70, max: 80 },
  { label: '80-90', min: 80, max: 90 },
  { label: '90+',   min: 90, max: Infinity },
];

function bucketFor(minute) {
  for (const b of BUCKETS) if (minute >= b.min && minute < b.max) return b.label;
  return '90+';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const leagueId = parseInt(req.query.league_id, 10);
  if (!leagueId) return res.status(400).json({ error: 'league_id is required' });

  const supabase = getSupabase();

  const { data: matches, error } = await supabase
    .from('matches')
    .select('id, events')
    .eq('league_id', leagueId)
    .in('status', TERMINAL);
  if (error) return res.status(500).json({ error: error.message });

  const counts = Object.fromEntries(BUCKETS.map(b => [b.label, 0]));
  let totalSubGoals = 0;

  for (const m of (matches || [])) {
    const events = Array.isArray(m.events) ? m.events : [];
    const subsOn = buildSubsOnMap(events, null); // all teams
    const subGoals = findSubGoalsAfterEntry(events, subsOn);
    for (const g of subGoals) {
      counts[bucketFor(g.goalMinute)] += 1;
      totalSubGoals += 1;
    }
  }

  return res.status(200).json({
    league_id: leagueId,
    matches_scanned: matches?.length ?? 0,
    total_sub_goals: totalSubGoals,
    distribution: BUCKETS.map(b => ({
      bucket: b.label,
      count: counts[b.label],
      pct: totalSubGoals > 0 ? Math.round((counts[b.label] / totalSubGoals) * 1000) / 10 : 0,
    })),
  });
}
