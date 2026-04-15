#!/usr/bin/env node
// scripts/sync-match-intel.js
// Usage: node scripts/sync-match-intel.js
// Cron:  daily at 6am via cron-job.org → POST /api/cron/sync-match-intel
//
// Fetches Sportmonks predictions for upcoming matches (1–14 days out),
// merges with internal bench/coach analytics, generates editorial prose,
// and upserts to match_intel table.

import { createClient } from '@supabase/supabase-js';
import { processMatchIntel } from '../lib/intel/processor.js';
import { INTEL_CONFIG } from '../config/intel.js';

const PREFIX = '[sync-match-intel]';
const { SYNC_DAYS_AHEAD, MIN_DAYS_BEFORE_KICKOFF, STALE_AFTER_HOURS } = INTEL_CONFIG;
const MAX_PER_RUN = 8; // Prevent Vercel 10s function timeout

// ── Rate limiting ────────────────────────────────────────────────────────────
const RATE_LIMIT_MS = 1100;
let lastRequestAt = 0;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function throttle() {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < RATE_LIMIT_MS) await sleep(RATE_LIMIT_MS - elapsed);
  lastRequestAt = Date.now();
}

// ── Lazy Supabase ────────────────────────────────────────────────────────────
let _client = null;
function getSupabase() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  _client = createClient(url, key);
  return _client;
}

