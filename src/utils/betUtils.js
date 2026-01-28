/**
 * Bet Utilities
 * Helper functions for bet data manipulation and grouping
 */

/**
 * Groups bets by match
 * @param {Array} bets - Array of bet objects
 * @returns {Array} Array of match objects, each containing grouped bets and total payout
 */
export const groupBetsByMatch = (bets) => {
    if (!bets || bets.length === 0) return [];

    // Create a map to group bets by match
    const matchMap = new Map();

    bets.forEach((bet) => {
        // Use match_id if available, otherwise fall back to team_name as the key
        const matchKey = bet.match_id || bet.team_name || 'unknown';

        if (!matchMap.has(matchKey)) {
            matchMap.set(matchKey, {
                matchId: bet.match_id,
                matchName: bet.team_name || 'Unknown Match',
                bets: [],
                totalPotentialPayout: 0,
            });
        }

        const matchGroup = matchMap.get(matchKey);
        matchGroup.bets.push(bet);
        matchGroup.totalPotentialPayout += parseFloat(bet.potential_reward) || 0;
    });

    // Convert map to array and sort by match name
    return Array.from(matchMap.values()).sort((a, b) =>
        a.matchName.localeCompare(b.matchName)
    );
};

/**
 * Format bet selection for display
 * @param {Object} bet - Bet object
 * @returns {string} Formatted selection string
 */
export const formatBetSelection = (bet) => {
    if (bet.selection === 'DRAW') {
        return 'Draw';
    } else if (bet.selection === 'HOME_WIN' || bet.selection === 'AWAY_WIN') {
        // Extract just the team name from team_name field
        // team_name format: "Arsenal vs Chelsea"
        const teams = bet.team_name?.split(' vs ');
        if (bet.selection === 'HOME_WIN' && teams?.[0]) {
            return `${teams[0]} to Win`;
        } else if (bet.selection === 'AWAY_WIN' && teams?.[1]) {
            return `${teams[1]} to Win`;
        }
    }
    // Fallback: capitalize the selection
    return bet.selection?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
};
