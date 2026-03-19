/**
 * Core leaderboard refresh logic.
 *
 * Shared by scripts/refresh-leaderboards.js (CLI) and
 * api/cron/refresh-leaderboards.js (Vercel cron).
 *
 * Computes ranks for global, country, and league leaderboards across all
 * time periods, then writes the results to leaderboard_entries.
 */

import { LEADERBOARD_CONFIG } from '../../config/leaderboard.js';
import {
  getCurrentWeekKey,
  getCurrentMonthKey,
  getPeriodKey,
  getDateRangeForPeriod,
} from './periods.js';
import { getCountryName } from './countries.js';

const { MIN_BETS_TO_QUALIFY, CURRENT_SEASONS } = LEADERBOARD_CONFIG;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Delete existing entries and insert fresh ranked rows for a leaderboard + period.
 */
async function writeEntries(db, leaderboardId, periodType, periodKey, rankedRows) {
  // Delete stale entries for this slot
  const { error: delErr } = await db
    .from('leaderboard_entries')
    .delete()
    .eq('leaderboard_id', leaderboardId)
    .eq('period_type', periodType)
    .eq('period_key', periodKey);

  if (delErr) {
    console.error(`[refresh] Delete failed (${periodType}/${periodKey}):`, delErr.message);
    return 0;
  }

  if (rankedRows.length === 0) return 0;

  const totalEntries = rankedRows.length;
  const rows = rankedRows.map((r, i) => ({
    leaderboard_id: leaderboardId,
    period_type:    periodType,
    period_key:     periodKey,
    user_id:        r.user_id,
    points:         r.points,
    rank:           i + 1,
    bet_count:      r.bet_count,
    win_count:      r.win_count,
    total_entries:  totalEntries,
    updated_at:     new Date().toISOString(),
  }));

  // Batch insert in chunks of 500
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await db
      .from('leaderboard_entries')
      .insert(chunk);
    if (error) {
      console.error(`[refresh] Insert failed (${periodType}/${periodKey} batch ${i}):`, error.message);
    }
  }

  return totalEntries;
}

// ── Global leaderboard ───────────────────────────────────────────────────────

async function refreshGlobalAllTime(db, leaderboardId) {
  // Aggregate from profiles.points + predictions counts
  const { data, error } = await db.rpc('_leaderboard_global_all_time', {
    min_bets: MIN_BETS_TO_QUALIFY,
  });

  // Fallback: if RPC doesn't exist, query directly
  if (error) {
    console.warn('[refresh] RPC _leaderboard_global_all_time not found, using direct query');
    return await refreshGlobalAllTimeDirect(db, leaderboardId);
  }

  return writeEntries(db, leaderboardId, 'all_time', 'all', data || []);
}

async function refreshGlobalAllTimeDirect(db, leaderboardId) {
  // Get all settled predictions grouped by user
  const { data: stats, error } = await db
    .from('predictions')
    .select('user_id')
    .eq('status', 'SETTLED');

  if (error) {
    console.error('[refresh] Failed to query predictions:', error.message);
    return 0;
  }

  // Aggregate bet/win counts per user
  const userStats = new Map();
  for (const p of (stats || [])) {
    if (!userStats.has(p.user_id)) {
      userStats.set(p.user_id, { bet_count: 0, win_count: 0 });
    }
    userStats.get(p.user_id).bet_count++;
  }

  // Get win counts separately
  const { data: wins } = await db
    .from('predictions')
    .select('user_id')
    .eq('status', 'SETTLED')
    .eq('settled_status', 'WON');

  for (const p of (wins || [])) {
    if (userStats.has(p.user_id)) {
      userStats.get(p.user_id).win_count++;
    }
  }

  // Get profiles with points
  const { data: profiles } = await db
    .from('profiles')
    .select('id, club_name, points')
    .gt('points', 0);

  const ranked = (profiles || [])
    .filter((p) => {
      const s = userStats.get(p.id);
      return s && s.bet_count >= MIN_BETS_TO_QUALIFY;
    })
    .map((p) => ({
      user_id:   p.id,
      club_name: p.club_name,
      points:    p.points,
      bet_count: userStats.get(p.id).bet_count,
      win_count: userStats.get(p.id).win_count,
    }))
    .sort((a, b) => b.points - a.points || (a.club_name || '').localeCompare(b.club_name || ''));

  return writeEntries(db, leaderboardId, 'all_time', 'all', ranked);
}

