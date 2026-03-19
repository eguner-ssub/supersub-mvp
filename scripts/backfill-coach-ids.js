/**
 * backfill-coach-ids.js
 *
 * Backfills home_coach_id and away_coach_id on historical match rows by fetching
 * lineups from Sportmonks for finished matches. Coach extraction was added to
 * sync-scores after the initial match backfill, so historical rows have NULL
 * coach IDs — this script fixes that so sync-supersub-stats.js can populate
 * coach_substitution_patterns.
 *
 * Usage:
 *   node scripts/backfill-coach-ids.js
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

// ── Config ──────────────────────────────────────────────────────────────────

const CHUNK_DAYS = 30;
const RATE_LIMIT_MS = 1100; // just over 1 req/sec

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Track last request time globally to enforce rate limit across all calls
let lastRequestAt = 0;

async function throttle() {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < RATE_LIMIT_MS) {
    await sleep(RATE_LIMIT_MS - elapsed);
  }
  lastRequestAt = Date.now();
}

/** Rate-limited wrapper around any Sportmonks API call. */
async function api(fn, ...args) {
  await throttle();
  return fn(...args);
}

// ── Date helpers ─────────────────────────────────────────────────────────────

function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

/** Split a date range into chunks of `days` length. Returns [{ from, to }]. */
function chunkDateRange(startStr, endStr, days) {
  const chunks = [];
  let cursor = new Date(startStr);
  const end = new Date(endStr);

  while (cursor <= end) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setDate(chunkEnd.getDate() + days - 1);
    const clampedEnd = chunkEnd > end ? end : chunkEnd;
    chunks.push({ from: toDateStr(cursor), to: toDateStr(clampedEnd) });
    cursor = new Date(clampedEnd);
    cursor.setDate(cursor.getDate() + 1);
  }

  return chunks;
}

// ── Coach helpers ─────────────────────────────────────────────────────────────

/**
 * Extract coaches from fixture.coaches[] (from include=coaches).
 * Each entry is a coach object with a pivot.team_id or direct team_id
 * that identifies which team they were coaching in this fixture.
 * Returns { homeCoachId, awayCoachId, coaches[] }.
 */
