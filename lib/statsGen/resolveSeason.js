// Resolvers for turning a Sportmonks INTEGER league ID (as stored on
// matches.league_id) into the season identifiers used by other tables.
//
//   matches.league_id (INT, e.g. 8)
//     → leagues.sportmonks_id = 8
//     → leagues.current_season_id (UUID FK)
//     → seasons.id (UUID)              ← used by standings (UUID-keyed)
//     → seasons.sportmonks_id (INT)    ← used by team_bench_stats,
//                                        coach_substitution_patterns,
//                                        player_supersub_stats,
//                                        referee_stats, etc.
//
// Both resolvers cache per-process via a shared Map. With only 5 supported
// leagues each resolver collapses to at most 5 DB round-trips for the
// lifetime of a serverless invocation.

const intCache  = new Map(); // leagueSmId → season sportmonks_id (INT)
const uuidCache = new Map(); // leagueSmId → season id (UUID)
const rowCache  = new Map(); // leagueSmId → { uuid, smId } (populated together)

async function loadSeasonRow(supabase, leagueSmId) {
  if (rowCache.has(leagueSmId)) return rowCache.get(leagueSmId);

  const { data: lg } = await supabase
    .from('leagues')
    .select('current_season_id')
    .eq('sportmonks_id', leagueSmId)
    .single();

  if (!lg?.current_season_id) {
    const row = { uuid: null, smId: null };
    rowCache.set(leagueSmId, row);
    return row;
  }

  const { data: sn } = await supabase
    .from('seasons')
    .select('id, sportmonks_id')
    .eq('id', lg.current_season_id)
    .single();

  const row = {
    uuid: sn?.id || null,
    smId: sn?.sportmonks_id || null,
  };
  rowCache.set(leagueSmId, row);
  return row;
}

/** Integer Sportmonks season ID (e.g. 25583 for EPL 2025/2026). */
export async function resolveSeasonSmId(supabase, leagueSmId) {
  if (intCache.has(leagueSmId)) return intCache.get(leagueSmId);
  const { smId } = await loadSeasonRow(supabase, leagueSmId);
  intCache.set(leagueSmId, smId);
  return smId;
}

/** Local UUID season ID — the PK on seasons/standings. */
export async function resolveSeasonUuid(supabase, leagueSmId) {
  if (uuidCache.has(leagueSmId)) return uuidCache.get(leagueSmId);
  const { uuid } = await loadSeasonRow(supabase, leagueSmId);
  uuidCache.set(leagueSmId, uuid);
  return uuid;
}

/** Both at once — saves the second DB trip when an endpoint needs each. */
export async function resolveSeasonPair(supabase, leagueSmId) {
  return loadSeasonRow(supabase, leagueSmId);
}

/** Sportmonks team_id (INT) → teams.id (UUID). Used by the standings path. */
export async function resolveTeamUuids(supabase, teamSmIds) {
  const ids = [...new Set(teamSmIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const { data: rows } = await supabase
    .from('teams')
    .select('id, sportmonks_id')
    .in('sportmonks_id', ids);
  return new Map((rows || []).map(r => [r.sportmonks_id, r.id]));
}
