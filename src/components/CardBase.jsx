import React from 'react';
import { 
  Target, 
  Flame, 
  User, 
  Zap 
} from 'lucide-react';

/**
 * CardBase - Pure CSS/SVG Card Component
 * 
 * Composite Pattern Implementation:
 * - Template: Tailwind-based frame with gradients, borders, shadows
 * - Icon: Lucide-React SVG based on role
 * - Rarity: Dynamic color tokens (Gray, Blue, Gold)
 * 
 * @param {string} rarity - 'common' | 'rare' | 'legendary'
 * @param {string} role - 'match_result' | 'total_goals' | 'player_score' | 'supersub'
 * @param {string} label - Display name for the card
 * @param {string} className - Additional Tailwind classes
 */
const CardBase = ({ 
  rarity = 'common', 
  role = 'match_result', 
  label = 'Card',
  className = ''
}) => {
  // Get rarity-based styles
  const styles = getCardStyles(rarity);
  
  // Get role-based icon
  const Icon = getRoleIcon(role);

  return (
    <div 
      className={`
        relative aspect-[3/4] rounded-lg overflow-hidden
        ${styles.border} ${styles.shadow} ${styles.bg}
        transition-all duration-300
        ${className}
      `}
    >
      {/* Gradient Overlay */}
      <div className={`absolute inset-0 ${styles.gradient} opacity-80`} />
      
      {/* Metallic Shine Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-40" />
      
      {/* Border Accent */}
      <div className={`absolute inset-0 ${styles.borderAccent} rounded-lg`} />
      
      {/* Content Container */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center p-3">
        {/* Icon Container */}
        <div className={`
          w-16 h-16 rounded-full flex items-center justify-center mb-3
          ${styles.iconBg} ${styles.iconShadow}
          backdrop-blur-sm
        `}>
          <Icon className={`w-10 h-10 ${styles.iconColor}`} strokeWidth={2.5} />
        </div>
        
        {/* Label */}
        <div className={`
          text-center px-2 py-1 rounded-md
          ${styles.labelBg} backdrop-blur-sm
        `}>
          <p className={`
            text-xs font-black uppercase tracking-wider
            ${styles.labelColor} drop-shadow-lg
          `}>
            {label}
          </p>
        </div>
        
        {/* Rarity Indicator */}
        <div className="absolute top-2 right-2">
          <div className={`
            w-2 h-2 rounded-full ${styles.rarityDot}
            shadow-[0_0_8px_currentColor]
          `} />
        </div>
      </div>
      
      {/* Scan Line Effect (Cinematic Touch) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className={`
          absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-transparent
          animate-pulse opacity-30
        `} />
      </div>
    </div>
  );
};

/**
 * Get Tailwind classes based on rarity tier
 * 
 * @param {string} rarity - 'common' | 'rare' | 'legendary'
 * @returns {object} - Tailwind class strings for each style element
 */
export const getCardStyles = (rarity) => {
  const styleMap = {
    common: {
      // Gray theme
      border: 'border-2 border-gray-500/50',
      borderAccent: 'border-2 border-gray-400/30',
      shadow: 'shadow-[0_0_15px_rgba(107,114,128,0.3)]',
      bg: 'bg-gray-800/90',
      gradient: 'bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900',
      iconBg: 'bg-gray-700/60',
      iconShadow: 'shadow-[0_0_15px_rgba(107,114,128,0.4)]',
      iconColor: 'text-gray-300',
      labelBg: 'bg-gray-900/70',
      labelColor: 'text-gray-200',
      rarityDot: 'bg-gray-400'
    },
    rare: {
      // Blue theme
      border: 'border-2 border-blue-500/60',
      borderAccent: 'border-2 border-blue-400/40',
      shadow: 'shadow-[0_0_20px_rgba(59,130,246,0.4)]',
      bg: 'bg-blue-900/90',
      gradient: 'bg-gradient-to-br from-blue-700 via-blue-800 to-blue-950',
      iconBg: 'bg-blue-700/60',
      iconShadow: 'shadow-[0_0_20px_rgba(59,130,246,0.5)]',
      iconColor: 'text-blue-300',
      labelBg: 'bg-blue-950/70',
      labelColor: 'text-blue-100',
      rarityDot: 'bg-blue-400'
    },
    legendary: {
      // Gold theme
      border: 'border-2 border-yellow-500/70',
      borderAccent: 'border-2 border-yellow-400/50',
      shadow: 'shadow-[0_0_25px_rgba(234,179,8,0.5)]',
      bg: 'bg-yellow-900/90',
      gradient: 'bg-gradient-to-br from-yellow-600 via-yellow-800 to-yellow-950',
      iconBg: 'bg-yellow-700/60',
      iconShadow: 'shadow-[0_0_25px_rgba(234,179,8,0.6)]',
      iconColor: 'text-yellow-300',
      labelBg: 'bg-yellow-950/70',
      labelColor: 'text-yellow-100',
      rarityDot: 'bg-yellow-400'
    }
  };

  return styleMap[rarity] || styleMap.common;
};

/**
 * Get Lucide icon component based on role
 * 
 * @param {string} role - Card role identifier
 * @returns {React.Component} - Lucide icon component
 */
export const getRoleIcon = (role) => {
  const iconMap = {
    match_result: Target,
    total_goals: Flame,
    player_score: User,
    supersub: Zap
  };

  return iconMap[role] || Target;
};

export default CardBase;
