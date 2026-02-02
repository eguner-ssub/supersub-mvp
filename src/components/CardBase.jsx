import React from 'react';

// ============================================================================
// 1. CONFIGURATION
// ============================================================================
// We keep these for later, but we will add a CSS fallback if they fail/missing.
const FRAME_SRC = '/assets/cards/frame-standard.webp';

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

  const isMerged = !!selection;
  const iconSrc = ICONS[type] || ICONS.default;

  // CSS Fallback Styles (Use these if you don't have the .webp frame)
  const activeGradient = "bg-gradient-to-b from-neutral-800 via-neutral-900 to-black";
  const goldBorder = status === 'active' ? "border-2 border-yellow-600/60 shadow-[0_0_15px_rgba(234,179,8,0.2)]" : "border border-white/10";

  return (
    <div
      onClick={onClick}
      // Added 'activeGradient' and 'goldBorder' to ensure visibility without images
      className={`relative w-full aspect-[9/16] group cursor-pointer active:scale-95 transition-transform duration-200 select-none rounded-lg overflow-hidden ${activeGradient} ${goldBorder} ${className}`}
    >

      {/* LAYER 0: THE CHASSIS (Background Frame) */}
      {/* We attempt to load the image, but the parent div now has a color too */}
      <img
        src={FRAME_SRC}
        alt="Frame"
        className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none opacity-0" // Hidden for now since we know it's missing
        onError={(e) => e.target.style.display = 'none'}
      />

      {/* LAYER 1: THE ICON (Foreground) */}
      <div className="absolute inset-0 flex items-center justify-center z-10 pb-10">
        {/* If Icon is missing, we show a fallback text circle */}
        {iconSrc ? (
          <img
            src={iconSrc}
            alt={type}
            className={`w-[60%] h-[60%] object-contain transition-all duration-700 ease-out 
                ${isMerged ? 'opacity-20 blur-[1px]' : 'opacity-80'}
            `}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex'; // Show fallback
            }}
          />
        ) : null}

        {/* Fallback Icon (CSS Circle) - Shows if image fails */}
        <div className="hidden w-20 h-20 rounded-full border-2 border-white/10 items-center justify-center bg-white/5">
          <span className="text-2xl">⚽</span>
        </div>
      </div>

      {/* LAYER 2: GENERIC LABEL (Inventory State) */}
      {!isMerged && (
        <div className="absolute bottom-[18%] w-full text-center z-20 px-4 flex flex-col items-center">
          <div className="w-8 h-[1px] bg-white/20 mb-1" />
          <span className="block text-[9px] font-black text-white/60 uppercase tracking-[0.2em]">
            {label || 'TACTIC'}
          </span>
        </div>
      )}

      {/* LAYER 3: MERGED DATA (Played State) */}
      {isMerged && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-30 p-2 text-center">

          {/* Dark Glass Panel behind text */}
          <div className="bg-black/60 backdrop-blur-sm p-3 rounded-xl border border-white/10 w-full max-w-[90%] shadow-lg">

            {/* LIVE BADGE */}
            {status === 'active' && (
              <div className="inline-block px-2 py-0.5 mb-2 rounded text-[8px] font-black uppercase tracking-wider bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 animate-pulse">
                LIVE
              </div>
            )}

            <h3 className="text-white font-black italic uppercase text-lg leading-tight drop-shadow-md break-words w-full">
              {selection}
            </h3>

            <p className="text-[8px] font-mono text-yellow-400/80 uppercase tracking-widest mt-2 border-b border-yellow-500/30 pb-1 inline-block">
              {label}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}