async function refreshGlobalTimePeriod(db, leaderboardId, periodType, periodKey, dateRange) {
  if (!dateRange) return 0;

  // Aggregate points_awarded from predictions settled in this period
  const { data: preds, error } = await db
    .from('predictions')
    .select('user_id, points_awarded, settled_status')
    .eq('status', 'SETTLED')
    .gte('settled_at', dateRange.start.toISOString())
    .lte('settled_at', dateRange.end.toISOString());

  if (error) {
    console.error(`[refresh] Failed to query predictions for ${periodType}:`, error.message);
    return 0;
  }

  const userMap = new Map();
  for (const p of (preds || [])) {
    if (!userMap.has(p.user_id)) {
      userMap.set(p.user_id, { points: 0, bet_count: 0, win_count: 0 });
    }
    const u = userMap.get(p.user_id);
    u.bet_count++;
    if (p.settled_status === 'WON') {
      u.points += p.points_awarded || 0;
      u.win_count++;
    }
  }

  // Get club_names for ranking
  const userIds = [...userMap.keys()];
  if (userIds.length === 0) return 0;

  const { data: profiles } = await db
    .from('profiles')
    .select('id, club_name')
    .in('id', userIds);

  const profileMap = new Map((profiles || []).map((p) => [p.id, p.club_name]));

  const ranked = [...userMap.entries()]
    .filter(([, s]) => s.bet_count >= MIN_BETS_TO_QUALIFY && s.points > 0)
    .map(([userId, s]) => ({
      user_id:   userId,
      club_name: profileMap.get(userId) || '',
      points:    s.points,
      bet_count: s.bet_count,
      win_count: s.win_count,
    }))
    .sort((a, b) => b.points - a.points || a.club_name.localeCompare(b.club_name));

  return writeEntries(db, leaderboardId, periodType, periodKey, ranked);
}

// ── Country leaderboard ──────────────────────────────────────────────────────

async function ensureCountryLeaderboard(db, countryCode) {
  const name = getCountryName(countryCode);

  const { data, error } = await db
    .from('leaderboards')
    .upsert(
      { type: 'country', scope_key: countryCode, name },
      { onConflict: 'type,scope_key' }
    )
    .select('id')
    .single();

  if (error) {
    console.error(`[refresh] Failed to ensure country leaderboard ${countryCode}:`, error.message);
    return null;
  }

  return data.id;
}

async function refreshCountryAllTime(db, leaderboardId, countryCode) {
  // Get users in this country
  const { data: profiles } = await db
    .from('profiles')
    .select('id, club_name, points')
    .eq('country_code', countryCode)
    .gt('points', 0);

  if (!profiles || profiles.length === 0) return 0;

  const userIds = profiles.map((p) => p.id);

  // Get bet/win counts
  const { data: preds } = await db
    .from('predictions')
    .select('user_id, settled_status')
    .eq('status', 'SETTLED')
    .in('user_id', userIds);

  const statsMap = new Map();
  for (const p of (preds || [])) {
    if (!statsMap.has(p.user_id)) statsMap.set(p.user_id, { bet_count: 0, win_count: 0 });
    const s = statsMap.get(p.user_id);
    s.bet_count++;
    if (p.settled_status === 'WON') s.win_count++;
  }

  const ranked = profiles
    .filter((p) => {
      const s = statsMap.get(p.id);
      return s && s.bet_count >= MIN_BETS_TO_QUALIFY;
    })
    .map((p) => ({
      user_id:   p.id,
      club_name: p.club_name,
      points:    p.points,
      bet_count: statsMap.get(p.id).bet_count,
      win_count: statsMap.get(p.id).win_count,
    }))
    .sort((a, b) => b.points - a.points || (a.club_name || '').localeCompare(b.club_name || ''));

  return writeEntries(db, leaderboardId, 'all_time', 'all', ranked);
}

