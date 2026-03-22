import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/news
 *
 * Query params:
 *   league_id  — filter by league (e.g. 8 for EPL)
 *   team_id    — filter by specific team UUID
 *   limit      — max articles to return (default 20, max 50)
 *   offset     — pagination offset (default 0)
 *
 * Response:
 *   { articles: [...], total: N, nextFixture: { ... } | null }
 *
 * nextFixture is included when team_id is provided and the team
 * has a match within the next 7 days (for the supersub CTA).
 */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 50;
const NEXT_FIXTURE_DAYS = 7;

// ── Lazy Supabase client ──────────────────────────────────────────────────────
let _client = null;

function getSupabaseClient() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  _client = createClient(url, key);
  return _client;
}

// ── Next fixture lookup (for supersub CTA) ────────────────────────────────────
async function getNextFixture(supabase, teamId) {
  const now      = new Date();
  const cutoff   = new Date(now.getTime() + NEXT_FIXTURE_DAYS * 24 * 60 * 60 * 1000);

  // Find this team's next unplayed match within the 7-day window
  const { data, error } = await supabase
    .from('matches')
    .select('id, home_team, away_team, home_team_id, away_team_id, kickoff_time, league_id')
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .gt('kickoff_time', now.toISOString())
    .lte('kickoff_time', cutoff.toISOString())
    .in('status', ['NS', 'TBD', 'SCHED'])
    .order('kickoff_time', { ascending: true })
    .limit(1)
    .single();

  if (error || !data) return null;

  return {
    matchId:     data.id,
    homeTeam:    data.home_team,
    awayTeam:    data.away_team,
    kickoffTime: data.kickoff_time,
    leagueId:    data.league_id,
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { league_id, team_id, offset: rawOffset } = req.query;
  const limit  = Math.min(parseInt(req.query.limit) || DEFAULT_LIMIT, MAX_LIMIT);
  const offset = parseInt(rawOffset) || 0;

  if (!league_id && !team_id) {
    return res.status(400).json({ error: 'Provide at least one of: league_id, team_id' });
  }

  try {
    const supabase = getSupabaseClient();

    // ── Build query ───────────────────────────────────────────────────────────
    let query = supabase
      .from('news_intel')
      .select('id, title, summary, url, source, team_id, league_id, published_at, created_at', { count: 'exact' })
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (team_id) {
      // Team filter takes precedence — shows only articles tagged to this team
      query = query.eq('team_id', team_id);
    } else if (league_id) {
      query = query.eq('league_id', parseInt(league_id));
    }

    const { data: articles, error, count } = await query;

    if (error) {
      console.error('[api/news] Query error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch news' });
    }

    // ── Next fixture CTA ──────────────────────────────────────────────────────
    let nextFixture = null;
    if (team_id) {
      nextFixture = await getNextFixture(supabase, team_id);
    }

    return res.status(200).json({
      articles:    articles || [],
      total:       count    || 0,
      limit,
      offset,
      nextFixture,
    });

  } catch (err) {
    console.error('[api/news] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
