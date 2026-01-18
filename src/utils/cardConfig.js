/**
 * Card Configuration System
 * 
 * Maps card IDs to their display properties (rarity, role, label)
 * Replaces hardcoded assetUrl with dynamic CSS/SVG rendering
 */

export const CARD_CONFIG = {
    c_match_result: {
        id: 'c_match_result',
        label: 'Match Result',
        rarity: 'rare',
        role: 'match_result'
    },
    c_total_goals: {
        id: 'c_total_goals',
        label: 'Total Goals',
        rarity: 'common',
        role: 'total_goals'
    },
    c_player_score: {
        id: 'c_player_score',
        label: 'Player Score',
        rarity: 'legendary',
        role: 'player_score'
    },
    c_supersub: {
        id: 'c_supersub',
        label: 'Super Sub',
        rarity: 'legendary',
        role: 'supersub'
    }
};

/**
 * Get card configuration by ID
 * 
 * @param {string} cardId - Card identifier (e.g., 'c_match_result')
 * @returns {object} - Card config with rarity, role, label
 */
export const getCardConfig = (cardId) => {
    return CARD_CONFIG[cardId] || {
        id: cardId,
        label: 'Unknown Card',
        rarity: 'common',
        role: 'match_result'
    };
};

/**
 * Convert legacy card type array to new format
 * 
 * @param {Array} cardTypes - Legacy array with img property
 * @returns {Array} - New array with rarity and role
 */
export const convertLegacyCardTypes = (cardTypes) => {
    return cardTypes.map(card => ({
        ...card,
        ...getCardConfig(card.id)
    }));
};