function extractCoachesFromFixture(fixtureCoaches, homeTeamId, awayTeamId) {
  let homeCoachId = null;
  let awayCoachId = null;
  const coaches = [];

  for (const coach of fixtureCoaches || []) {
    if (!coach.id) continue;

    // team_id is in coach.meta.participant_id for fixture-scoped coach includes
    const teamId = coach.meta?.participant_id ?? coach.pivot?.team_id ?? coach.team_id ?? null;

    const name =
      coach.display_name ||
      coach.common_name ||
      [coach.firstname, coach.lastname].filter(Boolean).join(' ') ||
      `Coach ${coach.id}`;

    coaches.push({
      id:             coach.id,
      name,
      common_name:    coach.common_name    ?? null,
      firstname:      coach.firstname      ?? null,
      lastname:       coach.lastname       ?? null,
      image_path:     coach.image_path     ?? null,
      nationality_id: coach.nationality_id ?? null,
      current_team_id: teamId,
      last_updated:   new Date().toISOString(),
    });

    if (teamId === homeTeamId) homeCoachId = coach.id;
    if (teamId === awayTeamId) awayCoachId = coach.id;
  }

  return { homeCoachId, awayCoachId, coaches };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const db = getSupabase();

  // Step 1: Query all finished matches that need coach IDs backfilled
  console.log('[backfill-coach-ids] Querying matches needing backfill …');
  const { data: matches, error: matchErr } = await db
    .from('matches')
    .select('id, league_id, home_team_id, away_team_id, kickoff_time')
    .is('home_coach_id', null)
    .in('status', ['FT', 'AET', 'FT_PEN'])
    .order('kickoff_time');

  if (matchErr) throw new Error(`Failed to query matches: ${matchErr.message}`);
  if (!matches || matches.length === 0) {
    console.log('[backfill-coach-ids] No matches need backfilling. Done.');
    return;
  }

  console.log(`[backfill-coach-ids] ${matches.length} matches need coach IDs`);

  // Step 2: Group by league_id
  const byLeague = new Map();
  for (const m of matches) {
    const lid = m.league_id;
    if (!lid) continue;
    if (!byLeague.has(lid)) byLeague.set(lid, []);
    byLeague.get(lid).push(m);
  }

  console.log(`[backfill-coach-ids] ${byLeague.size} leagues to process`);

  // Counters
  let totalFetched = 0;
  let totalUpdated = 0;
  const updateQueue = []; // { id, homeCoachId, awayCoachId }
  const coachUpsertQueue = new Map(); // coachId → coach row (deduplicated)

  // Step 3: Process each league in date-range chunks
  for (const [leagueId, leagueMatches] of byLeague) {
    const matchSet = new Map(leagueMatches.map((m) => [m.id, m]));

    const times = leagueMatches
      .map((m) => m.kickoff_time)
      .filter(Boolean)
      .sort();

    if (times.length === 0) {
      console.log(`[backfill-coach-ids] League ${leagueId}: no kickoff times — skipping`);
      continue;
    }

    const fromDate = toDateStr(new Date(times[0]));
    const toDate   = toDateStr(new Date(times[times.length - 1]));
    const chunks   = chunkDateRange(fromDate, toDate, CHUNK_DAYS);

    console.log(`\n[backfill-coach-ids] ── League ${leagueId} (${leagueMatches.length} matches, ${chunks.length} chunks) ──`);

    for (const chunk of chunks) {
      let page = 1;

      while (true) {
        let res;
        try {
          res = await api(request, `/fixtures/between/${chunk.from}/${chunk.to}`, {
            include:  'coaches',
            filters:  `fixtureLeagues:${leagueId}`,
            per_page: 100,
            page,
          });
        } catch (err) {
          console.error(`[backfill-coach-ids]   ✗ API error (league ${leagueId} ${chunk.from}→${chunk.to} page ${page}):`, err.message);
          break;
        }

        const fixtures = res.data || [];
        totalFetched += fixtures.length;

        for (const fixture of fixtures) {
          const match = matchSet.get(fixture.id);
          if (!match) continue; // fixture not in our needs-update set

          const { homeCoachId, awayCoachId, coaches } = extractCoachesFromFixture(
            fixture.coaches || [],
            match.home_team_id,
            match.away_team_id
          );

          // Collect coaches for upsert (deduped by id)
          for (const c of coaches) {
            coachUpsertQueue.set(c.id, c);
          }

          if (homeCoachId != null || awayCoachId != null) {
            updateQueue.push({ id: fixture.id, homeCoachId, awayCoachId });
          }
        }

        if (!res.pagination?.has_more) break;
        page++;
      }

      console.log(`[backfill-coach-ids]   chunk ${chunk.from} → ${chunk.to} done`);
    }
  }

  console.log(`\n[backfill-coach-ids] Fetched ${totalFetched} fixture records from API`);
  console.log(`[backfill-coach-ids] ${updateQueue.length} matches have coach data to write`);

  // Step 4: Upsert coaches to satisfy FK constraints
  const coachRows = Array.from(coachUpsertQueue.values());
  if (coachRows.length > 0) {
    console.log(`[backfill-coach-ids] Upserting ${coachRows.length} coaches …`);
    const { error: coachErr } = await db
      .from('coaches')
      .upsert(coachRows, { onConflict: 'id' });
    if (coachErr) {
      throw new Error(`Coach upsert failed: ${coachErr.message}`);
    }
    console.log(`[backfill-coach-ids] ✓ ${coachRows.length} coaches upserted`);
  }

  // Step 5: Batch update matches
  // Supabase doesn't support bulk updates with different values per row,
  // so we update in individual calls (but group them without extra sleeps).
  for (const update of updateQueue) {
    const payload = {};
    if (update.homeCoachId != null) payload.home_coach_id = update.homeCoachId;
    if (update.awayCoachId != null) payload.away_coach_id = update.awayCoachId;

    const { error } = await db
      .from('matches')
      .update(payload)
      .eq('id', update.id);

    if (error) {
      console.error(`[backfill-coach-ids]   ✗ Update failed for match ${update.id}:`, error.message);
    } else {
      totalUpdated++;
    }
  }

  const stillMissing = matches.length - totalUpdated;

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n[backfill-coach-ids] ─── Summary ───────────────────────────────');
  console.log(`[backfill-coach-ids]   Matches needing update : ${matches.length}`);
  console.log(`[backfill-coach-ids]   Fixtures fetched       : ${totalFetched}`);
  console.log(`[backfill-coach-ids]   Matches updated        : ${totalUpdated}`);
  console.log(`[backfill-coach-ids]   Still missing          : ${stillMissing}`);
  console.log('[backfill-coach-ids] ────────────────────────────────────────────');

  if (stillMissing > 0) {
    console.log('[backfill-coach-ids] ⚠ Some matches have no lineup data in Sportmonks (older fixtures).');
    console.log('[backfill-coach-ids]   This is expected for matches from before lineup data was available.');
  }
}

main().catch((err) => {
  console.error('[backfill-coach-ids] ✗ Fatal error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
