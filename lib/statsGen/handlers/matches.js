// GET /api/stats-gen/matches?status=upcoming|live|finished
//
// Powers the stats-gen match selector. Branches the underlying Supabase
// query per status so the result set stays useful regardless of season phase:
//
//   upcoming → kickoff_time >= now (next 100 fixtures across all leagues)
//   live     → status IN LIVE_STATUS (in-play / half-time / break)
//   finished → status IN FINISHED_STATUS in the last 14 days (100 most recent)
//
// Status param is validated; invalid / missing defaults to 'upcoming'.

import { requireStatsGenToken, getSupabase } from '../auth.js';

// ─── Status constants ────────────────────────────────────────────────────────
// Kept in sync with src/pages/StatsGen.jsx:LIVE_STATUS / FINISHED_STATUS.
// If either side drifts, the frontend's `classifyMatchStatus` safety net still
// catches mismatches — but these SHOULD match.
const LIVE_STATUS = [
  'INPLAY_1ST_HALF', 'INPLAY_2ND_HALF', 'INPLAY_ET', 'INPLAY_ET_SECOND_HALF',
  'INPLAY_PENALTIES', 'HT', 'BREAK', 'EXTRA_TIME_BREAK',
  '1H', '2H', 'ET', 'BT', 'P',
];

const FINISHED_STATUS = [
  'FT', 'FT_PEN', 'AET', 'PEN', 'FINISHED', 'ENDED', 'AWARDED',
];

// Upcoming fixtures exclude terminally-unplayable states so they don't pollute
// the "Upcoming" list forever. Sportmonks keeps these rows with their original
// future kickoff_time, which would otherwise match the `>= now` filter.
const UPCOMING_EXCLUDE = [
  'POSTPONED', 'CANCELLED', 'ABANDONED', 'SUSPENDED', 'DELETED',
];

const VALID_STATUS_FILTERS = new Set(['upcoming', 'live', 'finished']);
const DEFAULT_STATUS_FILTER = 'upcoming';

const SELECT_COLUMNS = 'id, home_team, away_team, home_logo, away_logo, kickoff_time, date, status, league_id, round_name, league_name';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const supabase = getSupabase();

  const requested = String(req.query.status || '').toLowerCase();
  const statusFilter = VALID_STATUS_FILTERS.has(requested) ? requested : DEFAULT_STATUS_FILTER;

  const nowIso = new Date().toISOString();

  let query = supabase.from('matches').select(SELECT_COLUMNS);

  if (statusFilter === 'upcoming') {
    // Future fixtures only, earliest-first, skip postponed/cancelled/etc.
    query = query
      .gte('kickoff_time', nowIso)
      .not('status', 'in', `(${UPCOMING_EXCLUDE.join(',')})`)
      .order('kickoff_time', { ascending: true })
      .limit(100);
  } else if (statusFilter === 'live') {
    // In-play: status value is authoritative; kickoff ordering is secondary.
    query = query
      .in('status', LIVE_STATUS)
      .order('kickoff_time', { ascending: true })
      .limit(50);
  } else {
    // 'finished' — recent completed matches (last 14 days), newest-first.
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    query = query
      .in('status', FINISHED_STATUS)
      .gte('kickoff_time', cutoff.toISOString())
      .order('kickoff_time', { ascending: false })
      .limit(100);
  }

  const { data, error } = await query;

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ matches: data || [] });
}
