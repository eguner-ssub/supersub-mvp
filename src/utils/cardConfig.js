/**
 * Card Configuration System - Single Source of Truth
 * 
 * This config drives all visual states and type mappings for the CardBase component.
 * It ensures DOM stability by providing consistent class mappings for CSS transitions.
 */

import { Trophy, Target, User, Zap } from 'lucide-react';

// ============================================================================
// CARD TYPES - Determines which icon to display
// ============================================================================
export const CARD_TYPES = {
  MATCH_RESULT: 'MATCH_RESULT',
  TOTAL_GOALS: 'TOTAL_GOALS',
  PLAYER_SCORE: 'PLAYER_SCORE',
  SUPERSUB: 'SUPERSUB'
};

// ============================================================================
// CARD STATES - Determines visual styling and animations
// ============================================================================
export const CARD_STATES = {
  DEFAULT: 'DEFAULT',
  SELECTED: 'SELECTED',
  PENDING: 'PENDING',
  WON: 'WON',
  LOST: 'LOST'
};

// ============================================================================
// TYPE_ICONS - Maps card types to Lucide React icon components
// ============================================================================
export const TYPE_ICONS = {
  [CARD_TYPES.MATCH_RESULT]: Target,
  [CARD_TYPES.TOTAL_GOALS]: Trophy,
  [CARD_TYPES.PLAYER_SCORE]: User,
  [CARD_TYPES.SUPERSUB]: Zap
};

// ============================================================================
// CARD_ASSETS - Maps card types to photorealistic asset paths
// ============================================================================
export const CARD_ASSETS = {
  FRAME: '/assets/cards/frame-standard.webp',
  ICONS: {
    c_match_result: '/assets/cards/icon-matchresult.webp',
    c_total_goals: '/assets/cards/icon-totalgoals.webp',
    c_player_score: '/assets/cards/icon-playertoscore.webp',
    c_supersub: '/assets/cards/icon-supersub.webp',
  }
};


// ============================================================================
// VISUAL_CONFIG - Maps states to Tailwind CSS classes
// ============================================================================
export const VISUAL_CONFIG = {
  [CARD_STATES.DEFAULT]: {
    wrapper: 'border-2 border-gray-600 ring-0 shadow-md',
    icon: 'text-gray-400',
    overlay: 'bg-black/40'
  },

  [CARD_STATES.SELECTED]: {
    wrapper: 'border-2 border-blue-500 ring-2 ring-blue-400/50 shadow-lg shadow-blue-500/30',
    icon: 'text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]',
    overlay: 'bg-black/30'
  },

  [CARD_STATES.PENDING]: {
    wrapper: 'border-2 border-yellow-500 ring-2 ring-yellow-400/50 shadow-lg shadow-yellow-500/30',
    icon: 'text-yellow-400 drop-shadow-[0_0_12px_rgba(234,179,8,0.8)] animate-pulse',
    overlay: 'bg-black/50'
  },

  [CARD_STATES.WON]: {
    wrapper: 'border-2 border-green-500 ring-4 ring-green-400/60 shadow-xl shadow-green-500/50',
    icon: 'text-green-400 drop-shadow-[0_0_16px_rgba(34,197,94,1)]',
    overlay: 'bg-black/20'
  },

  [CARD_STATES.LOST]: {
    wrapper: 'border-2 border-red-500 ring-2 ring-red-400/50 shadow-lg shadow-red-500/30',
    icon: 'text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]',
    overlay: 'bg-black/60'
  }
};

/**
 * Get the icon component for a given card type
 * 
 * @param {string} type - One of CARD_TYPES
 * @returns {React.Component} - Lucide icon component
 */
export const getIconForType = (type) => {
  return TYPE_ICONS[type] || TYPE_ICONS[CARD_TYPES.MATCH_RESULT];
};

/**
 * Get visual configuration for a given state
 * 
 * @param {string} state - One of CARD_STATES
 * @returns {object} - Visual config with wrapper, icon, and overlay classes
 */
export const getVisualConfig = (state) => {
  return VISUAL_CONFIG[state] || VISUAL_CONFIG[CARD_STATES.DEFAULT];
};

// ============================================================================
// LEGACY SUPPORT - Backward compatibility with old rarity/role system
// ============================================================================

/**
 * Legacy card configuration mapping (for backward compatibility)
 * Maps card IDs to their rarity and role properties
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
 * Get card configuration by ID (legacy function for backward compatibility)
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
 * Convert legacy card type array to new format (legacy helper)
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