// ── Sportmonks predictions fetch ─────────────────────────────────────────────
async function fetchSportmonksPredictions(fixtureId) {
  const token = process.env.SPORTMONKS_API_TOKEN;
  if (!token) return { data: null, error: 'no_token' };

  await throttle();

  const url = `https://api.sportmonks.com/v3/football/predictions/probabilities/fixtures/${fixtureId}?api_token=${token}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) return { data: null, error: 'not_found' };
      throw new Error(`Sportmonks ${res.status}`);
    }
    const json = await res.json();
    return { data: json, error: null };
  } catch (err) {
    console.error(`${PREFIX} Sportmonks error for fixture ${fixtureId}:`, err.message);
    return { data: null, error: err.message };
  }
}

// ── Load internal analytics ──────────────────────────────────────────────────
async function loadInternalData(supabase, match, seasonId) {
  // Bench stats
  const [homeBench, awayBench] = await Promise.all([
    supabase.from('team_bench_stats').select('*')
      .eq('team_id', match.home_team_id).eq('season_id', seasonId).single(),
    supabase.from('team_bench_stats').select('*')
      .eq('team_id', match.away_team_id).eq('season_id', seasonId).single(),
  ]);

  // Coach patterns (with coach name via join)
  const [homeCoach, awayCoach] = await Promise.all([
    match.home_coach_id
      ? supabase.from('coach_substitution_patterns')
          .select('*, coaches(name, common_name)')
          .eq('coach_id', match.home_coach_id).eq('season_id', seasonId).single()
      : Promise.resolve({ data: null }),
    match.away_coach_id
      ? supabase.from('coach_substitution_patterns')
          .select('*, coaches(name, common_name)')
          .eq('coach_id', match.away_coach_id).eq('season_id', seasonId).single()
      : Promise.resolve({ data: null }),
  ]);

  // Top supersubs per team (top 3 by goals_as_sub)
  const [homeSupersubs, awaySupersubs] = await Promise.all([
    supabase.from('player_supersub_stats')
      .select('*, player_squad_cache(player_name)')
      .eq('team_id', match.home_team_id).eq('season_id', seasonId)
      .gt('goals_as_sub', 0)
      .order('goals_as_sub', { ascending: false }).limit(3),
    supabase.from('player_supersub_stats')
      .select('*, player_squad_cache(player_name)')
      .eq('team_id', match.away_team_id).eq('season_id', seasonId)
      .gt('goals_as_sub', 0)
      .order('goals_as_sub', { ascending: false }).limit(3),
  ]);

  // Flatten coach data with name
  const homeCoachData = homeCoach.data ? {
    ...homeCoach.data,
    coach_name: homeCoach.data.coaches?.common_name || homeCoach.data.coaches?.name,
  } : null;
  const awayCoachData = awayCoach.data ? {
    ...awayCoach.data,
    coach_name: awayCoach.data.coaches?.common_name || awayCoach.data.coaches?.name,
  } : null;

  // Standings (for Form Guide).
  // standings.team_id and standings.season_id are UUIDs (FKs to the local
  // teams/seasons tables); this function receives Sportmonks integer IDs.
  // Mirror the writer-side logic in sync-standings.js: resolve the current
  // season UUID via leagues.current_season_id, and resolve team UUIDs via
  // teams.sportmonks_id.
  const { data: league } = await supabase
    .from('leagues')
    .select('current_season_id')
    .eq('sportmonks_id', match.league_id)
    .single();
  const currentSeasonUuid = league?.current_season_id || null;

  const { data: teamRows } = await supabase
    .from('teams')
    .select('id, sportmonks_id')
    .in('sportmonks_id', [match.home_team_id, match.away_team_id]);
  const homeTeamUuid = teamRows?.find(t => t.sportmonks_id === match.home_team_id)?.id || null;
  const awayTeamUuid = teamRows?.find(t => t.sportmonks_id === match.away_team_id)?.id || null;

  const [homeStandings, awayStandings] = currentSeasonUuid
    ? await Promise.all([
        homeTeamUuid
          ? supabase.from('standings')
              .select('position, played, won, drawn, lost, points, form')
              .eq('team_id', homeTeamUuid)
              .eq('season_id', currentSeasonUuid).single()
          : Promise.resolve({ data: null }),
        awayTeamUuid
          ? supabase.from('standings')
              .select('position, played, won, drawn, lost, points, form')
              .eq('team_id', awayTeamUuid)
              .eq('season_id', currentSeasonUuid).single()
          : Promise.resolve({ data: null }),
      ])
    : [{ data: null }, { data: null }];

  // Flatten supersub data with player name
  const flattenSubs = (rows) => (rows || []).map(s => ({
    ...s,
    player_name: s.player_squad_cache?.player_name,
  }));

  return {
    homeBenchStats: homeBench.data,
    awayBenchStats: awayBench.data,
    homeCoachPatterns: homeCoachData,
    awayCoachPatterns: awayCoachData,
    homeTopSupersubs: flattenSubs(homeSupersubs.data),
    awayTopSupersubs: flattenSubs(awaySupersubs.data),
    homeStandings: homeStandings.data,
    awayStandings: awayStandings.data,
  };
}

// ── Main sync ────────────────────────────────────────────────────────────────
export async function syncMatchIntel(supabaseOverride) {
  const supabase = supabaseOverride || getSupabase();
  const now = new Date();
  const minDate = new Date(now.getTime() + MIN_DAYS_BEFORE_KICKOFF * 24 * 60 * 60 * 1000);
  const maxDate = new Date(now.getTime() + SYNC_DAYS_AHEAD * 24 * 60 * 60 * 1000);
  const staleThreshold = new Date(now.getTime() - STALE_AFTER_HOURS * 60 * 60 * 1000);

  console.log(`${PREFIX} Fetching matches between ${minDate.toISOString().slice(0, 10)} and ${maxDate.toISOString().slice(0, 10)} ...`);

  // Get matches in window
  const { data: matches, error } = await supabase
    .from('matches')
    .select(`
      id, home_team, away_team, home_team_id, away_team_id,
      home_coach_id, away_coach_id, kickoff_time, season, league_id
    `)
    .gte('kickoff_time', minDate.toISOString())
    .lte('kickoff_time', maxDate.toISOString());

  if (error) throw new Error(`Failed to fetch matches: ${error.message}`);
  if (!matches?.length) {
    console.log(`${PREFIX} No matches in sync window`);
    return 0;
  }

  // Filter out matches that already have fresh intel
  const matchIds = matches.map(m => m.id);
  const { data: existingIntel } = await supabase
    .from('match_intel')
    .select('match_id, sportmonks_fetched_at')
    .in('match_id', matchIds);

  const freshSet = new Set(
    (existingIntel || [])
      .filter(i => i.sportmonks_fetched_at && new Date(i.sportmonks_fetched_at) > staleThreshold)
      .map(i => i.match_id)
  );

  const allStale = matches.filter(m => !freshSet.has(m.id));
  const staleMatches = allStale.slice(0, MAX_PER_RUN);
  console.log(`${PREFIX} ${matches.length} matches in window, ${allStale.length} need refresh (processing ${staleMatches.length})`);

  let success = 0;
  let failed = 0;

  // Resolve the Sportmonks integer season ID per league on demand.
  // team_bench_stats / coach_substitution_patterns / player_supersub_stats
  // all key on INTEGER season_id (e.g. 25583), not UUID. matches.season is
  // never populated, so translate via leagues.current_season_id → seasons.sportmonks_id.
  // Cached per-run by league so each supported league costs one pair of lookups max.
  const leagueSeasonCache = new Map();
  async function resolveSeasonSmId(leagueSmId) {
    if (leagueSeasonCache.has(leagueSmId)) return leagueSeasonCache.get(leagueSmId);
    const { data: lg } = await supabase
      .from('leagues').select('current_season_id')
      .eq('sportmonks_id', leagueSmId).single();
    if (!lg?.current_season_id) { leagueSeasonCache.set(leagueSmId, null); return null; }
    const { data: sn } = await supabase
      .from('seasons').select('sportmonks_id')
      .eq('id', lg.current_season_id).single();
    const smId = sn?.sportmonks_id || null;
    leagueSeasonCache.set(leagueSmId, smId);
    return smId;
  }

  for (const match of staleMatches) {
    try {
      // Fetch Sportmonks predictions
      const { data: sportmonksRaw } = await fetchSportmonksPredictions(match.id);

      // Load internal analytics
      const seasonSmId = await resolveSeasonSmId(match.league_id);
      const internalData = await loadInternalData(supabase, match, seasonSmId);

      // Process everything
      const { sportmonksAvailable, sections, prose } = processMatchIntel({
        sportmonksRaw,
        ...internalData,
        homeTeam: match.home_team,
        awayTeam: match.away_team,
        homeStandings: internalData.homeStandings,
        awayStandings: internalData.awayStandings,
      });

      // Upsert to match_intel
      const { error: upsertError } = await supabase
        .from('match_intel')
        .upsert({
          match_id: match.id,
          sportmonks_raw: sportmonksRaw,
          sportmonks_available: sportmonksAvailable,
          sportmonks_fetched_at: new Date().toISOString(),
          home_bench_stats: internalData.homeBenchStats,
          away_bench_stats: internalData.awayBenchStats,
          home_coach_patterns: internalData.homeCoachPatterns,
          away_coach_patterns: internalData.awayCoachPatterns,
          home_top_supersubs: internalData.homeTopSupersubs,
          away_top_supersubs: internalData.awayTopSupersubs,
          report_sections: sections,
          prose,
          prose_method: 'template',
          generated_at: new Date().toISOString(),
          expires_at: match.kickoff_time,
        }, { onConflict: 'match_id' });

      if (upsertError) throw upsertError;

      success++;
      console.log(`${PREFIX}   ✓ ${match.home_team} vs ${match.away_team} (SM: ${sportmonksAvailable ? 'yes' : 'no'})`);
    } catch (err) {
      console.error(`${PREFIX}   ✗ ${match.home_team} vs ${match.away_team}: ${err.message}`);
      failed++;
    }
  }

  console.log(`${PREFIX}`);
  console.log(`${PREFIX} ─── Summary ───────────────────────────────`);
  console.log(`${PREFIX}   Matches in window : ${matches.length}`);
  console.log(`${PREFIX}   Refreshed         : ${success}`);
  console.log(`${PREFIX}   Failed            : ${failed}`);
  console.log(`${PREFIX}   Already fresh     : ${freshSet.size}`);
  console.log(`${PREFIX} ────────────────────────────────────────────`);

  return success;
}

// Run if called directly (not when imported by cron handler)
const isMain = process.argv[1]?.endsWith('sync-match-intel.js');
if (isMain) {
  // Load dotenv only for standalone CLI runs
  const { default: dotenv } = await import('dotenv');
  dotenv.config();

  syncMatchIntel().catch(err => {
    console.error(`${PREFIX} Fatal:`, err);
    process.exit(1);
  });
}
