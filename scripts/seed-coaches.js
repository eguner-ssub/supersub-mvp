/**
 * seed-coaches.js
 *
 * Fetches active coaches for each configured league season from SportMonks and
 * populates the coaches table. Uses the teams/seasons endpoint with coaches included.
 *
 * Usage:
 *   node scripts/seed-coaches.js
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

// ── League config ─────────────────────────────────────────────────────────────
const LEAGUES = [
  { id: 8,   season: 25583, name: 'Premier League' },
  { id: 9,   season: 25603, name: 'Championship' },
  { id: 82,  season: 25565, name: 'Bundesliga' },
  { id: 564, season: 25648, name: 'La Liga' },
  { id: 384, season: 25533, name: 'Serie A' },
];

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

  let leaguesProcessed = 0;
  let totalCoachesUpserted = 0;

  for (const league of LEAGUES) {
    console.log(`\n[seed-coaches] ── ${league.name} (league ${league.id}, season ${league.season}) ──`);

    let teamsRes;
    try {
      teamsRes = await request(`/teams/seasons/${league.season}`, {
        include: 'coaches',
      });
    } catch (err) {
      console.error(`[seed-coaches]   ✗ Failed to fetch teams for season ${league.season}:`, err.message);
      await sleep(500);
      continue;
    }

    const teams = teamsRes.data || [];
    console.log(`[seed-coaches]   ${teams.length} teams found in season`);

    const coachRows = [];
    const now = new Date().toISOString();

    for (const team of teams) {
      const coaches = team.coaches || [];

      // Find the active coach — check both pivot.active and direct active field
      const activeCoach = coaches.find(
        (c) => c.pivot?.active === true || c.active === true
      );

      if (!activeCoach) continue;

      coachRows.push({
        id:             activeCoach.id,
        name:           activeCoach.name,
        common_name:    activeCoach.common_name ?? null,
        firstname:      activeCoach.firstname ?? null,
        lastname:       activeCoach.lastname ?? null,
        image_path:     activeCoach.image_path ?? null,
        nationality_id: activeCoach.nationality_id ?? null,
        current_team_id: team.id,
        last_updated:   now,
      });
    }

    if (coachRows.length > 0) {
      const { error } = await db
        .from('coaches')
        .upsert(coachRows, { onConflict: 'id' });

      if (error) {
        console.error(`[seed-coaches]   ✗ Upsert failed for ${league.name}:`, error.message);
        await sleep(500);
        continue;
      }

      console.log(`[seed-coaches]   ✓ ${coachRows.length} coaches upserted for ${league.name}`);
      totalCoachesUpserted += coachRows.length;
    } else {
      console.log(`[seed-coaches]   ⚠ No active coaches found for ${league.name}`);
    }

    leaguesProcessed++;

    // 500ms sleep between league fetches to be polite to the API
    await sleep(500);
  }

  // ── End-of-run summary ─────────────────────────────────────────────────────
  console.log('\n[seed-coaches] ─── Summary ─────────────────────────────────');
  console.log(`[seed-coaches]   Leagues processed : ${leaguesProcessed}`);
  console.log(`[seed-coaches]   Coaches upserted  : ${totalCoachesUpserted}`);
  console.log('[seed-coaches] ────────────────────────────────────────────────');
}

main().catch((err) => {
  console.error('[seed-coaches] ✗ Fatal error:', err.message);
  process.exit(1);
});