async function refreshCountryTimePeriod(db, leaderboardId, countryCode, periodType, periodKey, dateRange) {
  if (!dateRange) return 0;

  // Get user IDs in this country
  const { data: profiles } = await db
    .from('profiles')
    .select('id, club_name')
    .eq('country_code', countryCode);

  if (!profiles || profiles.length === 0) return 0;

  const userIds = profiles.map((p) => p.id);
  const profileMap = new Map(profiles.map((p) => [p.id, p.club_name]));

  const { data: preds } = await db
    .from('predictions')
    .select('user_id, points_awarded, settled_status')
    .eq('status', 'SETTLED')
    .in('user_id', userIds)
    .gte('settled_at', dateRange.start.toISOString())
    .lte('settled_at', dateRange.end.toISOString());

  const userMap = new Map();
  for (const p of (preds || [])) {
    if (!userMap.has(p.user_id)) userMap.set(p.user_id, { points: 0, bet_count: 0, win_count: 0 });
    const u = userMap.get(p.user_id);
    u.bet_count++;
    if (p.settled_status === 'WON') { u.points += p.points_awarded || 0; u.win_count++; }
  }

  const ranked = [...userMap.entries()]
    .filter(([, s]) => s.bet_count >= MIN_BETS_TO_QUALIFY && s.points > 0)
    .map(([userId, s]) => ({
      user_id:   userId,
      club_name: profileMap.get(userId) || '',
      ...s,
    }))
    .sort((a, b) => b.points - a.points || a.club_name.localeCompare(b.club_name));

  return writeEntries(db, leaderboardId, periodType, periodKey, ranked);
}

// ── League leaderboard ───────────────────────────────────────────────────────

async function refreshLeagueAllTime(db, leaderboardId, leagueId) {
  const { data: ulp } = await db
    .from('user_league_points')
    .select('user_id, points, bet_count, win_count')
    .eq('league_id', leagueId)
    .gte('bet_count', MIN_BETS_TO_QUALIFY)
    .gt('points', 0);

  if (!ulp || ulp.length === 0) return 0;

  const userIds = ulp.map((r) => r.user_id);
  const { data: profiles } = await db
    .from('profiles')
    .select('id, club_name')
    .in('id', userIds);

  const profileMap = new Map((profiles || []).map((p) => [p.id, p.club_name]));

  const ranked = ulp
    .map((r) => ({ ...r, club_name: profileMap.get(r.user_id) || '' }))
    .sort((a, b) => b.points - a.points || a.club_name.localeCompare(b.club_name));

  return writeEntries(db, leaderboardId, 'all_time', 'all', ranked);
}

async function refreshLeagueSeason(db, leaderboardId, leagueId, seasonId) {
  const periodKey = String(seasonId);

  const { data: ulp } = await db
    .from('user_league_points')
    .select('user_id, points, bet_count, win_count')
    .eq('league_id', leagueId)
    .eq('season_id', seasonId)
    .gte('bet_count', MIN_BETS_TO_QUALIFY)
    .gt('points', 0);

  if (!ulp || ulp.length === 0) return 0;

  const userIds = ulp.map((r) => r.user_id);
  const { data: profiles } = await db
    .from('profiles')
    .select('id, club_name')
    .in('id', userIds);

  const profileMap = new Map((profiles || []).map((p) => [p.id, p.club_name]));

  const ranked = ulp
    .map((r) => ({ ...r, club_name: profileMap.get(r.user_id) || '' }))
    .sort((a, b) => b.points - a.points || a.club_name.localeCompare(b.club_name));

  return writeEntries(db, leaderboardId, 'season', periodKey, ranked);
}

async function refreshLeagueTimePeriod(db, leaderboardId, leagueId, periodType, periodKey, dateRange) {
  if (!dateRange) return 0;

  const { data: preds } = await db
    .from('predictions')
    .select('user_id, points_awarded, settled_status')
    .eq('status', 'SETTLED')
    .eq('league_id', leagueId)
    .gte('settled_at', dateRange.start.toISOString())
    .lte('settled_at', dateRange.end.toISOString());

  const userMap = new Map();
  for (const p of (preds || [])) {
    if (!userMap.has(p.user_id)) userMap.set(p.user_id, { points: 0, bet_count: 0, win_count: 0 });
    const u = userMap.get(p.user_id);
    u.bet_count++;
    if (p.settled_status === 'WON') { u.points += p.points_awarded || 0; u.win_count++; }
  }

  const userIds = [...userMap.keys()];
  if (userIds.length === 0) return 0;

  const { data: profiles } = await db
    .from('profiles')
    .select('id, club_name')
    .in('id', userIds);

  const profileMap = new Map((profiles || []).map((p) => [p.id, p.club_name]));

  const ranked = [...userMap.entries()]
    .filter(([, s]) => s.bet_count >= MIN_BETS_TO_QUALIFY && s.points > 0)
    .map(([userId, s]) => ({
      user_id:   userId,
      club_name: profileMap.get(userId) || '',
      ...s,
    }))
    .sort((a, b) => b.points - a.points || a.club_name.localeCompare(b.club_name));

  return writeEntries(db, leaderboardId, periodType, periodKey, ranked);
}

