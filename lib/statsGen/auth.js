// Shared helpers for the /api/stats-gen/* surface.
//
// Every endpoint under api/stats-gen/ imports requireStatsGenToken() and
// calls it at the top of the handler. When the header is missing or wrong
// the helper writes a 401 response itself and returns false; callers bail
// out immediately so no further logic runs.
//
// Kept outside the api/ directory so Vercel doesn't treat it as an endpoint.

import { createClient } from '@supabase/supabase-js';

const HEADER = 'x-stats-gen-token';

/**
 * Check the x-stats-gen-token header. On failure, write a 401 JSON body
 * and return false. On success, return true so the handler can continue.
 *
 * The password is compared byte-for-byte; there's no timing-safe compare
 * because the token is short, non-secret-salted, and sent in clear over
 * HTTPS — it's admin-gate protection, not a cryptographic primitive.
 */
export function requireStatsGenToken(req, res) {
  const expected = process.env.STATS_GEN_PASSWORD;
  if (!expected) {
    res.status(500).json({ error: 'STATS_GEN_PASSWORD not configured' });
    return false;
  }
  const got = req.headers?.[HEADER];
  if (!got || got !== expected) {
    res.status(401).json({ error: 'Unauthorised' });
    return false;
  }
  return true;
}

// ── Lazy Supabase client (service role) ─────────────────────────────────────
let _client = null;

export function getSupabase() {
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
