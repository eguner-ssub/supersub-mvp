import React from 'react';
import { getIconForType, getVisualConfig, CARD_STATES } from '../utils/cardConfig';

/**
 * CardBase - Living Component for SuperSub Betting Cards
 * 
 * Architecture:
 * - DOM Stability: No conditional rendering - all elements always present
 * - State-Driven: Visual changes handled purely through CSS class swaps
 * - Config-Driven: All styling comes from VISUAL_CONFIG in cardConfig.js
 * 
 * State Flow: DEFAULT → SELECTED → PENDING → WON/LOST
 * 
 * @param {string} type - Card type from CARD_TYPES (determines icon)
 * @param {string} state - Card state from CARD_STATES (determines styling)
 * @param {string} backgroundImage - URL for the background template asset
 * @param {string} label - Primary text (e.g., "Match Result")
 * @param {string} subLabel - Secondary text (e.g., "Home Win")
 * @param {function} onClick - Click handler for betting interaction
 */
const CardBase = ({
  type,
  state = CARD_STATES.DEFAULT,
  backgroundImage,
  label,
  subLabel,
  onClick
}) => {
  // Get configuration based on current state
  const visualConfig = getVisualConfig(state);
  const IconComponent = getIconForType(type);

  return (
    <div
      className={`
        relative overflow-hidden rounded-lg cursor-pointer
        transition-all duration-300 ease-in-out
        ${visualConfig.wrapper}
      `}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`${label} - ${subLabel || 'No selection'} card`}
    >
      {/* Layer 0: Background Image */}
      <img
        src={backgroundImage}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        aria-hidden="true"
      />

      {/* Layer 1: Gradient Overlay (ensures text readability) */}
      <div
        className={`
          absolute inset-0 transition-all duration-300
          ${visualConfig.overlay}
        `}
        aria-hidden="true"
      />

      {/* Layer 2: Content Stack */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full p-4 space-y-3">
        {/* Icon Container */}
        <div
          className={`
            w-16 h-16 flex items-center justify-center
            transition-all duration-300
          `}
        >
          <IconComponent
            className={`
              w-12 h-12 transition-all duration-300
              ${visualConfig.icon}
            `}
            strokeWidth={2.5}
            aria-hidden="true"
          />
        </div>

        {/* Label */}
        <div className="text-center space-y-1">
          <p className="text-sm font-bold text-white drop-shadow-lg uppercase tracking-wide">
            {label}
          </p>
          {subLabel && (
            <p className="text-xs font-medium text-gray-200 drop-shadow-md">
              {subLabel}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CardBase;
