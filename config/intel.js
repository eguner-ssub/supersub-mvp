export const INTEL_CONFIG = {
  // Sync window
  SYNC_DAYS_AHEAD: 14,
  MIN_DAYS_BEFORE_KICKOFF: 0,

  // Display cutoff (switch from intel to lineups)
  LINEUPS_PHASE_MINUTES: 60,

  // Refresh threshold
  STALE_AFTER_HOURS: 24,

  // Thresholds for template logic
  THRESHOLDS: {
    STRONG_FAVORITE: 55,
    SLIGHT_FAVORITE: 45,
    HIGH_BTTS: 65,
    HIGH_GOALS: 65,
    DANGEROUS_BENCH: 0.3,
    EARLY_SUB_MINUTE: 55,
    LATE_SUB_MINUTE: 70,
  },

  // Sportmonks prediction type IDs
  TYPE_IDS: {
    FIRST_HALF_1X2: 237,
    FULLTIME_1X2: 233,
    CORRECT_SCORE: 240,
    BTTS: 231,
    HOME_OVER_15: 331,
    WIN_EITHER_HALF: 239,
    CORNERS_OVER_85: 1683,
    DOUBLE_CHANCE: 238,
    HT_FT: 232,
    OVER_UNDER_25: 235,
  },
};
