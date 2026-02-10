import React from 'react';

// ============================================================================
// ASSET & CONTENT MAPS
// ============================================================================
const BASE_MAP = {
  c_match_result: '/assets/cards/base-purple.webp',
  c_total_goals: '/assets/cards/base-green.webp',
  c_player_score: '/assets/cards/base-bronze.webp',
  c_supersub: '/assets/cards/base-silver.webp',
};

const ICON_MAP = {
  c_match_result: '/assets/cards/icon-matchresult.webp',
  c_total_goals: '/assets/cards/icon-totalgoals.webp',
  c_player_score: '/assets/cards/icon-playertoscore.webp',
  c_supersub: '/assets/cards/icon-supersub.webp',
};

const LABEL_MAP = {
  c_match_result: 'MATCH RESULT',
  c_total_goals: 'TOTAL GOALS',
  c_player_score: 'PLAYER SCORE',
  c_supersub: 'SUPER SUB',
};

// ============================================================================
// COMPONENT
// ============================================================================
export default function CardBase({
  type,
  selection,
  status = 'generic',
  onClick,
  className = ''
}) {

  // 1. Asset Logic
  const bgSrc = BASE_MAP[type] || BASE_MAP.c_supersub;
  const iconSrc = ICON_MAP[type] || ICON_MAP.c_supersub;
  const title = LABEL_MAP[type] || 'SUPER SUB';
  const isGeneric = status === 'generic';

  // Dynamic Selection Text Logic
  let displaySelection = selection;
  if (type === 'c_total_goals' && selection === 'Over 2.5') {
    displaySelection = '3 or More Goals';
  }
  if (type === 'c_player_score' && selection && !selection.includes('to Score')) {
    displaySelection = `${selection} to Score`;
  }

  // Docking Underglow
  let glowClass = '';
  if (status === 'active') {
    glowClass = 'shadow-[0_10px_20px_-5px_rgba(57,255,20,0.5)]';
  } else if (status === 'pending') {
    glowClass = 'shadow-[0_10px_20px_-5px_rgba(251,191,36,0.5)]';
  } else if (status === 'won') {
    glowClass = 'shadow-[0_10px_20px_-5px_rgba(34,197,94,0.5)]';
  } else if (status === 'lost') {
    glowClass = 'shadow-[0_10px_20px_-5px_rgba(220,38,38,0.5)]';
  }

  return (
    <div
      onClick={onClick}
      className={`group relative w-[4.5rem] h-[6.75rem] overflow-hidden cursor-pointer active:scale-95 transition-transform duration-200 select-none rounded-lg ${glowClass} ${className}`}
    >

      {/* Z-0: Base Image (Pre-rendered frame + anodized plate) */}
      <img
        src={bgSrc}
        alt="Card Base"
        className="absolute inset-0 w-full h-full object-cover z-0"
      />

      {/* LAYER 1: Content Overlay */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pb-2 pt-3 px-1">

        {/* Badges */}
        {status === 'active' && (
          <div className="absolute top-[-4px] left-1/2 -translate-x-1/2 z-30 bg-yellow-500 text-black text-[6px] font-black uppercase px-1.5 py-0.5 rounded shadow-md animate-pulse">
            LIVE
          </div>
        )}
        {status === 'won' && (
          <div className="absolute top-[-4px] left-1/2 -translate-x-1/2 z-30 bg-green-600 text-white text-[6px] font-black uppercase px-1.5 py-0.5 rounded shadow-md border border-green-400">
            WON
          </div>
        )}
        {status === 'lost' && (
          <div className="absolute top-[-4px] left-1/2 -translate-x-1/2 z-30 bg-zinc-800 text-red-500 text-[6px] font-black uppercase px-1.5 py-0.5 rounded shadow-md border border-red-900">
            LOST
          </div>
        )}

        {/* Icon with Backlight */}
        <div className="relative flex items-center justify-center mb-1">
          {/* Radial backlight glow */}
          <div className="absolute w-12 h-12 bg-white/20 blur-xl rounded-full z-0" />
          {/* Chrome-polished icon */}
          <img
            src={iconSrc}
            alt="icon"
            className="relative z-10 w-[65%] h-auto object-contain brightness-125 contrast-[1.1] drop-shadow-[0_4px_3px_rgba(0,0,0,0.6)]"
          />
        </div>

        {/* Card Type Label — Single source of truth, always visible */}
        <span
          className="font-black text-[8px] leading-tight text-white/90 uppercase tracking-widest text-center"
          style={{ fontFamily: "'Roboto Condensed', 'Inter', 'Impact', 'Arial Black', sans-serif" }}
        >
          {title}
        </span>

        {/* Selection Text — Pending / Active / Settled */}
        {!isGeneric && displaySelection && (
          <div className="absolute bottom-[18%] left-1/2 -translate-x-1/2 w-[90%] text-center">
            <span className="text-[7px] font-black uppercase text-white leading-none break-words drop-shadow-md">
              {displaySelection}
            </span>
          </div>
        )}

      </div>

      {/* LAYER 2: Hover Highlight */}
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors z-20 rounded-lg" />

    </div>
  );
}