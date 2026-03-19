import { createClient } from '@supabase/supabase-js';
import { getPeriodLabel } from '../../lib/leaderboard/periods.js';

let _client = null;

function getSupabaseClient() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error(`Missing env vars – SUPABASE_URL: ${url ? '✓' : '✗'}, SUPABASE_SERVICE_ROLE_KEY: ${key ? '✓' : '✗'}`);
  _client = createClient(url, key);
  return _client;
}

/**
 * GET /api/leaderboard/me
 *
 * Returns all of the current user's rankings across all leaderboards.
 * Requires a valid Supabase JWT in the Authorization header.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabaseClient();

    // Authenticate
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Fetch all leaderboard entries for this user
    const { data: entries, error: entryErr } = await supabase
      .from('leaderboard_entries')
      .select('leaderboard_id, period_type, period_key, rank, points, bet_count, win_count, total_entries')
      .eq('user_id', user.id);

    if (entryErr) {
      return res.status(500).json({ error: entryErr.message });
    }

    // Fetch leaderboard metadata
    const lbIds = [...new Set((entries || []).map((e) => e.leaderboard_id))];
    let lbMap = new Map();
    if (lbIds.length > 0) {
      const { data: lbs } = await supabase
        .from('leaderboards')
        .select('id, type, scope_key, name')
        .in('id', lbIds);
      lbMap = new Map((lbs || []).map((lb) => [lb.id, lb]));
    }

    // Get user's country
    const { data: profile } = await supabase
      .from('profiles')
      .select('country_code')
      .eq('id', user.id)
      .single();

    // Organize into structured response
    const response = {
      global:  {},
      country: profile?.country_code ? { code: profile.country_code } : null,
      leagues: [],
    };

    const leagueMap = new Map(); // scope_key → { league_id, name, periods }

    for (const entry of (entries || [])) {
      const lb = lbMap.get(entry.leaderboard_id);
      if (!lb) continue;

      const periodData = {
        rank:   entry.rank,
        points: entry.points,
        total:  entry.total_entries,
        label:  getPeriodLabel(entry.period_type),
      };

      if (lb.type === 'global') {
        response.global[entry.period_type] = periodData;
      } else if (lb.type === 'country') {
        if (!response.country) {
          response.country = { code: lb.scope_key };
        }
        response.country[entry.period_type] = periodData;
      } else if (lb.type === 'league') {
        if (!leagueMap.has(lb.scope_key)) {
          leagueMap.set(lb.scope_key, {
            league_id: parseInt(lb.scope_key, 10),
            name:      lb.name,
          });
        }
        const league = leagueMap.get(lb.scope_key);
        league[entry.period_type] = periodData;
      }
    }

    response.leagues = [...leagueMap.values()];

    return res.status(200).json(response);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
