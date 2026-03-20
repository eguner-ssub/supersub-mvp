import { createClient } from '@supabase/supabase-js';
import { syncMatchIntel } from '../../scripts/sync-match-intel.js';

// ── Lazy Supabase client ──────────────────────────────────────────────────────
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
 * POST /api/cron/sync-match-intel
 *
 * Daily cron — generates pre-match intel reports for upcoming fixtures.
 * Protected by CRON_SECRET bearer token.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'CRON_SECRET env var not configured' });
  }
  if (req.headers['authorization'] !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const supabase = getSupabaseClient();
    const refreshed = await syncMatchIntel(supabase);

    return res.status(200).json({
      ok: true,
      refreshed,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[cron/sync-match-intel] Fatal error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
