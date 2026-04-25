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
    //   Overall:  129=MP  130=W  131=D  132=L  133=GF  134=GA  187=Pts
    //   Home:     135=MP  136=W  137=D  138=L  139=GF  140=GA  185=Pts
    //   Away:     141=MP  142=W  143=D  144=L  145=GF  146=GA  186=Pts
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
      // Home split — powers the /stats-gen/fortress endpoint and any future
      // home/away-aware feature without a second pass through Sportmonks.
      home_matches_played: stat(135),
      home_won:            stat(136),
      home_drawn:          stat(137),
      home_lost:           stat(138),
      home_goals_for:      stat(139),
      home_goals_against:  stat(140),
      home_points:         stat(185),
      // Away split — stored for symmetry and future endpoints.
      away_matches_played: stat(141),
      away_won:            stat(142),
      away_drawn:          stat(143),
      away_lost:           stat(144),
      away_goals_for:      stat(145),
      away_goals_against:  stat(146),
      away_points:         stat(186),
      // Sportmonks v3 form shape: [{ fixture_id, form: 'W'|'D'|'L', sort_order, ... }].
      // Items arrive unordered; sort by sort_order ascending so chronological order
      // is preserved and the consumer's .slice(-5) picks up the most recent five.
      form: Array.isArray(entry.form)
        ? [...entry.form]
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map(f => (f.form || '').toUpperCase()[0])
            .filter(Boolean)
            .join('')
        : null,
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

// ── Pagination helper ────────────────────────────────────────────────────────

/**
 * Fetch every page of top scorers for a given stat type and return the merged
 * entry array.  Sportmonks paginates at 25 rows per page; without this loop
 * only the first 25 players are ever written to the DB.
 */
async function fetchAllTopScorers(smSeasonId, typeId) {
  const all = [];
  let page = 1;

  while (true) {
    const res = await getTopScorers(smSeasonId, page, typeId);
    const entries = res.data || [];
    all.push(...entries);

    if (!res.pagination?.has_more) break;
    page++;
    // 500 ms between pages to stay well under Sportmonks rate limits
    await new Promise((r) => setTimeout(r, 500));
  }

  return all;
}

// ── Top scorers sync ────────────────────────────────────────────────────────

async function syncTopScorers(db, smSeasonId, seasonUuid, teamCache) {
  // The /topscorers endpoint returns ALL stat types mixed together (goals, assists,
  // red cards, yellow cards, etc.). Fetch each type separately via seasontopscorerTypes filter:
  //   type_id 208 = Goals  (code: goal-topscorer)
  //   type_id 209 = Assists (code: assist-topscorer)
  // entry.total is the count for the requested type.
  // Fetch goals first, then assists sequentially to avoid concurrent pagination
  // hammering the rate limit.
  const goalEntries   = await fetchAllTopScorers(smSeasonId, 208);
  const assistEntries = await fetchAllTopScorers(smSeasonId, 209);

  // Build assist lookup: playerSmId → assist total
  const assistMap = new Map(
    assistEntries
      .map((e) => [e.player_id || e.player?.id, e.total ?? 0])
      .filter(([id]) => id != null)
  );

  const rows = [];

  for (const entry of goalEntries) {
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
      sportmonks_id:  playerSmId,
      player_name:    playerName,
      season_id:      seasonUuid,
      team_id:        teamUuid,
      goals:          entry.total ?? 0,              // entry.total is goals (type 52 filtered)
      assists:        assistMap.get(playerSmId) ?? 0, // from dedicated type 79 pass
      penalties:      0,                             // not available from this endpoint
      minutes_played: 0,                             // not available from this endpoint
      updated_at:     new Date().toISOString(),
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
 * Positional signature so callers from hot paths (api/league.js lazy refresh,
 * run-season-simulations.js per-league preflight) can pass their own Supabase
 * client without spreading an options object.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient - Required.
 * @param {number} leagueId - Sportmonks league ID (e.g. 8 for EPL)
 * @returns {Promise<{ standings: number, topScorers: number }>}
 * @throws on Sportmonks fetch / DB upsert failures — callers decide whether to
 *         abort, fall through to stale data, or log-and-continue.
 */
export async function syncStandingsForLeague(supabaseClient, leagueId) {
  const db = supabaseClient;
  if (!db) throw new Error('syncStandingsForLeague: supabaseClient is required');
  if (!leagueId) throw new Error('syncStandingsForLeague: leagueId is required');

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
    console.error('  Sportmonks league IDs: 8 (EPL), 301 (Ligue 1), 82 (Bundesliga), 564 (La Liga), 384 (Serie A)');
    process.exit(1);
  }

  syncStandingsForLeague(getSupabase(), leagueId)
    .then(({ standings, topScorers }) => {
      console.log(`✓ Sync complete — ${standings} standings, ${topScorers} top scorers`);
    })
    .catch((err) => {
      console.error('✗ Sync failed:', err.message);
      process.exit(1);
    });
}
