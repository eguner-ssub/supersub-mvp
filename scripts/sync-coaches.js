/**
 * sync-coaches.js
 *
 * Fetches recently updated coaches from SportMonks /coaches/latest endpoint and
 * upserts them to the coaches table. Detects manager changes by comparing
 * current_team_id with the stored value.
 *
 * Usage:
 *   node scripts/sync-coaches.js
 *
 * Requires .env at project root:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SPORTMONKS_API_TOKEN
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { request } from '../lib/sportmonks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      `Missing env vars — SUPABASE_URL: ${url ? '✓' : '✗'}, SUPABASE_SERVICE_ROLE_KEY: ${key ? '✓' : '✗'}`
    );
  }
  // SERVICE_ROLE_KEY bypasses RLS — required for server-side writes to coaches table
  return createClient(url, key);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const db = getSupabase();

  let totalCoachesUpdated = 0;
  let totalManagerChanges = 0;
  let page = 1;
  let hasMore = true;

  // Load existing coaches from DB for change detection
  const { data: existingCoaches, error: fetchErr } = await db
    .from('coaches')
    .select('id, current_team_id');

  if (fetchErr) {
    throw new Error(`Failed to load existing coaches: ${fetchErr.message}`);
  }

  const existingMap = new Map(
    (existingCoaches || []).map((c) => [c.id, c.current_team_id])
  );

  console.log(`[sync-coaches] Loaded ${existingMap.size} existing coaches from DB`);

  // ── Paginate through /coaches/latest ──────────────────────────────────────
  while (hasMore) {
    console.log(`[sync-coaches] Fetching /coaches/latest page ${page} …`);

    let res;
    try {
      res = await request('/coaches/latest', {
        include: 'teams',
        page,
      });
    } catch (err) {
      console.error(`[sync-coaches]   ✗ Fetch error on page ${page}:`, err.message);
      break;
    }

    const coaches = res.data || [];
    console.log(`[sync-coaches]   ${coaches.length} coaches on page ${page}`);

    if (coaches.length === 0) break;

    const now = new Date().toISOString();
    const coachRows = [];

    for (const coach of coaches) {
      const teams = coach.teams || [];

      // Find active team: prefer pivot.active === true, fall back to last entry in array
      let activeTeam = teams.find((t) => t.pivot?.active === true);
      if (!activeTeam && teams.length > 0) {
        activeTeam = teams[teams.length - 1];
      }

      const currentTeamId = activeTeam?.id ?? null;

      // Detect manager change
      if (existingMap.has(coach.id)) {
        const storedTeamId = existingMap.get(coach.id);
        if (storedTeamId !== currentTeamId) {
          console.log(
            `[sync-coaches] Manager change: ${coach.name} → team ${currentTeamId} (was ${storedTeamId})`
          );
          totalManagerChanges++;
        }
      }

      coachRows.push({
        id:              coach.id,
        name:            coach.name,
        common_name:     coach.common_name ?? null,
        firstname:       coach.firstname ?? null,
        lastname:        coach.lastname ?? null,
        image_path:      coach.image_path ?? null,
        nationality_id:  coach.nationality_id ?? null,
        current_team_id: currentTeamId,
        last_updated:    now,
      });
    }

    if (coachRows.length > 0) {
      const { error } = await db
        .from('coaches')
        .upsert(coachRows, { onConflict: 'id' });

      if (error) {
        console.error(`[sync-coaches]   ✗ Upsert failed on page ${page}:`, error.message);
      } else {
        totalCoachesUpdated += coachRows.length;
        console.log(`[sync-coaches]   ✓ ${coachRows.length} coaches upserted from page ${page}`);
      }
    }

    // Pagination — same has_more pattern as other scripts
    hasMore = res.pagination?.has_more ?? false;
    page++;

    if (hasMore) await sleep(500);
  }

  // ── End-of-run summary ─────────────────────────────────────────────────────
  console.log('\n[sync-coaches] ─── Summary ─────────────────────────────────');
  console.log(`[sync-coaches]   Pages fetched     : ${page - 1}`);
  console.log(`[sync-coaches]   Coaches updated   : ${totalCoachesUpdated}`);
  console.log(`[sync-coaches]   Manager changes   : ${totalManagerChanges}`);
  console.log('[sync-coaches] ────────────────────────────────────────────────');
}

main().catch((err) => {
  console.error('[sync-coaches] ✗ Fatal error:', err.message);
  process.exit(1);
});
