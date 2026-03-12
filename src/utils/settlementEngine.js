/**
 * Settlement Engine - Arcade Edition
 *
 * Frontend preview engine — calculates bet outcomes for UI display.
 * Must mirror the backend logic in scripts/settle.js exactly.
 *
 * Points:
 *   Standard cards (match_result, total_goals, player_score): Math.round(odds * 100)
 *   Supersub team-level (player_id is null): 500 fixed
 *   Supersub player-level (player_id is set): 2500 fixed
 *
 * @module settlementEngine
 */

// ── Shared constants (mirrored from scripts/settle.js) ──────────────────────
const FINISHED_STATUSES = ['FT', 'AET', 'PEN'];
const VOID_STATUSES = ['PST', 'CANC', 'ABD', 'SUSP', 'INT', 'AWD', 'WO'];
const COUNTABLE_GOAL_DETAILS = ['Normal Goal', 'Penalty'];

/**
 * Calculate the result of a bet based on match data.
 *
 * @param {string} cardType - The inventory ID (e.g., 'c_match_result', 'c_supersub')
 * @param {string|number} selection - The user's pick (e.g., 'HOME_WIN', playerID)
 * @param {object} matchData - Full match data including goals, events, lineups, odds
 * @returns {{ status: string, points: number, message?: string }}
 */
