/**
 * Period key helpers for leaderboard time windows.
 *
 * Period key formats:
 *   all_time → 'all'
 *   season   → '25583' (season_id as string)
 *   weekly   → '2026-W12' (ISO week)
 *   monthly  → '2026-03' (year-month)
 */

import { LEADERBOARD_CONFIG } from '../../config/leaderboard.js';

/**
 * ISO week number for a date. Monday = start of week.
 * @param {Date} d
 * @returns {number}
 */
function getISOWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number (Mon=1, Sun=7)
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

/**
 * ISO week year — may differ from calendar year at year boundaries.
 * @param {Date} d
 * @returns {number}
 */
function getISOWeekYear(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  return date.getUTCFullYear();
}

/** Returns current ISO week key, e.g. '2026-W12'. */
export function getCurrentWeekKey() {
  const now = new Date();
  const year = getISOWeekYear(now);
  const week = getISOWeekNumber(now);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Returns current month key, e.g. '2026-03'. */
export function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Parse an ISO week key and return the Monday→Sunday date range (UTC).
 * @param {string} weekKey e.g. '2026-W12'
 * @returns {{ start: Date, end: Date }}
 */
export function getWeekDateRange(weekKey) {
  const [yearStr, weekStr] = weekKey.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);

  // Jan 4 is always in ISO week 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7; // Mon=1 ... Sun=7
  // Monday of week 1
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);

  const start = new Date(week1Monday);
  start.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Parse a month key and return the 1st→last-day date range (UTC).
 * @param {string} monthKey e.g. '2026-03'
 * @returns {{ start: Date, end: Date }}
 */
export function getMonthDateRange(monthKey) {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-indexed

  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  return { start, end };
}

/**
 * Resolve a period type to its current key.
 * @param {string} periodType 'all_time' | 'season' | 'weekly' | 'monthly'
 * @param {number} [seasonId] Override season ID (defaults to Premier League season)
 * @returns {string}
 */
export function getPeriodKey(periodType, seasonId) {
  switch (periodType) {
    case 'all_time': return 'all';
    case 'season':   return String(seasonId ?? LEADERBOARD_CONFIG.CURRENT_SEASONS[8]);
    case 'weekly':   return getCurrentWeekKey();
    case 'monthly':  return getCurrentMonthKey();
    default:         return 'all';
  }
}

/**
 * Human-readable label for a period.
 * @param {string} periodType
 * @returns {string}
 */
export function getPeriodLabel(periodType) {
  switch (periodType) {
    case 'all_time': return 'All Time';
    case 'season':   return '2025/26 Season';
    case 'weekly':   return 'This Week';
    case 'monthly':  return 'This Month';
    default:         return periodType;
  }
}

/**
 * Get date range for a given period type + key.
 * Returns null for all_time (no date filter needed).
 * @param {string} periodType
 * @param {string} periodKey
 * @returns {{ start: Date, end: Date } | null}
 */
export function getDateRangeForPeriod(periodType, periodKey) {
  switch (periodType) {
    case 'weekly':  return getWeekDateRange(periodKey);
    case 'monthly': return getMonthDateRange(periodKey);
    default:        return null; // all_time and season don't use date ranges
  }
}
