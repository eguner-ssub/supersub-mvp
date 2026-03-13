// Backfill Sportmonks data: leagues, seasons, teams, fixtures, standings, top scorers.
// Idempotent — safe to run multiple times. Rate-limited to ≤1 req/sec.
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  getLeagues,
  getFixturesByDateRange,
  getStandings,
  getTopScorers,
} from '../lib/sportmonks.js';

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

// ── Date helpers ────────────────────────────────────────────────────────────

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

// ── Sportmonks response helpers ─────────────────────────────────────────────

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

  // Sportmonks scores use s.score.participant as a string ('home' or 'away'),
  // not a participant_id. Filter by description === 'CURRENT' for the final score.
  for (const s of fixture.scores || []) {
    if (s.description === 'CURRENT') {
      if (s.score?.participant === 'home') {
        scoreHome = s.score.goals;
      }
      if (s.score?.participant === 'away') {
        scoreAway = s.score.goals;
      }
    }
  }

  return { scoreHome, scoreAway };
}

function extractStateName(fixture) {
  return fixture.state?.developer_name || null;
}

// ── DB upsert helpers ───────────────────────────────────────────────────────

async function upsertLeague(db, league) {
  const countryName = league.country?.name || null;

  const { data, error } = await db
    .from('leagues')
    .upsert(
      {
        sportmonks_id: league.id,
        name: league.name,
        country: countryName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'sportmonks_id' }
    )
    .select('id')
    .single();

  if (error) throw new Error(`League upsert failed (${league.name}): ${error.message}`);
  return data.id;
}

async function upsertSeason(db, season, leagueUuid) {
  const { data, error } = await db
    .from('seasons')
    .upsert(
      {
        sportmonks_id: season.id,
        league_id: leagueUuid,
        name: season.name,
        start_date: season.starting_at?.split(' ')[0] || null,
        end_date: season.ending_at?.split(' ')[0] || null,
        is_current: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'sportmonks_id' }
    )
    .select('id')
    .single();

  if (error) throw new Error(`Season upsert failed (${season.name}): ${error.message}`);
  return data.id;
}

async function linkCurrentSeason(db, leagueUuid, seasonUuid) {
  const { error } = await db
    .from('leagues')
    .update({ current_season_id: seasonUuid })
    .eq('id', leagueUuid);

  if (error) throw new Error(`Link current_season_id failed: ${error.message}`);
}

/** Upsert a team and return its internal UUID. Caches lookups in teamCache. */
async function ensureTeam(db, teamCache, participant) {
  if (!participant) return null;

  const smId = participant.id;
  if (teamCache.has(smId)) return teamCache.get(smId);

  const { data, error } = await db
    .from('teams')
    .upsert(
      {
        sportmonks_id: smId,
        name: participant.name,
        short_name: participant.short_code || null,
        logo_url: participant.image_path || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'sportmonks_id' }
    )
    .select('id')
    .single();

  if (error) throw new Error(`Team upsert failed (${participant.name}): ${error.message}`);

  teamCache.set(smId, data.id);
  return data.id;
}

// ── Core backfill steps ─────────────────────────────────────────────────────

