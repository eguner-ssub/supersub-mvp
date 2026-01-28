import React from 'react';

// ASSET MAPPING (Adjust paths if filenames differ)
const ICONS = {
  c_match_result: '/assets/cards/icon-whistle.png',
  c_total_goals: '/assets/cards/icon-net.png',
  c_player_score: '/assets/cards/icon-celebration.png',
  c_supersub: '/assets/cards/icon-supersub.png',
  // Fallback
  default: '/assets/cards/icon-supersub.png',
};

const FRAME_SRC = '/assets/cards/frame-standard.png';

export default function CardBase({ 
  type,          // 'c_match_result', etc.
  label,         // 'Match Result' (Label for generic state)
  selection,     // 'Arsenal to Win' (The specific bet - Triggers MERGED state)
  status = 'generic', // 'generic' | 'active' | 'won' | 'lost'
  onClick,
  className = ''
}) {
  
  // 1. CINEMATIC COLOR GRADING (CSS Filters)
  // We manipulate the Silver Icons to create state colors
  const stateFilters = {
    generic: "grayscale-[0.8] brightness-75 opacity-90", // Cold Steel (Inventory)
    active: "sepia-[1] hue-rotate-[10deg] saturate-[3] drop-shadow-[0_0_15px_rgba(251,191,36,0.6)] brightness-110", // Gold/Amber (Live)
    won: "sepia-[1] hue-rotate-[80deg] saturate-[4] drop-shadow-[0_0_20px_rgba(57,255,20,0.8)] brightness-125", // Toxic Green (Win)
    lost: "sepia-[1] hue-rotate-[320deg] saturate-[2] opacity-50 grayscale-[0.5]", // Dull Red (Loss)
  };

  // 2. MERGED STATE LOGIC
  // If 'selection' exists, the card is "Played" (Merged). 
  // If not, it is "Generic" (Inventory).
  const isMerged = !!selection;
  const iconSrc = ICONS[type] || ICONS.default;
  const currentFilter = stateFilters[status] || stateFilters.generic;

  return (
    <div 
      onClick={onClick}
      className={`relative w-full aspect-[9/16] group cursor-pointer transition-transform duration-200 active:scale-95 ${className}`}
    >
      
      {/* LAYER 0: THE CHASSIS (Static Frame) */}
      <img 
        src={FRAME_SRC} 
        alt="Card Frame" 
        className="absolute inset-0 w-full h-full object-contain z-0 pointer-events-none drop-shadow-2xl" 
      />

      {/* LAYER 1: THE ICON (The Core) */}
      <div className="absolute inset-0 flex items-center justify-center z-10 pb-6 pl-1 pr-1">
        <img 
          src={iconSrc} 
          alt={type}
          className={`
            w-[70%] h-[70%] object-contain transition-all duration-700 ease-out
            ${currentFilter} 
            ${isMerged ? 'scale-110 opacity-40 blur-[1px]' : 'scale-100 opacity-100'}
          `}
        />
      </div>

      {/* LAYER 2: GENERIC LABEL (Inventory State Only) */}
      {!isMerged && (
        <div className="absolute bottom-[12%] w-full text-center z-20 px-2">
          <span className="block text-[8px] sm:text-[10px] font-black text-white/50 uppercase tracking-[0.2em] drop-shadow-md border-t border-white/10 pt-1">
            {label || 'TACTIC'}
          </span>
        </div>
      )}

      {/* LAYER 3: MERGED DATA OVERLAY (Played State Only) */}
      {isMerged && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-30 p-3 text-center bg-black/20">
          
          {/* A. The Selection (Hero Text) */}
          <div className="animate-in zoom-in fade-in duration-300 slide-in-from-bottom-2">
            <h3 className="text-white font-black italic uppercase text-lg leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              {selection}
            </h3>
            
            {/* B. The Type (Subtext) */}
            <p className="text-[8px] font-mono text-yellow-400 uppercase tracking-widest mt-2 border-b border-yellow-500/50 pb-0.5 inline-block">
              {label}
            </p>
          </div>

          {/* C. Status Badge (Won/Lost/Live) */}
          {status !== 'generic' && (
             <div className={`
               absolute top-2 right-2 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider
               ${status === 'active' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 animate-pulse' : ''}
               ${status === 'won' ? 'bg-green-500/20 text-green-400 border border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.4)]' : ''}
               ${status === 'lost' ? 'bg-red-500/20 text-red-500 border border-red-500/50' : ''}
             `}>
               {status === 'active' ? 'LIVE' : status}
             </div>
          )}

        </div>
      )}
      
    </div>
  );
}
