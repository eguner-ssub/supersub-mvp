/**
 * Leaderboard configuration constants.
 *
 * CURRENT_SEASONS must be updated each season — they map Sportmonks league IDs
 * to the active season ID used for league-specific leaderboards.
 */
export const LEADERBOARD_CONFIG = {
  /** Minimum settled bets required to appear on any leaderboard. */
  MIN_BETS_TO_QUALIFY: 5,

  /** Supported time periods for ranking. */
  PERIODS: ['all_time', 'season', 'weekly', 'monthly'],

  /** Sportmonks league_id → current season_id mapping (must match sync-squads.js). */
  CURRENT_SEASONS: {
    8:   25583,  // Premier League
    9:   25648,  // Championship
    82:  25646,  // Bundesliga
    564: 25659,  // La Liga
    384: 25533,  // Serie A
  },
};
