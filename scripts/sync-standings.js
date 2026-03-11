// Sync standings and top scorers for a single league after FT settlement.
// Called by settle.js with an existing Supabase client, or run standalone via CLI.
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getStandings, getTopScorers } from '../lib/sportmonks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ── Supabase (only used for CLI mode) ───────────────────────────────────────

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

// ── Team UUID resolver ──────────────────────────────────────────────────────

async function resolveTeamUuid(db, teamCache, sportmonksId, participant) {
  if (teamCache.has(sportmonksId)) return teamCache.get(sportmonksId);

  // Try DB lookup first (teams should already exist from backfill)
  const { data } = await db
    .from('teams')
    .select('id')
    .eq('sportmonks_id', sportmonksId)
    .single();

  if (data) {
    teamCache.set(sportmonksId, data.id);
    return data.id;
  }

  // Create if participant data is available (shouldn't normally happen post-backfill)
  if (participant) {
    const { data: created, error } = await db
      .from('teams')
      .upsert(
        {
          sportmonks_id: sportmonksId,
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
    teamCache.set(sportmonksId, created.id);
    return created.id;
  }

  return null;
}

// ── Standings sync ──────────────────────────────────────────────────────────

async function syncStandings(db, smSeasonId, seasonUuid, teamCache) {
  const res = await getStandings(smSeasonId);

  // Sportmonks standings response is a flat array — each item is a standing entry
  // with participant_id, position, points, and a details[] array of type_id stats.
  const entries = res.data || [];

  const rows = [];

  for (const entry of entries) {
    const teamSmId = entry.participant_id || entry.participant?.id;
    if (!teamSmId) continue;

    const teamUuid = await resolveTeamUuid(db, teamCache, teamSmId, entry.participant);
    if (!teamUuid) continue;

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

    if (error) throw new Error(`Standings upsert failed: ${error.message}`);
  }

  return rows.length;
}

// ── Top scorers sync ────────────────────────────────────────────────────────

async function syncTopScorers(db, smSeasonId, seasonUuid, teamCache) {
  const res = await getTopScorers(smSeasonId);
  const scorers = res.data || [];

  const rows = [];

  for (const entry of scorers) {
    const player = entry.player || {};
    const participant = entry.participant || {};
    const playerSmId = entry.player_id || player.id;
    const teamSmId = entry.participant_id || participant.id;

    if (!playerSmId) continue;

    const teamUuid = teamSmId
      ? await resolveTeamUuid(db, teamCache, teamSmId, participant)
      : null;
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

    if (error) throw new Error(`Top scorers upsert failed: ${error.message}`);
  }

  return rows.length;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Sync standings and top scorers for a league's current season.
 *
 * @param {object} options
 * @param {number} options.leagueId - Sportmonks league ID (e.g. 8 for EPL)
 * @param {import('@supabase/supabase-js').SupabaseClient} [options.supabase] - Existing client (pass from settle.js)
 * @returns {Promise<{ standings: number, topScorers: number }>}
 */
export async function syncStandingsForLeague({ leagueId, supabase }) {
  const db = supabase || getSupabase();

  // Look up league + current season from DB
  const { data: league, error: leagueErr } = await db
    .from('leagues')
    .select('id, name, current_season_id')
    .eq('sportmonks_id', leagueId)
    .single();

  if (leagueErr || !league) {
    throw new Error(`League not found for sportmonks_id=${leagueId}: ${leagueErr?.message || 'no rows'}`);
  }

  if (!league.current_season_id) {
    throw new Error(`No current season set for league ${league.name} (sportmonks_id=${leagueId})`);
  }

  const { data: season, error: seasonErr } = await db
    .from('seasons')
    .select('id, sportmonks_id, name')
    .eq('id', league.current_season_id)
    .single();

  if (seasonErr || !season) {
    throw new Error(`Season not found (id=${league.current_season_id}): ${seasonErr?.message || 'no rows'}`);
  }

  console.log(`[sync-standings] ${league.name} — season ${season.name} (SM ID: ${season.sportmonks_id})`);

  const teamCache = new Map();

  // Standings
  const standingsCount = await syncStandings(db, season.sportmonks_id, season.id, teamCache);
  console.log(`[sync-standings]   Standings: ${standingsCount} rows upserted`);

  // Top scorers
  const scorersCount = await syncTopScorers(db, season.sportmonks_id, season.id, teamCache);
  console.log(`[sync-standings]   Top scorers: ${scorersCount} rows upserted`);

  console.log(`[sync-standings]   Done.`);

  return { standings: standingsCount, topScorers: scorersCount };
}

// ── CLI entry point ─────────────────────────────────────────────────────────

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const leagueId = parseInt(process.argv[2], 10);

  if (!leagueId) {
    console.error('Usage: node scripts/sync-standings.js <sportmonks_league_id>');
    console.error('  League IDs: 8 (EPL), 9 (Championship), 82 (Bundesliga), 564 (La Liga), 384 (Serie A)');
    process.exit(1);
  }

  syncStandingsForLeague({ leagueId })
    .then(({ standings, topScorers }) => {
      console.log(`✓ Sync complete — ${standings} standings, ${topScorers} top scorers`);
    })
    .catch((err) => {
      console.error('✗ Sync failed:', err.message);
      process.exit(1);
    });
}
