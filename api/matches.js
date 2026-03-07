import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ── Inline league IDs to avoid pathing issues in Vercel's function runtime ──
// Mirrors: src/shared/config/coverage.js → SUPPORTED_LEAGUE_IDS
const SUPPORTED_LEAGUE_IDS = [39, 40, 78, 135, 94];

// ── Lazy Supabase Client ──────────────────────────────────────────────────────
// Only created when the handler actually needs it, so a missing env var at
// module-load time can never crash the entire serverless function.
let _client = null;

function getSupabaseClient() {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      `Missing env vars – SUPABASE_URL: ${url ? '✓' : '✗'}, SUPABASE_SERVICE_ROLE_KEY: ${key ? '✓' : '✗'}`
    );
  }

  _client = createClient(url, key);
  return _client;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  try {
    const supabase = getSupabaseClient();

    const { id, date: dateParam } = req.query;

    // ── SCENARIO 1: Single Match by ID ──
    if (id) {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('id', Number(id))
        .single();

      if (error || !data) {
        return res.status(200).json({ response: [], error: error?.message });
      }

      return res.status(200).json({ response: [data] });
    }

    // ── SCENARIO 2: Date-based feed ──
    const date = dateParam || new Date().toISOString().split('T')[0];

    console.log(`[Matches API] Querying date=${date}`);

    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('date', date)
      .in('league_id', SUPPORTED_LEAGUE_IDS)
      .order('kickoff_time', { ascending: true });

    if (error) {
      return res.status(200).json({ response: [], error: error.message });
    }

    return res.status(200).json({
      response: data || [],
      date_queried: date,
      source: 'supabase',
    });
  } catch (err) {
    // Guarantee a JSON response — never return HTML error pages.
    return res.status(500).json({
      error: 'API_INIT_FAILED',
      message: err.message || 'Environment variables missing on server.',
    });
  }
}