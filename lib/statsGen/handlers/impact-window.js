// GET /api/stats-gen/impact-window?league_id=X
// Returns sub goal distribution across time windows.
// Data source: matches.events filtered to sub goals, time-bucketed.

import { requireStatsGenToken, getSupabase } from '../auth.js';
import { resolveLeagueContext } from '../resolveSeason.js';
import { buildSubsOnMap, findSubGoalsAfterEntry } from '../subsOnMap.js';

const TERMINAL = ['FT', 'AET', 'FT_PEN'];
const WINDOWS = [
  { range: '0-15',  min: 0,  max: 16 },
  { range: '16-30', min: 16, max: 31 },
  { range: '31-45', min: 31, max: 46 },
  { range: '46-60', min: 46, max: 61 },
  { range: '61-75', min: 61, max: 76 },
  { range: '76-90', min: 76, max: 91 },
  { range: '90+',   min: 91, max: Infinity },
];

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const leagueId = parseInt(req.query.league_id, 10);
  if (!leagueId) return res.status(400).json({ error: 'league_id required' });

  try {
    const supabase = getSupabase();
    const ctx = await resolveLeagueContext(supabase, leagueId);

    // Paginate — PostgREST caps at 1000 rows
    const allMatches = [];
    const BATCH = 1000;
    for (let offset = 0; ; offset += BATCH) {
      const { data, error } = await supabase
        .from('matches')
        .select('id, events')
        .eq('league_id', leagueId)
        .in('status', TERMINAL)
        .order('kickoff_time', { ascending: false })
        .range(offset, offset + BATCH - 1);
      if (error) throw error;
      if (!data?.length) break;
      allMatches.push(...data);
      if (data.length < BATCH) break;
    }

    const counts = Object.fromEntries(WINDOWS.map(w => [w.range, 0]));

    for (const m of allMatches) {
      const events = Array.isArray(m.events) ? m.events : [];
      const subsOn = buildSubsOnMap(events, null);
      const subGoals = findSubGoalsAfterEntry(events, subsOn);
      for (const g of subGoals) {
        for (const w of WINDOWS) {
          if (g.goalMinute >= w.min && g.goalMinute < w.max) {
            counts[w.range]++;
            break;
          }
        }
      }
    }

    return res.status(200).json({
      league_name: ctx.league_name,
      season_label: ctx.season_label,
      windows: WINDOWS.map(w => ({ range: w.range, sub_goals: counts[w.range] })),
    });
  } catch (err) {
    console.error('[stats-gen/impact-window]', err);
    return res.status(500).json({ error: err.message });
  }
}
