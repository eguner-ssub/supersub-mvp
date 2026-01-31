/**
 * Settlement Engine - Arcade Edition
 * 
 * This module handles bet settlement with an arcade-style points system.
 * Points are calculated as: Odds × 100 (standard cards) or Fixed Jackpot (SuperSub).
 * 
 * @module settlementEngine
 */

/**
 * Calculate the result of a bet based on match data
 * 
 * @param {string} cardType - The inventory ID (e.g., 'c_match_winner', 'c_supersub')
 * @param {string|number} selection - The user's pick (e.g., 'HOME', playerID)
 * @param {object} matchData - Full API response including goals, events, lineups
 * @returns {{status: string, market_odds?: number, fixed_points?: number, message?: string}}
 */
export const calculateBetResult = (cardType, selection, matchData) => {

    // 1. SAFETY: Ensure match is finished
    const status = matchData.fixture?.status?.short;
    if (!['FT', 'AET', 'PEN'].includes(status)) {
        return { status: 'PENDING' };
    }

    const homeGoals = matchData.goals?.home || 0;
    const awayGoals = matchData.goals?.away || 0;
    const events = matchData.events || [];
    const lineups = matchData.lineups || [];

    // 2. LOGIC SWITCH
    switch (cardType) {

        // --- A. MATCH RESULT (1x2) ---
        case 'c_match_winner':
        case 'c_match_result': {
            let result;
            if (homeGoals > awayGoals) result = 'HOME';
            else if (awayGoals > homeGoals) result = 'AWAY';
            else result = 'DRAW';

            // Normalize selection for comparison
            const normalizedSelection = String(selection).toUpperCase();

            // Get Closing Odds for Points Calculation (Fallback to 1.0)
            // Note: In a real app, you should prefer the odds locked at bet creation time.
            const closingOdds = matchData.odds?.match_winner?.[normalizedSelection] || 1.0;

            return {
                status: result === normalizedSelection ? 'WON' : 'LOST',
                market_odds: closingOdds
            };
        }

        // --- B. TOTAL GOALS (Over/Under 2.5) ---
        case 'c_total_goals': {
            const total = homeGoals + awayGoals;
            const isOver = total > 2.5;

            // Assumes selection is strictly 'Over 2.5' or 'Under 2.5'
            const wonGoals = (selection === 'Over 2.5' && isOver) ||
                (selection === 'Under 2.5' && !isOver);

            return {
                status: wonGoals ? 'WON' : 'LOST',
                market_odds: 1.85 // Dynamic API odds recommended here
            };
        }

        // --- C. PLAYER TO SCORE (Anytime) ---
        case 'c_player_score': {
            // Selection is the Player ID (convert to number for comparison)
            const playerId = Number(selection);

            const playerScored = events.some(e =>
                e.type === 'Goal' &&
                e.detail !== 'Missed Penalty' &&
                Number(e.player?.id) === playerId
            );

            return {
                status: playerScored ? 'WON' : 'LOST',
                market_odds: 2.50 // Dynamic API odds recommended here
            };
        }

        // --- D. SUPERSUB (The "Any Sub" Mechanic) ---
        case 'c_supersub': {
            // 1. Identify Bench Players from Lineups (Primary Source)
            const benchIds = new Set();

            if (lineups.length > 0) {
                // Parse lineups to find substitutes
                lineups.forEach(team => {
                    const substitutes = team.substitutes || [];
                    substitutes.forEach(sub => {
                        if (sub.player?.id) {
                            benchIds.add(Number(sub.player.id));
                        }
                    });
                });
            } else {
                // Fallback: Use 'subst' events if lineups missing
                events.forEach(e => {
                    if (e.type === 'subst' && e.player?.id) {
                        benchIds.add(Number(e.player.id));
                    }
                });
            }

            // 2. Check if any bench player scored
            const subScored = events.some(e =>
                e.type === 'Goal' &&
                e.detail !== 'Missed Penalty' &&
                e.player?.id &&
                benchIds.has(Number(e.player.id))
            );

            return {
                status: subScored ? 'WON' : 'LOST',
                fixed_points: 5000 // JACKPOT REWARD
            };
        }

        default:
            return {
                status: 'VOID',
                message: `Unknown card type: ${cardType}`
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
    const FINISHED_STATUSES = ['FT', 'AET', 'PEN'];
    return FINISHED_STATUSES.includes(String(matchStatus || '').toUpperCase());
}

/**
 * Determine if a match should void all bets
 * 
 * @param {string} matchStatus - Match status code
 * @returns {boolean} True if match should void bets
 */
export function shouldVoidMatch(matchStatus) {
    const VOID_STATUSES = ['PST', 'CANC', 'ABD', 'SUSP', 'INT', 'AWD', 'WO'];
    return VOID_STATUSES.includes(String(matchStatus || '').toUpperCase());
}
