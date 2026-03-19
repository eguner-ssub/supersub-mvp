/**
 * refresh-leaderboards.js
 *
 * CLI runner for leaderboard refresh. Computes ranks for all leaderboards
 * (global, country, league) across all time periods and writes them to
 * leaderboard_entries.
 *
 * Usage:
 *   node scripts/refresh-leaderboards.js
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { refreshLeaderboards } from '../lib/leaderboard/refresh.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      `Missing env vars – SUPABASE_URL: ${url ? '✓' : '✗'}, SUPABASE_SERVICE_ROLE_KEY: ${key ? '✓' : '✗'}`
    );
  }
  return createClient(url, key);
}

async function main() {
  const db = getSupabase();
  console.log('[refresh-leaderboards] Starting refresh …');
  const total = await refreshLeaderboards(db);
  console.log(`[refresh-leaderboards] ✓ Done. ${total} total entries written.`);
}

main().catch((err) => {
  console.error('[refresh-leaderboards] ✗ Fatal error:', err.message);
  process.exit(1);
});
