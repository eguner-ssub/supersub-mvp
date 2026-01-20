/**
 * Settlement Engine - Pure Utility for Bet Result Calculation
 * 
 * This module provides a DRY (Don't Repeat Yourself) implementation of bet settlement logic.
 * It's used by both the frontend (GameContext) and backend (cron jobs) to ensure consistency.
 * 
 * @module settlementEngine
 */

/**
 * Calculate the result of a bet based on match data
 * 
 * @param {string} betType - Type of bet ('MATCH_RESULT', 'TOTAL_GOALS', 'PLAYER_SCORE', etc.)
 * @param {string} betSelection - User's selection ('HOME_WIN', 'AWAY_WIN', 'DRAW', 'OVER_2.5', etc.)
 * @param {number} matchScoreHome - Home team's final score
 * @param {number} matchScoreAway - Away team's final score
 * @param {string} matchStatus - Match status code ('FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', etc.)
 * 
 * @returns {{status: 'WON'|'LOST'|'VOID', payoutMultiplier: number}} Settlement result
 * 
 * @example
 * // Home team wins 2-1
 * calculateBetResult('MATCH_RESULT', 'HOME_WIN', 2, 1, 'FT')
 * // Returns: { status: 'WON', payoutMultiplier: 2.0 }
 * 
 * @example
 * // Match postponed
 * calculateBetResult('MATCH_RESULT', 'HOME_WIN', 0, 0, 'PST')
 * // Returns: { status: 'VOID', payoutMultiplier: 1.0 }
 */
export function calculateBetResult(betType, betSelection, matchScoreHome, matchScoreAway, matchStatus) {
    // Normalize inputs
    const homeGoals = Number(matchScoreHome) || 0;
    const awayGoals = Number(matchScoreAway) || 0;
    const status = String(matchStatus || '').toUpperCase();
    const selection = String(betSelection || '').toUpperCase();
    const type = String(betType || '').toUpperCase();

    // ============================================================================
    // VOID CASES - Match didn't complete normally
    // ============================================================================
    const VOID_STATUSES = ['PST', 'CANC', 'ABD', 'SUSP', 'INT', 'AWD', 'WO'];

    if (VOID_STATUSES.includes(status)) {
        return {
            status: 'VOID',
            payoutMultiplier: 1.0, // Full refund
            reason: `Match ${status} - Bet voided`
        };
    }

    // ============================================================================
    // MATCH RESULT BETS
    // ============================================================================
    if (type === 'MATCH_RESULT' || !type) {
        let isWin = false;

        switch (selection) {
            case 'HOME_WIN':
                isWin = homeGoals > awayGoals;
                break;

            case 'AWAY_WIN':
                isWin = awayGoals > homeGoals;
                break;

            case 'DRAW':
                isWin = homeGoals === awayGoals;
                break;

            default:
                console.warn(`Unknown selection: ${selection}. Defaulting to LOST.`);
                return {
                    status: 'LOST',
                    payoutMultiplier: 0,
                    reason: `Unknown selection: ${selection}`
                };
        }

        return {
            status: isWin ? 'WON' : 'LOST',
            payoutMultiplier: isWin ? 2.0 : 0,
            reason: `${homeGoals}-${awayGoals} (${selection})`
        };
    }

    // ============================================================================
    // TOTAL GOALS BETS (Over/Under)
    // ============================================================================
    if (type === 'TOTAL_GOALS') {
        const totalGoals = homeGoals + awayGoals;
        let isWin = false;

        // Parse threshold from selection (e.g., "OVER_2.5" -> 2.5)
        const overMatch = selection.match(/OVER[_\s]?([\d.]+)/i);
        const underMatch = selection.match(/UNDER[_\s]?([\d.]+)/i);

        if (overMatch) {
            const threshold = parseFloat(overMatch[1]);
            isWin = totalGoals > threshold;
        } else if (underMatch) {
            const threshold = parseFloat(underMatch[1]);
            isWin = totalGoals < threshold;
        } else {
            console.warn(`Unknown total goals selection: ${selection}`);
            return {
                status: 'LOST',
                payoutMultiplier: 0,
                reason: `Invalid total goals selection: ${selection}`
            };
        }

        return {
            status: isWin ? 'WON' : 'LOST',
            payoutMultiplier: isWin ? 1.8 : 0,
            reason: `Total goals: ${totalGoals} (${selection})`
        };
    }

    // ============================================================================
    // PLAYER SCORE BETS (Future Implementation)
    // ============================================================================
    if (type === 'PLAYER_SCORE') {
        // TODO: Implement player-specific scoring logic
        // Requires additional match data (goalscorers, assists, etc.)
        console.warn('PLAYER_SCORE bets not yet implemented');
        return {
            status: 'VOID',
            payoutMultiplier: 1.0,
            reason: 'Player score bets not yet supported'
        };
    }

    // ============================================================================
    // SUPERSUB BETS (Future Implementation)
    // ============================================================================
    if (type === 'SUPERSUB') {
        // TODO: Implement supersub-specific logic
        console.warn('SUPERSUB bets not yet implemented');
        return {
            status: 'VOID',
            payoutMultiplier: 1.0,
            reason: 'Supersub bets not yet supported'
        };
    }

    // ============================================================================
    // DEFAULT - Unknown bet type
    // ============================================================================
    console.warn(`Unknown bet type: ${type}. Defaulting to LOST.`);
    return {
        status: 'LOST',
        payoutMultiplier: 0,
        reason: `Unknown bet type: ${type}`
    };
}

/**
 * Batch calculate results for multiple bets
 * 
 * @param {Array} bets - Array of bet objects with { betType, betSelection, ... }
 * @param {Object} matchData - Match data with { goals: { home, away }, fixture: { status: { short } } }
 * @returns {Array} Array of results with bet IDs
 */
export function calculateBatchResults(bets, matchData) {
    const homeGoals = matchData.goals?.home || 0;
    const awayGoals = matchData.goals?.away || 0;
    const matchStatus = matchData.fixture?.status?.short || '';

    return bets.map(bet => ({
        betId: bet.id,
        ...calculateBetResult(
            bet.bet_type || 'MATCH_RESULT',
            bet.selection,
            homeGoals,
            awayGoals,
            matchStatus
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