async function backfillFixtures(db, leagueName, smLeagueId, seasonUuid, seasonStart, seasonEnd, teamCache) {
  const chunks = chunkDateRange(seasonStart, seasonEnd, CHUNK_DAYS);

  let totalFixtures = 0;

  for (const chunk of chunks) {
    const res = await api(getFixturesByDateRange, chunk.from, chunk.to, smLeagueId);
    const fixtures = res.data || [];

    if (fixtures.length === 0) continue;

    // Ensure all teams exist first
    for (const f of fixtures) {
      const { homeTeam, awayTeam } = extractParticipants(f);
      await ensureTeam(db, teamCache, homeTeam);
      await ensureTeam(db, teamCache, awayTeam);
    }

    // Build fixture rows
    const now = new Date().toISOString();
    const rows = [];

    for (const f of fixtures) {
      const { homeTeam, awayTeam } = extractParticipants(f);
      const { scoreHome, scoreAway } = extractCurrentScore(f);

      const homeUuid = homeTeam ? teamCache.get(homeTeam.id) : null;
      const awayUuid = awayTeam ? teamCache.get(awayTeam.id) : null;

      if (!homeUuid || !awayUuid) continue; // skip malformed fixtures

      rows.push({
        sportmonks_id: f.id,
        season_id: seasonUuid,
        home_team_id: homeUuid,
        away_team_id: awayUuid,
        scheduled_at: f.starting_at || null,
        status: extractStateName(f),
        score_home: scoreHome,
        score_away: scoreAway,
        round: f.round_id ? String(f.round_id) : null,
        venue_id: f.venue_id || null,
        raw_data: f,
        last_synced_at: now,
        updated_at: now,
      });
    }

    if (rows.length > 0) {
      const { error } = await db
        .from('fixtures')
        .upsert(rows, { onConflict: 'sportmonks_id' });

      if (error) throw new Error(`Fixtures upsert failed (${leagueName} ${chunk.from}–${chunk.to}): ${error.message}`);
    }

    // Pre-seed the matches table with Sportmonks fixture IDs (migration 021).
    // matches.id is now the Sportmonks fixture ID directly; sync-scores will
    // keep these rows up-to-date at runtime.
    const matchRows = [];
    for (const f of fixtures) {
      const { homeTeam, awayTeam } = extractParticipants(f);
      const { scoreHome, scoreAway } = extractCurrentScore(f);
      if (!homeTeam || !awayTeam) continue;
      matchRows.push({
        id:            f.id,
        league_id:     f.league_id ?? null,
        date:          f.starting_at ? f.starting_at.split('T')[0] : null,
        kickoff_time:  f.starting_at ?? null,
        home_team:     homeTeam.name,
        away_team:     awayTeam.name,
        home_logo:     homeTeam.image_path ?? null,
        away_logo:     awayTeam.image_path ?? null,
        status:        extractStateName(f) || 'NS',
        custom_status: 'UPCOMING',
        home_score:    scoreHome ?? 0,
        away_score:    scoreAway ?? 0,
        last_updated:  now,
        last_synced_at: now,
      });
    }

    if (matchRows.length > 0) {
      const { error: matchErr } = await db
        .from('matches')
        .upsert(matchRows, { onConflict: 'id' });
      if (matchErr) {
        console.warn(`  [matches] upsert warning for ${leagueName} ${chunk.from}–${chunk.to}: ${matchErr.message}`);
      }
    }

    totalFixtures += rows.length;
    console.log(`  ${leagueName}: ${chunk.from} → ${chunk.to} — ${rows.length} fixtures`);
  }

  return totalFixtures;
}

async function backfillStandings(db, leagueName, smSeasonId, seasonUuid, teamCache) {
  const res = await api(getStandings, smSeasonId);

  // Sportmonks standings response is a flat array — each item is a standing entry
  // with participant_id, position, points, and a details[] array of type_id stats.
  const entries = res.data || [];

  const rows = [];

  for (const entry of entries) {
    const teamSmId = entry.participant_id || entry.participant?.id;
    if (!teamSmId) continue;

    // Ensure team exists (may have been created during fixture backfill)
    let teamUuid = teamCache.get(teamSmId);
    if (!teamUuid && entry.participant) {
      teamUuid = await ensureTeam(db, teamCache, entry.participant);
    }
    if (!teamUuid) {
      // Try to look up from DB by sportmonks_id
      const { data } = await db
        .from('teams')
        .select('id')
        .eq('sportmonks_id', teamSmId)
        .single();
      if (data) {
        teamUuid = data.id;
        teamCache.set(teamSmId, teamUuid);
      } else {
        continue; // skip unknown team
      }
    }

    // Sportmonks standings detail type_id mapping (verified from /v3/core/types):
    //   129 = Overall Matches Played
    //   130 = Overall Won
    //   131 = Overall Draw
    //   132 = Overall Lost
    //   133 = Overall Goals Scored
    //   134 = Overall Goals Conceded
    //   187 = Overall Points
    const detail = entry.details || [];
    const detailMap = new Map(detail.map((d) => [d.type_id, d.value]));
    const stat = (typeId) => detailMap.get(typeId) ?? null;

    rows.push({
      season_id: seasonUuid,
      team_id: teamUuid,
      position: entry.position ?? null,
      played: stat(129),
      won: stat(130),
      drawn: stat(131),
      lost: stat(132),
      goals_for: stat(133),
      goals_against: stat(134),
      points: entry.points ?? stat(187),
      form: null,
      updated_at: new Date().toISOString(),
    });
  }

  if (rows.length > 0) {
    const { error } = await db
      .from('standings')
      .upsert(rows, { onConflict: 'season_id,team_id' });

    if (error) throw new Error(`Standings upsert failed (${leagueName}): ${error.message}`);
  }

  console.log(`  ${leagueName}: ${rows.length} standing rows`);
  return rows.length;
}

