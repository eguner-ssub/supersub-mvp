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

/**
 * Coerce a Sportmonks starting_at string to a valid UTC ISO-8601 string.
 * Sportmonks returns bare "YYYY-MM-DD HH:mm:ss" strings when timezone=UTC is
 * requested. Without an explicit 'Z' marker, Postgres and Node.js may
 * interpret them using the server's local timezone offset.
 */
function toUtcIso(str) {
  if (!str) return null;
  if (/[Zz]$/.test(str) || /[+-]\d{2}:\d{2}$/.test(str)) return str;
  return str.replace(' ', 'T') + 'Z';
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

// ── Row building ─────────────────────────────────────────────────────────────

function buildRowFromFixture(f, now) {
  const { homeTeam, awayTeam }   = extractParticipants(f);
  const { scoreHome, scoreAway } = extractCurrentScore(f);
  const status                   = extractStateName(f) || 'NS';

  if (!homeTeam || !awayTeam) return null;

  // Sportmonks LINEUP_CONFIRMED metadata flips ~1h pre-kickoff once team
  // sheets are released. When the entry is missing entirely (older fixtures
  // pulled before metadata was included, or matches still in the
  // far-future window) we OMIT the column from the upsert payload so
  // Supabase preserves whatever is already stored — avoids clobbering a
  // previously-confirmed value back to false on a re-sync that drops
  // metadata for any reason.
  // Sportmonks returns LINEUP_CONFIRMED metadata as either a flat
  // `developer_name` (default `include=metadata`) or a nested
  // `type.developer_name` (when `include=metadata.type`). Tolerate both so
  // this stays in lockstep with supabase/functions/sync-scores/index.ts —
  // both parsers MUST accept both shapes or they drift back into a state
  // where one pipeline silently no-ops.
  const lineupMeta = (f.metadata || []).find(
    (m) => (m?.type?.developer_name ?? m?.developer_name) === 'LINEUP_CONFIRMED'
  );

  const row = {
    id:             f.id,
    league_id:      f.league_id ?? null,
    date:           toUtcIso(f.starting_at)?.split('T')[0] ?? null,
    kickoff_time:   toUtcIso(f.starting_at),
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
  };

  if (lineupMeta) {
    row.lineup_confirmed = !!lineupMeta.values?.confirmed;
  }

  return row;
}

async function fetchAndUpsertWindow(db, leagueName, smLeagueId, from, to) {
  const res      = await api(getFixturesByDateRangeFull, from, to, smLeagueId);
  const fixtures = res.data || [];

  if (fixtures.length === 0) {
    console.log(`  ${leagueName}: ${from} → ${to} — 0 fixtures`);
    return 0;
  }

  const now  = new Date().toISOString();
  const rows = fixtures
    .map((f) => buildRowFromFixture(f, now))
    .filter(Boolean);

  if (rows.length === 0) return 0;

  const { error } = await db
    .from('matches')
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    console.error(`  ✗ ${leagueName} ${from}–${to}: ${error.message}`);
    return 0;
  }

  console.log(`  ✓ ${leagueName}: ${from} → ${to} — ${rows.length} matches upserted`);
  return rows.length;
}

// ── Main backfill ─────────────────────────────────────────────────────────────

async function backfillLeague(db, leagueName, smLeagueId, seasonStart, seasonEnd) {
  const chunks = chunkDateRange(seasonStart, seasonEnd, CHUNK_DAYS);
  let total    = 0;

  for (const chunk of chunks) {
    total += await fetchAndUpsertWindow(db, leagueName, smLeagueId, chunk.from, chunk.to);
  }

  return total;
}

/**
 * Backfill ONLY upcoming matches in a short window (default: next 3 days).
 *
 * Intended for the hourly Vercel cron handler: keeps `matches.lineup_confirmed`,
 * `lineups`, `events`, and `statistics` fresh for imminent fixtures without
 * re-processing a full season on every run. Skips past matches entirely since
 * the LINEUP_CONFIRMED flag is only meaningful pre-kickoff.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {{ daysAhead?: number }} [opts]
 * @returns {Promise<{ daysAhead: number, from: string, to: string, leagues: number, matches: number }>}
 */
export async function backfillUpcomingMatches(db, { daysAhead = 3 } = {}) {
  const today = new Date();
  const end   = new Date(today);
  end.setDate(end.getDate() + daysAhead);

  const from = toDateStr(today);
  const to   = toDateStr(end);

  const leaguesRes = await api(getLeagues);
  const leagues    = leaguesRes.data || [];

  let matches = 0;
  for (const league of leagues) {
    matches += await fetchAndUpsertWindow(db, league.name, league.id, from, to);
  }

  return { daysAhead, from, to, leagues: leagues.length, matches };
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

// Only run main() when invoked directly via CLI, not when imported by the
// Vercel cron handler (api/cron/index.js pulls in `backfillUpcomingMatches`).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error('✗ Fatal:', err.message);
    console.error(err.stack);
    process.exit(1);
  });
}
