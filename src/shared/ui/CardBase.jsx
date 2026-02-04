import React from 'react';

// ============================================================================
// ASSET MAPPING (WebP)
// ============================================================================
const FRAME_SRC = '/assets/cards/frame-standard.webp';

const ICONS = {
  c_match_result: '/assets/cards/icon-matchresult.webp',
  c_total_goals: '/assets/cards/icon-totalgoals.webp',
  c_player_score: '/assets/cards/icon-playertoscore.webp',
  c_supersub: '/assets/cards/icon-supersub.webp',
};

// ============================================================================
// COMPONENT
// ============================================================================
export default function CardBase({
  type,
  label,
  selection,
  status = 'generic',
  onClick,
  className = ''
}) {

  const iconSrc = ICONS[type] || ICONS.c_supersub;
  const isGeneric = status === 'generic';

  // Dynamic Selection Text Logic
  let displaySelection = selection;

  // Total Goals Exception: "Over 2.5" → "3 or More Goals"
  if (type === 'c_total_goals' && selection === 'Over 2.5') {
    displaySelection = '3 or More Goals';
  }

  // Goalscorer Exception: "[Name]" → "[Name] to Score"
  if (type === 'c_player_score' && selection && !selection.includes('to Score')) {
    displaySelection = `${selection} to Score`;
  }

  // 4-State Glow Logic (Applied to Root Container)
  let glowClass = ''; // State 0 (Inventory): No glow
  if (status === 'pending' || status === 'active') {
    glowClass = 'shadow-[0_0_20px_rgba(234,179,8,0.5)]';
  } else if (status === 'won') {
    glowClass = 'shadow-[0_0_20px_rgba(34,197,94,0.5)]';
  } else if (status === 'lost') {
    glowClass = 'shadow-[0_0_20px_rgba(220,38,38,0.5)]';
  }

  return (
    <div
      onClick={onClick}
      className={`relative aspect-[2/3] w-full overflow-hidden cursor-pointer active:scale-95 transition-transform duration-200 select-none ${glowClass} ${className}`}
    >

      {/* LAYER 1: Background Frame */}
      <img
        src={FRAME_SRC}
        alt="Card Frame"
        className="absolute inset-0 w-full h-full object-cover z-0"
      />

      {/* LAYER 2: Content Container */}
      <div className="absolute inset-0 z-10 flex flex-col">

        {/* BADGES (Top) - Only for Active/Won/Lost, hidden in Generic/Pending */}
        {status === 'active' && (
          <div className="absolute top-[-4px] left-1/2 -translate-x-1/2 z-20 bg-yellow-500 text-black text-[7px] font-black uppercase px-2 py-0.5 rounded shadow-md animate-pulse">
            LIVE
          </div>
        )}
        {status === 'won' && (
          <div className="absolute top-[-4px] left-1/2 -translate-x-1/2 z-20 bg-green-600 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded shadow-md border border-green-400">
            WON
          </div>
        )}
        {status === 'lost' && (
          <div className="absolute top-[-4px] left-1/2 -translate-x-1/2 z-20 bg-zinc-800 text-red-500 text-[7px] font-black uppercase px-2 py-0.5 rounded shadow-md border border-red-900">
            LOST
          </div>
        )}

        {/* ICON AREA - Centered and shifted upward for balanced spacing */}
        <div className="flex-1 flex items-center justify-center px-4 pb-6">
          <img
            src={iconSrc}
            alt={type}
            className="w-[75%] h-auto object-contain drop-shadow-md"
          />
        </div>

        {/* SELECTION TEXT - Only for States 1, 2, 3 (Pending, Active, Settled) */}
        {!isGeneric && displaySelection && (
          <div className="absolute bottom-[22%] left-1/2 -translate-x-1/2 w-[85%] text-center">
            <span className="text-[9px] font-black uppercase text-white leading-none break-words">
              {displaySelection}
            </span>
          </div>
        )}

        {/* LABEL SLOT (Bottom) - Only for State 0 (Generic) */}
        {isGeneric && label && (
          <div className="absolute bottom-[14%] left-0 right-0 text-center">
            <span className="text-[9px] font-black uppercase text-zinc-400 tracking-[0.2em]">
              {label}
            </span>
          </div>
        )}

      </div>
    </div>
  );
}