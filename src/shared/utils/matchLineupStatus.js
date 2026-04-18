/**
 * matchLineupStatus — helpers for deriving lineup confirmation state.
 *
 * Three-state model for the lineup pill:
 *   'predicted'  — lineups are Sportmonks probable XI (pre-kickoff, flag not set)
 *   'confirmed'  — Sportmonks LINEUP_CONFIRMED metadata flipped true (~1h pre-KO)
 *   'live'       — match is in progress; pill hidden (status is obvious from timer)
 *   'finished'   — match is done; pill hidden (status is obvious from final score)
 *
 * The DB column matches.lineup_confirmed is set by the sync-scores pipeline
 * when fixture.metadata contains { type.developer_name: 'LINEUP_CONFIRMED',
 * values.confirmed: true }.
 */

const LIVE_STATUSES = [
  'INPLAY_1ST_HALF', 'INPLAY_2ND_HALF', 'INPLAY_ET', 'INPLAY_ET_SECOND_HALF',
  'INPLAY_PENALTIES', 'HT', 'BREAK', 'EXTRA_TIME_BREAK',
];

const FINISHED_STATUSES = [
  'FT', 'FT_PEN', 'AET', 'FINISHED', 'ENDED',
  'POSTPONED', 'CANCELLED', 'ABANDONED', 'AWARDED', 'WO', 'DELETED',
];

/**
 * Returns one of: 'predicted' | 'confirmed' | 'live' | 'finished'
 */
export function getLineupStatus(match) {
  const status = match?.fixture?.status?.short || match?.status;

  if (LIVE_STATUSES.includes(status)) return 'live';
  if (FINISHED_STATUSES.includes(status)) return 'finished';
  if (match?.lineup_confirmed) return 'confirmed';
  return 'predicted';
}

/**
 * Backward-compatible boolean wrapper.
 * Returns true for confirmed, live, and finished — i.e. any state where
 * the lineup is definitively known. Used by callers that only need a
 * binary "is this lineup trustworthy?" answer.
 */
export function isLineupConfirmed(match) {
  const status = getLineupStatus(match);
  return status !== 'predicted';
}