async function backfillTopScorers(db, leagueName, smSeasonId, seasonUuid, teamCache) {
  // Paginate through all top scorer pages until has_more is false
  const scorers = [];
  let page = 1;

  while (true) {
    const res = await api(getTopScorers, smSeasonId, page);
    const pageData = res.data || [];
    scorers.push(...pageData);

    const hasMore = res.pagination?.has_more ?? false;
    if (!hasMore || pageData.length === 0) break;
    page++;
  }

  console.log(`  ${leagueName}: fetched ${scorers.length} top scorers across ${page} page(s)`);

  const rows = [];

  for (const entry of scorers) {
    const player = entry.player || {};
    const participant = entry.participant || {};
    const playerSmId = entry.player_id || player.id;
    const teamSmId = entry.participant_id || participant.id;

    if (!playerSmId) continue;

    // Ensure team exists
    let teamUuid = teamSmId ? teamCache.get(teamSmId) : null;
    if (!teamUuid && teamSmId && participant.id) {
      teamUuid = await ensureTeam(db, teamCache, participant);
    }
    if (!teamUuid && teamSmId) {
      const { data } = await db
        .from('teams')
        .select('id')
        .eq('sportmonks_id', teamSmId)
        .single();
      if (data) {
        teamUuid = data.id;
        teamCache.set(teamSmId, teamUuid);
      }
    }
    if (!teamUuid) continue;

    const playerName =
      player.display_name || player.common_name || player.name || `Player ${playerSmId}`;

    rows.push({
      sportmonks_id: playerSmId,
      player_name: playerName,
      season_id: seasonUuid,
      team_id: teamUuid,
      goals: entry.total ?? 0,
      assists: entry.assists ?? 0,
      penalties: entry.penalties ?? 0,
      minutes_played: entry.minutes_played ?? 0,
      updated_at: new Date().toISOString(),
    });
  }

  if (rows.length > 0) {
    const { error } = await db
      .from('top_scorers')
      .upsert(rows, { onConflict: 'sportmonks_id,season_id' });

    if (error) throw new Error(`Top scorers upsert failed (${leagueName}): ${error.message}`);
  }

  console.log(`  ${leagueName}: ${rows.length} top scorers`);
  return rows.length;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function backfill({ supabase } = {}) {
  const db = supabase || getSupabase();

  console.log('Fetching leagues from Sportmonks...');
  const leaguesRes = await api(getLeagues);
  const leagues = leaguesRes.data || [];
  console.log(`Found ${leagues.length} leagues\n`);

  // Shared team cache: sportmonks_id → internal UUID
  const teamCache = new Map();

  for (const league of leagues) {
    const currentSeason = league.currentseason || league.currentSeason;
    if (!currentSeason) {
      console.log(`[${league.name}] No current season — skipping`);
      continue;
    }

    console.log(`[${league.name}]`);

    // 1. Upsert league
    const leagueUuid = await upsertLeague(db, league);

    // 2. Upsert season
    const seasonUuid = await upsertSeason(db, currentSeason, leagueUuid);
    await linkCurrentSeason(db, leagueUuid, seasonUuid);
    console.log(`  Season: ${currentSeason.name} (SM ID: ${currentSeason.id})`);

    // 3. Backfill fixtures in 30-day chunks
    const seasonStart = currentSeason.starting_at?.split(' ')[0];
    const seasonEnd = currentSeason.ending_at?.split(' ')[0];
    if (!seasonStart || !seasonEnd) {
      console.log(`  No season start/end date — skipping fixtures`);
      continue;
    }

    const fixtureCount = await backfillFixtures(
      db, league.name, league.id, seasonUuid, seasonStart, seasonEnd, teamCache
    );
    console.log(`  Total fixtures: ${fixtureCount}`);

    // 4. Standings
    await backfillStandings(db, league.name, currentSeason.id, seasonUuid, teamCache);

    // 5. Top scorers
    await backfillTopScorers(db, league.name, currentSeason.id, seasonUuid, teamCache);

    console.log(`  Done.\n`);
  }

  console.log(`✓ Backfill complete. ${teamCache.size} teams cached.`);
}

// ── CLI entry point ─────────────────────────────────────────────────────────

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  backfill().catch((err) => {
    console.error('✗ Backfill failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  });
}

export { backfill };
