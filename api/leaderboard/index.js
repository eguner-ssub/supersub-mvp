import { createClient } from '@supabase/supabase-js';
import { getPeriodKey, getPeriodLabel } from '../../lib/leaderboard/periods.js';

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
 * GET /api/leaderboard?type=global&period=all_time&limit=100&offset=0
 * GET /api/leaderboard?type=league&scope=8&period=weekly
 * GET /api/leaderboard?type=country&scope=GB&period=monthly
 *
 * Returns cached leaderboard entries with user profiles.
 * Optionally returns the requesting user's own entry if authenticated.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabaseClient();

    const type   = req.query.type || 'global';
    const scope  = req.query.scope || null;
    const period = req.query.period || 'all_time';
    const limit  = Math.min(parseInt(req.query.limit) || 100, 500);
    const offset = parseInt(req.query.offset) || 0;

    // Validate type
    if (!['global', 'country', 'league'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type — must be global, country, or league' });
    }
    if (!['all_time', 'season', 'weekly', 'monthly'].includes(period)) {
      return res.status(400).json({ error: 'Invalid period — must be all_time, season, weekly, or monthly' });
    }

    // Look up leaderboard
    let query = supabase
      .from('leaderboards')
      .select('id, type, scope_key, name, icon_url')
      .eq('type', type);

    if (scope) {
      query = query.eq('scope_key', scope);
    } else {
      query = query.is('scope_key', null);
    }

    const { data: leaderboard, error: lbErr } = await query.single();
    if (lbErr || !leaderboard) {
      return res.status(404).json({ error: 'Leaderboard not found' });
    }

    // Resolve period key
    const seasonId = scope && type === 'league' ? parseInt(scope, 10) : undefined;
    const periodKey = getPeriodKey(period, seasonId);

    // Fetch entries
    const { data: entries, error: entryErr } = await supabase
      .from('leaderboard_entries')
      .select('rank, points, bet_count, win_count, total_entries, user_id, updated_at')
      .eq('leaderboard_id', leaderboard.id)
      .eq('period_type', period)
      .eq('period_key', periodKey)
      .order('rank', { ascending: true })
      .range(offset, offset + limit - 1);

    if (entryErr) {
      return res.status(500).json({ error: entryErr.message });
    }

    // Fetch profiles for display names
    const userIds = (entries || []).map((e) => e.user_id);
    let profileMap = new Map();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, club_name')
        .in('id', userIds);
      profileMap = new Map((profiles || []).map((p) => [p.id, p.club_name]));
    }

    // Check if current user is authenticated (optional)
    let yourEntry = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: myEntry } = await supabase
          .from('leaderboard_entries')
          .select('rank, points, bet_count, win_count, total_entries')
          .eq('leaderboard_id', leaderboard.id)
          .eq('period_type', period)
          .eq('period_key', periodKey)
          .eq('user_id', user.id)
          .single();
        yourEntry = myEntry || null;
      }
    }

    return res.status(200).json({
      leaderboard: {
        id:       leaderboard.id,
        type:     leaderboard.type,
        name:     leaderboard.name,
        icon_url: leaderboard.icon_url,
      },
      period: {
        type:  period,
        key:   periodKey,
        label: getPeriodLabel(period),
      },
      entries: (entries || []).map((e) => ({
        rank:      e.rank,
        user_id:   e.user_id,
        club_name: profileMap.get(e.user_id) || 'Unknown',
        points:    e.points,
        bet_count: e.bet_count,
        win_count: e.win_count,
      })),
      total_entries: entries?.[0]?.total_entries || 0,
      your_entry: yourEntry,
      updated_at: entries?.[0]?.updated_at || null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
