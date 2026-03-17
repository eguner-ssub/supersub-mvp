// Backfill the matches table with full Sportmonks data for the current season.
// Fetches scores, state, participants, events, lineups AND statistics — everything
// needed for settlement and display. Idempotent (upsert on conflict: id).
//
// Usage: node scripts/backfill-matches-full.js
//
// Unlike backfill-sportmonks.js this script ONLY targets the matches table.
// It does not touch fixtures, standings, top_scorers, or teams.

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getLeagues, getFixturesByDateRangeFull } from '../lib/sportmonks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ── Config ──────────────────────────────────────────────────────────────────

const CHUNK_DAYS    = 30;
const RATE_LIMIT_MS = 1100; // just over 1 req/sec

// ── Supabase ─────────────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      `Missing env vars — SUPABASE_URL: ${url ? '✓' : '✗'}, SUPABASE_SERVICE_ROLE_KEY: ${key ? '✓' : '✗'}`
    );
  }
  return createClient(url, key);
}

// ── Rate limiter ─────────────────────────────────────────────────────────────

let lastRequestAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttle() {
  const now     = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < RATE_LIMIT_MS) await sleep(RATE_LIMIT_MS - elapsed);
  lastRequestAt = Date.now();
}

async function api(fn, ...args) {
  await throttle();
  return fn(...args);
}

// ── Date helpers ─────────────────────────────────────────────────────────────

function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

function chunkDateRange(startStr, endStr, days) {
  const chunks = [];
  let cursor   = new Date(startStr);
  const end    = new Date(endStr);

  while (cursor <= end) {
    const chunkEnd    = new Date(cursor);
    chunkEnd.setDate(chunkEnd.getDate() + days - 1);
    const clampedEnd  = chunkEnd > end ? end : chunkEnd;
    chunks.push({ from: toDateStr(cursor), to: toDateStr(clampedEnd) });
    cursor = new Date(clampedEnd);
    cursor.setDate(cursor.getDate() + 1);
  }

  return chunks;
}

// ── Sportmonks response helpers ──────────────────────────────────────────────

function extractParticipants(fixture) {
  let homeTeam = null;
  let awayTeam = null;
  for (const p of fixture.participants || []) {
    if (p.meta?.location === 'home') homeTeam = p;
    if (p.meta?.location === 'away') awayTeam = p;
  }
  return { homeTeam, awayTeam };
}

function extractCurrentScore(fixture) {
  let scoreHome = null;
  let scoreAway = null;
  for (const s of fixture.scores || []) {
    if (s.description === 'CURRENT') {
      if (s.score?.participant === 'home') scoreHome = s.score.goals;
      if (s.score?.participant === 'away') scoreAway = s.score.goals;
    }
  }
  return { scoreHome, scoreAway };
}

function extractStateName(fixture) {
  return fixture.state?.developer_name || null;
}

// ── custom_status derivation ─────────────────────────────────────────────────

const FINAL_STATUSES = [
  'FT', 'AET', 'FT_PEN', 'POSTPONED', 'CANCELLED',
  'ABANDONED', 'AWARDED', 'WO', 'DELETED', 'SUSPENDED',
];
const LIVE_STATUSES = [
  'INPLAY_1ST_HALF', 'HT', 'INPLAY_2ND_HALF', 'INPLAY_ET',
  'EXTRA_TIME_BREAK', 'INPLAY_ET_SECOND_HALF', 'INPLAY_PENALTIES', 'BREAK',
];

function deriveCustomStatus(status) {
  if (!status || status === 'NS') return 'UPCOMING';
  if (FINAL_STATUSES.includes(status)) return 'COMPLETED';
  if (LIVE_STATUSES.includes(status))  return 'LIVE';
  return 'UPCOMING';
}

// ── Main backfill ─────────────────────────────────────────────────────────────

async function backfillLeague(db, leagueName, smLeagueId, seasonStart, seasonEnd) {
  const chunks = chunkDateRange(seasonStart, seasonEnd, CHUNK_DAYS);
  let total    = 0;

  for (const chunk of chunks) {
    const res      = await api(getFixturesByDateRangeFull, chunk.from, chunk.to, smLeagueId);
    const fixtures = res.data || [];

    if (fixtures.length === 0) {
      console.log(`  ${leagueName}: ${chunk.from} → ${chunk.to} — 0 fixtures`);
      continue;
    }

    const now  = new Date().toISOString();
    const rows = [];

    for (const f of fixtures) {
      const { homeTeam, awayTeam }     = extractParticipants(f);
      const { scoreHome, scoreAway }   = extractCurrentScore(f);
      const status                     = extractStateName(f) || 'NS';

      if (!homeTeam || !awayTeam) continue;

      rows.push({
        id:             f.id,
        league_id:      f.league_id ?? null,
        date:           f.starting_at ? f.starting_at.split('T')[0] : null,
        kickoff_time:   f.starting_at ?? null,
        home_team:      homeTeam.name,
        away_team:      awayTeam.name,
        home_logo:      homeTeam.image_path ?? null,
        away_logo:      awayTeam.image_path ?? null,
        home_team_id:   homeTeam.id ?? null,
        away_team_id:   awayTeam.id ?? null,
        status,
        custom_status:  deriveCustomStatus(status),
        home_score:     scoreHome ?? 0,
        away_score:     scoreAway ?? 0,
        events:         f.events?.length     ? f.events     : null,
        lineups:        f.lineups?.length     ? f.lineups    : null,
        statistics:     f.statistics?.length  ? f.statistics : null,
        raw_data:       f,
        last_updated:   now,
        last_synced_at: now,
      });
    }

    if (rows.length > 0) {
      const { error } = await db
        .from('matches')
        .upsert(rows, { onConflict: 'id' });

      if (error) {
        console.error(`  ✗ ${leagueName} ${chunk.from}–${chunk.to}: ${error.message}`);
      } else {
        total += rows.length;
        console.log(`  ✓ ${leagueName}: ${chunk.from} → ${chunk.to} — ${rows.length} matches upserted`);
      }
    }
  }

  return total;
}

async function main() {
  const db = getSupabase();

  console.log('Fetching leagues from Sportmonks…');
  const leaguesRes = await api(getLeagues);
  const leagues    = leaguesRes.data || [];
  console.log(`Found ${leagues.length} leagues\n`);

  let grandTotal = 0;

  for (const league of leagues) {
    const currentSeason = league.currentseason || league.currentSeason;
    if (!currentSeason) {
      console.log(`[${league.name}] No current season — skipping`);
      continue;
    }

    const seasonStart = currentSeason.starting_at?.split(' ')[0];
    const seasonEnd   = currentSeason.ending_at?.split(' ')[0];

    if (!seasonStart || !seasonEnd) {
      console.log(`[${league.name}] No season dates — skipping`);
      continue;
    }

    console.log(`[${league.name}] Season: ${currentSeason.name} (${seasonStart} → ${seasonEnd})`);

    const count = await backfillLeague(db, league.name, league.id, seasonStart, seasonEnd);
    grandTotal += count;
    console.log(`  Total for ${league.name}: ${count} matches\n`);
  }

  console.log(`✓ Done. ${grandTotal} matches upserted across all leagues.`);
}

main().catch((err) => {
  console.error('✗ Fatal:', err.message);
  console.error(err.stack);
  process.exit(1);
});
