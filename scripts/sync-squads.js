/**
 * sync-squads.js
 *
 * Fetches player squad and per-player season stats from SportMonks and populates
 * two cache tables: player_squad_cache and player_stats_cache.
 *
 * Design: league-agnostic. To add a new league, uncomment its line in LEAGUES below.
 *
 * Usage:
 *   node scripts/sync-squads.js
 *
 * Requires .env at project root:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SPORTMONKS_API_TOKEN
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { request, getTeamsBySeason, getSquad } from '../lib/sportmonks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ── League config ─────────────────────────────────────────────────────────────
// Adding a league later = uncomment one line. No other code changes needed.
const LEAGUES = [
  { leagueId: 8, seasonId: 25583, name: 'Premier League' },
  { leagueId: 9, seasonId: 25648, name: 'Championship' },
  { leagueId: 82, seasonId: 25646, name: 'Bundesliga' },
  { leagueId: 564, seasonId: 25659, name: 'La Liga' },
  { leagueId: 384, seasonId: 25533, name: 'Serie A' },
];

// Base URL for /v3/my/* endpoints (different from the /v3/football/* base)
const MY_URL = 'https://api.sportmonks.com/v3';

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
  // SERVICE_ROLE_KEY bypasses RLS — required for server-side writes to cache tables
  return createClient(url, key);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const db = getSupabase();

  // ── Step 0: Discover available player stat type codes ──────────────────────
  // Call GET /v3/my/filters/entity to log every available player-statistic type ID
  // and its code string. Inspect this output to confirm that 'goals', 'assists',
  // 'minutes-played', and 'appearances' are the correct codes before trusting the
  // parsed stats below. Do not hardcode numeric type_id values — use type.code instead.
  console.log('[sync-squads] Fetching available player stat type filters …');
  try {
    const filtersRes = await request('/my/filters/entity', {}, MY_URL);
    console.log('[sync-squads] Available player stat type filters:');
    console.log(JSON.stringify(filtersRes.data ?? filtersRes, null, 2));
  } catch (err) {
    // Non-fatal — log and continue. Stat parsing still works via type.code from details.type.
    console.warn('[sync-squads] ⚠ Could not fetch /my/filters/entity:', err.message);
  }

  // ── Counters for end-of-run summary ───────────────────────────────────────
  let totalChecked = 0;
  let totalSkipped = 0;
  let totalSynced = 0;
  let totalPlayers = 0;

  // ── Step 1–8: Process each configured league ───────────────────────────────
  for (const league of LEAGUES) {
    console.log(`\n[sync-squads] ── ${league.name} (league ${league.leagueId}, season ${league.seasonId}) ──`);

    // Step 1: Fetch all teams registered for this season from SportMonks
    const teamsRes = await getTeamsBySeason(league.seasonId);
    const apiTeams = teamsRes.data || [];
    console.log(`[sync-squads]   ${apiTeams.length} teams found in season`);

    if (apiTeams.length === 0) continue;

    // Step 2: Load the stored last_played_at values from the teams table in one query
    const smIds = apiTeams.map((t) => t.id);
    const { data: dbTeams, error: dbErr } = await db
      .from('teams')
      .select('sportmonks_id, last_played_at')
      .in('sportmonks_id', smIds);

    if (dbErr) {
      console.error('[sync-squads]   ✗ Failed to read teams table:', dbErr.message);
      continue;
    }

    // Build a map: sportmonks_id → stored last_played_at (null if team not in DB yet)
    const dbMap = new Map((dbTeams || []).map((t) => [t.sportmonks_id, t.last_played_at]));

    // Step 3–8: Process each team
    for (const apiTeam of apiTeams) {
      totalChecked++;
      const teamSmId = apiTeam.id;
      const apiLastPlayed = apiTeam.last_played_at ?? null;
      const storedLastPlayed = dbMap.get(teamSmId) ?? null;

      // Step 3: Skip team if last_played_at is unchanged since the last sync
      if (storedLastPlayed && apiLastPlayed && storedLastPlayed === apiLastPlayed) {
        console.log(`[sync-squads]   ↩ Skipping ${apiTeam.name} (last_played_at unchanged: ${storedLastPlayed})`);
        totalSkipped++;
        continue;
      }

      console.log(`[sync-squads]   ↻ Syncing ${apiTeam.name} (id: ${teamSmId}) …`);

      // Step 4: Fetch the full squad for this team, including player profiles and stats
      let squadRes;
      try {
        squadRes = await getSquad(league.seasonId, teamSmId);
      } catch (err) {
        console.error(`[sync-squads]   ✗ Squad fetch failed for ${apiTeam.name}:`, err.message);
        // Still count as checked; skip to next team (do not update last_played_at)
        await sleep(500);
        continue;
      }

      const players = squadRes.data || [];

      const squadRows = [];
      const statsRows = [];

      for (const entry of players) {
        const player = entry.player || {};
        const playerId = entry.player_id ?? player.id;
        if (!playerId) continue;

        const playerName =
          player.display_name || player.common_name || player.name || `Player ${playerId}`;

        // ── Step 5: Build player_squad_cache row ───────────────────────────
        squadRows.push({
          player_id: playerId,
          player_name: playerName,
          team_id: teamSmId,
          team_name: apiTeam.name,
          league_id: league.leagueId,
          season_id: league.seasonId,
          position_id: entry.position_id ?? null,
          jersey_number: entry.jersey_number ?? null,
          image_path: player.image_path ?? null,
          last_updated: new Date().toISOString(),
        });

        // ── Step 6: Parse stats from details array ─────────────────────────
        // details.type is included in the request so each entry has a type.code string.
        // Match by type.code — never hardcode numeric type_id values.
        // Stat codes confirmed from the /v3/my/filters/entity log above.
        const statMap = {};
        for (const d of entry.details ?? []) {
          const code = d.type?.code;
          if (!code) continue;
          // Values may be a plain number or an object like { total: 12, ... }
          const val = typeof d.value === 'object' && d.value !== null
            ? (d.value.total ?? d.value.value ?? 0)
            : (d.value ?? 0);
          statMap[code] = val;
        }

        statsRows.push({
          player_id: playerId,
          season_id: league.seasonId,
          goals: statMap['goals'] ?? 0,
          assists: statMap['assists'] ?? 0,
          minutes_played: statMap['minutes-played'] ?? 0,
          appearances: statMap['appearances'] ?? 0,
          raw_stats: statMap,   // full code→value map persisted for future use
          last_updated: new Date().toISOString(),
        });
      }

      // Step 5 cont: Upsert squad cache rows
      if (squadRows.length > 0) {
        const { error } = await db
          .from('player_squad_cache')
          .upsert(squadRows, { onConflict: 'player_id' });
        if (error) {
          console.error(`[sync-squads]   ✗ Squad upsert failed (${apiTeam.name}):`, error.message);
          await sleep(500);
          continue;
        }
      }

      // Step 6 cont: Upsert stats cache rows
      if (statsRows.length > 0) {
        const { error } = await db
          .from('player_stats_cache')
          .upsert(statsRows, { onConflict: 'player_id' });
        if (error) {
          console.error(`[sync-squads]   ✗ Stats upsert failed (${apiTeam.name}):`, error.message);
          await sleep(500);
          continue;
        }
      }

      // Step 7: Update teams.last_played_at so future runs can skip this team
      if (apiLastPlayed) {
        const { error } = await db
          .from('teams')
          .update({ last_played_at: apiLastPlayed, updated_at: new Date().toISOString() })
          .eq('sportmonks_id', teamSmId);
        if (error) {
          console.warn(`[sync-squads]   ⚠ Could not update last_played_at for ${apiTeam.name}:`, error.message);
        }
      }

      console.log(`[sync-squads]   ✓ ${apiTeam.name}: ${squadRows.length} players upserted`);
      totalSynced++;
      totalPlayers += squadRows.length;

      // Step 8: 500ms sleep between team calls to be polite to the API
      await sleep(500);
    }
  }

  // ── End-of-run summary ─────────────────────────────────────────────────────
  console.log('\n[sync-squads] ─── Summary ─────────────────────────────────');
  console.log(`[sync-squads]   Teams checked   : ${totalChecked}`);
  console.log(`[sync-squads]   Teams skipped   : ${totalSkipped}`);
  console.log(`[sync-squads]   Teams synced    : ${totalSynced}`);
  console.log(`[sync-squads]   Players upserted: ${totalPlayers}`);
  console.log('[sync-squads] ────────────────────────────────────────────────');
}

main().catch((err) => {
  console.error('[sync-squads] ✗ Fatal error:', err.message);
  process.exit(1);
});