export const calculateBetResult = (cardType, selection, matchData) => {

    // 1. SAFETY: Ensure match is finished
    const status = matchData.fixture?.status?.short;
    if (!FINISHED_STATUSES.includes(status)) {
        return { status: 'PENDING', points: 0 };
    }

    const homeGoals = matchData.goals?.home || 0;
    const awayGoals = matchData.goals?.away || 0;
    const events = matchData.events || [];

    // 2. LOGIC SWITCH
    switch (cardType) {

        // --- A. MATCH RESULT (1x2) ---
        case 'c_match_winner':
        case 'c_match_result': {
            let result;
            if (homeGoals > awayGoals) result = 'HOME_WIN';
            else if (awayGoals > homeGoals) result = 'AWAY_WIN';
            else result = 'DRAW';

            // Normalize selection — accept both 'HOME'/'HOME_WIN' formats
            let normalizedSelection = String(selection).toUpperCase();
            if (normalizedSelection === 'HOME') normalizedSelection = 'HOME_WIN';
            else if (normalizedSelection === 'AWAY') normalizedSelection = 'AWAY_WIN';

            const closingOdds = matchData.odds?.match_winner?.[normalizedSelection] ?? 0;
            const won = result === normalizedSelection;

            return {
                status: won ? 'WON' : 'LOST',
                points: won ? Math.round(closingOdds * 100) : 0,
                market_odds: closingOdds,
            };
        }

        // --- B. TOTAL GOALS (Over/Under 2.5) ---
        case 'c_total_goals': {
            const total = homeGoals + awayGoals;
            const isOver = total > 2.5;

            // Accept both 'Over 2.5'/'OVER_2_5' formats
            const selStr = String(selection).toUpperCase();
            const predictedOver = selStr.includes('OVER');
            const won = isOver === predictedOver;

            const odds = matchData.odds?.total_goals ?? 0;

            return {
                status: won ? 'WON' : 'LOST',
                points: won ? Math.round(odds * 100) : 0,
                market_odds: odds,
            };
        }

        // --- C. PLAYER TO SCORE ---
        // Wins if the selected player scores a Normal Goal or Penalty within 90 minutes.
        // Excludes own goals and shootout penalties.
        case 'c_player_score': {
            const playerId = Number(selection);

            if (isNaN(playerId)) {
                return { status: 'LOST', points: 0, message: 'Invalid player ID' };
            }

            const playerScored = events.some(e =>
                e.type === 'Goal' &&
                COUNTABLE_GOAL_DETAILS.includes(e.detail) &&
                Number(e.player?.id) === playerId &&
                (e.time?.elapsed ?? 0) <= 90
            );

            const odds = matchData.odds?.player_score ?? 0;

            return {
                status: playerScored ? 'WON' : 'LOST',
                points: playerScored ? Math.round(odds * 100) : 0,
                market_odds: odds,
            };
        }

        // --- D. SUPERSUB ---
        // Wins if a substitute from the backed team scores or assists a goal
        // after their substitution minute, within 120 minutes.
        case 'c_supersub': {
            const backedTeamId = matchData.team_id ? Number(matchData.team_id) : null;
            const isPlayerLevel = matchData.player_id != null;
            const targetPlayerId = isPlayerLevel ? Number(matchData.player_id) : null;

            if (backedTeamId == null) {
                return { status: 'LOST', points: 0, message: 'No team_id' };
            }

            // Step 1: Build subsOnMap from substitution events (not lineups!)
            // In subst events: assist.id = incoming player
            const subsOnMap = new Map();
            for (const event of events) {
                if (
                    event.type === 'subst' &&
                    event.team?.id === backedTeamId &&
                    event.assist?.id != null
                ) {
                    subsOnMap.set(event.assist.id, event.time?.elapsed ?? 0);
                }
            }

            if (subsOnMap.size === 0) {
                return { status: 'LOST', points: 0 };
            }

            // For player-level bets, the target player must be among the subs
            if (isPlayerLevel && !subsOnMap.has(targetPlayerId)) {
                return { status: 'LOST', points: 0 };
            }

            // Step 2: Check goals scored by the backed team within 120 minutes
            for (const event of events) {
                if (
                    event.type === 'Goal' &&
                    COUNTABLE_GOAL_DETAILS.includes(event.detail) &&
                    event.team?.id === backedTeamId &&
                    (event.time?.elapsed ?? 0) <= 120
                ) {
                    const goalTime = event.time?.elapsed ?? 0;
                    const scorerId = event.player?.id;
                    const assistId = event.assist?.id;

                    // Check scorer
                    if (scorerId != null) {
                        const subOnTime = subsOnMap.get(scorerId);
                        if (subOnTime !== undefined && goalTime >= subOnTime) {
                            if (isPlayerLevel) {
                                if (scorerId === targetPlayerId) {
                                    return { status: 'WON', points: 2500 };
                                }
                            } else {
                                return { status: 'WON', points: 500 };
                            }
                        }
                    }

                    // Check assister
                    if (assistId != null) {
                        const subOnTime = subsOnMap.get(assistId);
                        if (subOnTime !== undefined && goalTime >= subOnTime) {
                            if (isPlayerLevel) {
                                if (assistId === targetPlayerId) {
                                    return { status: 'WON', points: 2500 };
                                }
                            } else {
                                return { status: 'WON', points: 500 };
                            }
                        }
                    }
                }
            }

            return { status: 'LOST', points: 0 };
        }

        default:
            return {
                status: 'VOID',
                points: 0,
                message: `Unknown card type: ${cardType}`,
            };
    }
};

/**
 * Batch calculate results for multiple bets
 *
 * @param {Array} bets - Array of bet objects with { id, card_type, selection, ... }
 * @param {Object} matchData - Match data with events, lineups, goals, etc.
 * @returns {Array} Array of results with bet IDs
 */
export function calculateBatchResults(bets, matchData) {
    return bets.map(bet => ({
        betId: bet.id,
        ...calculateBetResult(
            bet.card_type || bet.market,
            bet.selection,
            matchData
        )
    }));
}

/**
 * Determine if a match is finished and ready for settlement
 *
 * @param {string} matchStatus - Match status code
 * @returns {boolean} True if match is finished
 */
export function isMatchFinished(matchStatus) {
    return FINISHED_STATUSES.includes(String(matchStatus || '').toUpperCase());
}

/**
 * Determine if a match should void all bets
 *
 * @param {string} matchStatus - Match status code
 * @returns {boolean} True if match should void bets
 */
export function shouldVoidMatch(matchStatus) {
    return VOID_STATUSES.includes(String(matchStatus || '').toUpperCase());
}
