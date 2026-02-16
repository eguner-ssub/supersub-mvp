import React from 'react';

// ============================================================================
// ASSET & CONTENT MAPS — Matchday Programme Design System
// ============================================================================
const BASE_MAP = {
  c_match_result: '/assets/matchresult_cardbase.webp',
  c_total_goals: '/assets/totalgoals_cardbase.webp',
  c_player_score: '/assets/playerscore_cardbase.webp',
  c_supersub: '/assets/supersub_cardbase.webp',
};

const ICON_MAP = {
  c_match_result: '/assets/stadium_icon.webp',
  c_total_goals: '/assets/goal_icon.webp',
  c_player_score: '/assets/player_icon.webp',
  c_supersub: '/assets/supersub_icon.webp',
};

const LABEL_MAP = {
  c_match_result: 'MATCH RESULT',
  c_total_goals: 'TOTAL GOALS',
  c_player_score: 'PLAYER SCORE',
  c_supersub: 'SUPER SUB',
};

// Footer bar accent colours per card type
const FOOTER_COLOR_MAP = {
  c_match_result: 'bg-purple-700',
  c_total_goals: 'bg-emerald-700',
  c_player_score: 'bg-amber-700',
  c_supersub: 'bg-slate-600',
};

// ============================================================================
// COMPONENT
// ============================================================================
export default function CardBase({
  type,
  selection,
  status = 'generic',
  matchData,
  onClick,
  className = '',
}) {
  // ---- Asset Resolution ----
  const bgSrc = BASE_MAP[type] || BASE_MAP.c_supersub;
  const iconSrc = ICON_MAP[type] || ICON_MAP.c_supersub;
  const title = LABEL_MAP[type] || 'SUPER SUB';
  const footerColor = FOOTER_COLOR_MAP[type] || 'bg-slate-600';
  const isGeneric = status === 'generic';

  // ---- Dynamic Selection Text ----
  let displaySelection = selection;
  if (type === 'c_total_goals' && selection === 'Over 2.5') {
    displaySelection = '3 or More Goals';
  }
  if (type === 'c_player_score' && selection && !selection.includes('to Score')) {
    displaySelection = `${selection} to Score`;
  }

  // ---- Match Metadata (Played State only) ----
  const matchDate = matchData?.date || '';
  const matchDay = matchData?.day || '';
  const homeTeam = matchData?.homeTeam || '';
  const awayTeam = matchData?.awayTeam || '';
  const matchName = homeTeam && awayTeam ? `${homeTeam} – ${awayTeam}` : '';

  // ---- Softened Underglow for Docking ----
  let glowClass = '';
  if (status === 'active') {
    glowClass = 'shadow-[0_8px_20px_-6px_rgba(57,255,20,0.25)]';
  } else if (status === 'pending') {
    glowClass = 'shadow-[0_8px_20px_-6px_rgba(251,191,36,0.25)]';
  } else if (status === 'won') {
    glowClass = 'shadow-[0_8px_20px_-6px_rgba(34,197,94,0.25)]';
  } else if (status === 'lost') {
    glowClass = 'shadow-[0_8px_20px_-6px_rgba(220,38,38,0.25)]';
  }

  return (
    <div
      onClick={onClick}
      className={`group relative w-[6.5rem] h-[10rem] overflow-hidden cursor-pointer active:scale-95 transition-transform duration-200 select-none rounded-lg ${glowClass} ${className}`}
    >
      {/* ========== Z-0: Paper-Texture Base ========== */}
      <img
        src={bgSrc}
        alt="Card Base"
        className="absolute inset-0 w-full h-full object-cover z-0"
        draggable={false}
      />

      {/* ========== Z-10: Content Layer ========== */}
      <div className="absolute inset-0 z-10 flex flex-col">

        {/* ───── DEFAULT STATE ───── */}
        {isGeneric && (
          <div className="flex-1 flex flex-col items-center justify-center px-1 pb-2">
            {/* Photo-print icon — printed on paper grain */}
            <img
              src={iconSrc}
              alt="icon"
              className="w-[85%] h-auto object-contain"
              style={{ mixBlendMode: 'multiply', opacity: 0.95 }}
              draggable={false}
            />
            {/* Label — Montserrat Bold, ink-black */}
            <span
              className="mt-1.5 text-[10px] leading-tight uppercase tracking-widest text-center"
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                color: '#121212',
              }}
            >
              {title}
            </span>
          </div>
        )}

        {/* ───── PLAYED STATE ───── */}
        {!isGeneric && (
          <>
            {/* Top-Left — Date / Day + Match Name */}
            <div className="px-1.5 pt-1.5">
              {matchDate && (
                <p
                  className="text-[8px] leading-tight uppercase tracking-wide"
                  style={{
                    fontFamily: "'Montserrat', 'JetBrains Mono', monospace",
                    fontWeight: 700,
                    color: '#121212',
                  }}
                >
                  {matchDate} · {matchDay}
                </p>
              )}
              {matchName && (
                <p
                  className="text-[8px] leading-tight mt-0.5 truncate"
                  style={{
                    fontFamily: "'Montserrat', 'JetBrains Mono', monospace",
                    fontWeight: 700,
                    color: '#121212',
                  }}
                >
                  {matchName}
                </p>
              )}
            </div>

            {/* Center — Icon (dimmed) + Prediction Text */}
            <div className="flex-1 flex flex-col items-center justify-center px-1">
              {/* Background icon — very subtle, printed look */}
              <img
                src={iconSrc}
                alt="icon"
                className="w-[40%] h-auto object-contain opacity-30"
                style={{ mixBlendMode: 'multiply' }}
                draggable={false}
              />
              {/* Prediction / Selection — large, prominent */}
              {displaySelection && (
                <span
                  className="mt-1 text-[11px] leading-tight uppercase text-center break-words max-w-full"
                  style={{
                    fontFamily: "'Inter', 'Roboto Condensed', sans-serif",
                    fontWeight: 900,
                    color: '#121212',
                  }}
                >
                  {displaySelection}
                </span>
              )}
            </div>

            {/* Footer Bar — Card Type Label */}
            <div className={`${footerColor} py-1 px-1.5 flex items-center justify-center`}>
              <span
                className="text-[9px] leading-none uppercase tracking-widest text-white text-center"
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 700,
                }}
              >
                {title}
              </span>
            </div>
          </>
        )}
      </div>

      {/* ========== Z-30: Badges — "Official Print" Stamps (top-right) ========== */}
      {status === 'active' && (
        <div
          className="absolute top-1.5 right-1.5 z-30 bg-yellow-400 text-[6px] font-black uppercase px-1.5 py-[2px] rounded-sm border border-yellow-600 animate-pulse"
          style={{
            fontFamily: "'Montserrat', sans-serif",
            color: '#121212',
            letterSpacing: '0.05em',
          }}
        >
          LIVE
        </div>
      )}
      {status === 'won' && (
        <div
          className="absolute top-1.5 right-1.5 z-30 bg-green-100 text-[6px] font-black uppercase px-1.5 py-[2px] rounded-sm border-2 border-green-700"
          style={{
            fontFamily: "'Montserrat', sans-serif",
            color: '#166534',
            letterSpacing: '0.05em',
          }}
        >
          WON
        </div>
      )}
      {status === 'lost' && (
        <div
          className="absolute top-1.5 right-1.5 z-30 bg-red-100 text-[6px] font-black uppercase px-1.5 py-[2px] rounded-sm border-2 border-red-700"
          style={{
            fontFamily: "'Montserrat', sans-serif",
            color: '#991b1b',
            letterSpacing: '0.05em',
          }}
        >
          LOST
        </div>
      )}

      {/* ========== Z-20: Hover Highlight ========== */}
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors z-20 rounded-lg pointer-events-none" />
    </div>
  );
}