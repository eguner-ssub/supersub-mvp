import React from 'react';

// ============================================================================
// 1. CONFIGURATION & ASSETS
// ============================================================================

// CONFIG: Point to your new .webp files
const FRAME_SRC = '/assets/cards/frame-standard.webp';

// CONFIG: Icon size (Keep at 68-70% to feel premium)
const ICON_SIZE = "w-[68%] h-[68%]";

const ICONS = {
  c_match_result: '/assets/cards/icon-matchresult.webp',
  c_total_goals: '/assets/cards/icon-totalgoals.webp',
  c_player_score: '/assets/cards/icon-playertoscore.webp',
  c_supersub: '/assets/cards/icon-supersub.webp',
  default: '/assets/cards/icon-supersub.webp',
};

// ============================================================================
// 2. COMPONENT
// ============================================================================

export default function CardBase({
  type,
  label,
  selection,
  status = 'generic',
  onClick,
  className = ''
}) {

  // COLOR GRADING ENGINE
  const stateFilters = {
    // Inventory: Bright polished silver
    generic: "grayscale-[1] brightness-125 contrast-110",

    // Live: Amber Gold
    active: "sepia-[1] hue-rotate-[10deg] saturate-[3] drop-shadow-[0_0_15px_rgba(251,191,36,0.6)] brightness-110",

    // Won: Toxic Green
    won: "sepia-[1] hue-rotate-[80deg] saturate-[4] drop-shadow-[0_0_20px_rgba(57,255,20,0.8)] brightness-125",

    // Lost: Deep Red
    lost: "sepia-[1] hue-rotate-[310deg] saturate-[6] brightness-90 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)] contrast-125",
  };

  const isMerged = !!selection;
  const iconSrc = ICONS[type] || ICONS.default;
  const currentFilter = stateFilters[status] || stateFilters.generic;

  return (
    <div
      onClick={onClick}
      className={`relative w-full aspect-[9/16] group cursor-pointer active:scale-95 transition-transform duration-200 select-none ${className}`}
    >

      {/* LAYER 0: THE CHASSIS (Background) */}
      <img
        src={FRAME_SRC}
        alt="Frame"
        className="absolute inset-0 w-full h-full object-contain z-0 pointer-events-none drop-shadow-xl"
        onError={(e) => console.error("FRAME MISSING:", e.target.src)}
      />

      {/* LAYER 1: THE ICON (Foreground) */}
      {/* ADDED pb-10: Pushes the icon UP to make room for the text below it */}
      <div className="absolute inset-0 flex items-center justify-center z-10 pb-10">
        <img
          src={iconSrc}
          alt={type}
          className={`
            ${ICON_SIZE} object-contain transition-all duration-700 ease-out
            ${currentFilter} 
            ${isMerged ? 'scale-110 opacity-40 blur-[2px]' : 'scale-100 opacity-100'}
          `}
        />
      </div>

      {/* LAYER 2: GENERIC LABEL (Inventory State) */}
      {/* CHANGED bottom-[14%] -> bottom-[18%]: Lifts text OFF the metal frame and into the void */}
      {!isMerged && (
        <div className="absolute bottom-[18%] w-full text-center z-20 px-4 flex flex-col items-center">
          {/* HUD LINE: A subtle separator line above the text */}
          <div className="w-8 h-[1px] bg-white/20 mb-1" />

          <span className="block text-[8px] sm:text-[9px] font-black text-white/60 uppercase tracking-[0.2em] drop-shadow-md">
            {label || 'TACTIC'}
          </span>
        </div>
      )}

      {/* LAYER 3: MERGED DATA (Played State) */}
      {isMerged && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-30 p-2 text-center bg-black/40 backdrop-blur-[1px] rounded-[15%] m-[4px]">

          <div className="animate-in zoom-in fade-in duration-300 slide-in-from-bottom-2 mt-2 w-full px-1">

            <h3 className="text-white font-black italic uppercase text-[10px] sm:text-[11px] leading-tight drop-shadow-lg break-words w-full line-clamp-3">
              {selection}
            </h3>

            <p className="text-[7px] font-mono text-yellow-400 uppercase tracking-widest mt-1.5 border-b border-yellow-500/50 pb-0.5 inline-block opacity-80">
              {label}
            </p>
          </div>

          {/* Status Badge */}
          {status !== 'generic' && (
            <div className={`
               absolute top-[14%] right-[12%] px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-wider
               ${status === 'active' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 animate-pulse' : ''}
               ${status === 'won' ? 'bg-green-500/20 text-green-400 border border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.4)]' : ''}
               ${status === 'lost' ? 'bg-red-500/20 text-red-500 border border-red-500/50 shadow-[0_0_8px_rgba(220,38,38,0.5)]' : ''}
             `}>
              {status === 'active' ? 'LIVE' : status}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
