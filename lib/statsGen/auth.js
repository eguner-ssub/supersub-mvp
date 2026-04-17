// Shared helpers for the /api/stats-gen/* surface.
//
// Dual-mode auth: accepts either an interactive password header
// (x-stats-gen-password) or a machine service token (x-stats-gen-service-token).
// The dispatcher calls requireStatsGenAuth() once; individual handlers can
// inspect `mode` if they need to distinguish callers.
//
// Backward-compatible: requireStatsGenToken(req, res) still works for the
// 15 existing handlers that call it — wraps requireStatsGenAuth internally.
//
// Kept outside the api/ directory so Vercel doesn't treat it as an endpoint.

import { createClient } from '@supabase/supabase-js';

/**
 * Dual-mode auth gate for internal tooling.
 * Returns { ok: true, mode: 'user' | 'service' } on success,
 *         { ok: false } on failure.
 * Does NOT write a response — caller handles the 401.
 */
export function requireStatsGenAuth(req) {
  const password     = req.headers?.['x-stats-gen-password'];
  const serviceToken = req.headers?.['x-stats-gen-service-token'];
  // Also accept the legacy header for transition period
  const legacyToken  = req.headers?.['x-stats-gen-token'];

  const validPassword     = process.env.STATS_GEN_PASSWORD;
  const validServiceToken = process.env.STATS_GEN_SERVICE_TOKEN;

  if (validPassword && (password === validPassword || legacyToken === validPassword)) {
    return { ok: true, mode: 'user' };
  }
  if (validServiceToken && serviceToken === validServiceToken) {
    return { ok: true, mode: 'service' };
  }
  return { ok: false };
}

/**
 * Backward-compatible wrapper — writes 401 itself and returns boolean.
 * Existing handlers call this; new code should use requireStatsGenAuth().
 */
export function requireStatsGenToken(req, res) {
  const expected = process.env.STATS_GEN_PASSWORD;
  if (!expected && !process.env.STATS_GEN_SERVICE_TOKEN) {
    res.status(500).json({ error: 'STATS_GEN_PASSWORD not configured' });
    return false;
  }
  const auth = requireStatsGenAuth(req);
  if (!auth.ok) {
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
