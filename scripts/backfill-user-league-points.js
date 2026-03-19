/**
 * backfill-user-league-points.js
 *
 * One-time script to populate user_league_points from historical settled
 * predictions. Run after applying migration 029_add_leaderboards.sql.
 *
 * Usage:
 *   node scripts/backfill-user-league-points.js
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { LEADERBOARD_CONFIG } from '../config/leaderboard.js';

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

  console.log('[backfill-ulp] Querying settled predictions …');

  // Fetch all settled predictions with league_id and match season
  const { data: preds, error } = await db
    .from('predictions')
    .select('user_id, league_id, points_awarded, settled_status, match_id')
    .eq('status', 'SETTLED')
    .not('league_id', 'is', null);

  if (error) throw new Error(`Failed to query predictions: ${error.message}`);
  if (!preds || preds.length === 0) {
    console.log('[backfill-ulp] No settled predictions found. Done.');
    return;
  }

  console.log(`[backfill-ulp] ${preds.length} settled predictions found`);

  // Get season_id for each match
  const matchIds = [...new Set(preds.map((p) => p.match_id))];
  const { data: matches, error: matchErr } = await db
    .from('matches')
    .select('id, season, league_id')
    .in('id', matchIds);

  if (matchErr) throw new Error(`Failed to query matches: ${matchErr.message}`);

  const seasonMap = new Map((matches || []).map((m) => [m.id, m.season]));

  // Also build league_id map from matches for fallback season lookup
  const matchLeagueMap = new Map((matches || []).map((m) => [m.id, m.league_id]));

  // Aggregate by (user_id, league_id, season_id)
  const agg = new Map();
  for (const p of preds) {
    // Use matches.season if available, otherwise fall back to config mapping
    let seasonId = seasonMap.get(p.match_id);
    if (!seasonId) {
      const leagueId = p.league_id;
      seasonId = leagueId ? LEADERBOARD_CONFIG.CURRENT_SEASONS[leagueId] : null;
    }
    if (!seasonId) continue;

    const key = `${p.user_id}:${p.league_id}:${seasonId}`;
    if (!agg.has(key)) {
      agg.set(key, {
        user_id:   p.user_id,
        league_id: p.league_id,
        season_id: seasonId,
        points:    0,
        bet_count: 0,
        win_count: 0,
      });
    }
    const a = agg.get(key);
    a.bet_count++;
    if (p.settled_status === 'WON') {
      a.points += p.points_awarded || 0;
      a.win_count++;
    }
  }

  const rows = [...agg.values()].map((a) => ({
    ...a,
    updated_at: new Date().toISOString(),
  }));

  console.log(`[backfill-ulp] ${rows.length} user-league-season combinations to upsert`);

  // Upsert in batches
  const BATCH = 500;
  let upserted = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error: upErr } = await db
      .from('user_league_points')
      .upsert(chunk, { onConflict: 'user_id,league_id,season_id' });

    if (upErr) {
      console.error(`[backfill-ulp] Upsert failed (batch ${i}):`, upErr.message);
    } else {
      upserted += chunk.length;
    }
  }

  console.log(`[backfill-ulp] ✓ ${upserted} rows upserted`);
}

main().catch((err) => {
  console.error('[backfill-ulp] ✗ Fatal error:', err.message);
  process.exit(1);
});