// ── Main refresh ─────────────────────────────────────────────────────────────

/**
 * Refresh all leaderboards. Called by both the CLI script and the cron endpoint.
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 */
export async function refreshLeaderboards(db) {
  const weekKey  = getCurrentWeekKey();
  const monthKey = getCurrentMonthKey();

  let totalEntries = 0;

  // ── 1. Global leaderboard ──────────────────────────────────────────────
  const { data: globalLb } = await db
    .from('leaderboards')
    .select('id')
    .eq('type', 'global')
    .is('scope_key', null)
    .single();

  if (globalLb) {
    console.log('[refresh] Global leaderboard …');

    totalEntries += await refreshGlobalAllTimeDirect(db, globalLb.id);

    // Season: use each league's season for the global board (use PL season as canonical)
    const seasonKey = getPeriodKey('season');
    const seasonRange = null; // season uses all_time logic but scoped — skip date filter
    // For global season, we just use all predictions in the current season's date range
    // Simplified: reuse all_time for season (TODO: scope to season dates if needed)
    totalEntries += await refreshGlobalTimePeriod(
      db, globalLb.id, 'season', seasonKey, null
    );

    const weekRange  = getDateRangeForPeriod('weekly', weekKey);
    const monthRange = getDateRangeForPeriod('monthly', monthKey);

    totalEntries += await refreshGlobalTimePeriod(db, globalLb.id, 'weekly', weekKey, weekRange);
    totalEntries += await refreshGlobalTimePeriod(db, globalLb.id, 'monthly', monthKey, monthRange);

    console.log(`[refresh]   Global done`);
  }

  // ── 2. Country leaderboards ────────────────────────────────────────────
  const { data: countries } = await db
    .from('profiles')
    .select('country_code')
    .not('country_code', 'is', null);

  const distinctCountries = [...new Set((countries || []).map((c) => c.country_code))];
  console.log(`[refresh] ${distinctCountries.length} countries to process …`);

  for (const cc of distinctCountries) {
    const lbId = await ensureCountryLeaderboard(db, cc);
    if (!lbId) continue;

    totalEntries += await refreshCountryAllTime(db, lbId, cc);

    const weekRange  = getDateRangeForPeriod('weekly', weekKey);
    const monthRange = getDateRangeForPeriod('monthly', monthKey);
    totalEntries += await refreshCountryTimePeriod(db, lbId, cc, 'weekly', weekKey, weekRange);
    totalEntries += await refreshCountryTimePeriod(db, lbId, cc, 'monthly', monthKey, monthRange);
  }

  console.log(`[refresh]   Countries done`);

  // ── 3. League leaderboards ─────────────────────────────────────────────
  const { data: leagueLbs } = await db
    .from('leaderboards')
    .select('id, scope_key')
    .eq('type', 'league')
    .eq('is_active', true);

  for (const lb of (leagueLbs || [])) {
    const leagueId = parseInt(lb.scope_key, 10);
    const seasonId = CURRENT_SEASONS[leagueId];
    if (!seasonId) continue;

    console.log(`[refresh] League ${leagueId} …`);

    totalEntries += await refreshLeagueAllTime(db, lb.id, leagueId);
    totalEntries += await refreshLeagueSeason(db, lb.id, leagueId, seasonId);

    const weekRange  = getDateRangeForPeriod('weekly', weekKey);
    const monthRange = getDateRangeForPeriod('monthly', monthKey);
    totalEntries += await refreshLeagueTimePeriod(db, lb.id, leagueId, 'weekly', weekKey, weekRange);
    totalEntries += await refreshLeagueTimePeriod(db, lb.id, leagueId, 'monthly', monthKey, monthRange);
  }

  console.log(`[refresh]   Leagues done`);
  console.log(`[refresh] Total entries written: ${totalEntries}`);

  return totalEntries;
}
