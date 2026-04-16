import React, { useState } from 'react';
import { ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * JosebaBubble — reusable Joseba analyst message overlay.
 * Fixed at the bottom of the screen at z-[400], above all navigation.
 * Tap anywhere to advance. Never auto-advances.
 *
 * variant="large"   — stacked layout: avatar centred at top, text below.
 *                     Used for office_intro and SimulationMatchHub where the
 *                     message is the primary focus of the screen.
 *
 * variant="compact" — single-row layout: avatar left, text right (default).
 *                     Used inside SimulationMatchDetail and StarterPackReveal
 *                     where the bubble shares the screen with other content.
 */
const JosebaBubble = ({
  message,
  onAdvance,
  avatarSrc = '/assets/joseba-avatar.webp',
  label = 'JOSEBA',
  variant = 'compact',
}) => {
  const safeAreaStyle = {
    background: 'rgba(0, 0, 0, 0.92)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderTop: '1px solid rgba(16, 185, 129, 0.2)',
    borderRadius: '20px 20px 0 0',
  };

  if (variant === 'large') {
    return (
      <div
        onClick={onAdvance}
        className="fixed bottom-0 left-0 right-0 z-[400] cursor-pointer select-none animate-in slide-in-from-bottom-4 duration-300"
        style={{
          ...safeAreaStyle,
          padding: `20px 24px calc(env(safe-area-inset-bottom, 0px) + 24px)`,
        }}
      >
        <div className="flex flex-col items-center gap-3">
          {/* Large centred avatar */}
          <img
            src={avatarSrc}
            alt={label}
            className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500/30 shadow-lg"
            onError={(e) => { e.target.src = '/assets/assistant-head.png'; }}
          />
          <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400">
            {label}
          </span>
          <div className="h-[105px] flex flex-col justify-center">
            <p className="text-[12px] font-bold text-white/90 leading-relaxed text-center">
              {message}
            </p>
          </div>
          <div className="flex items-center gap-1 mt-1 opacity-40">
            <span className="text-[9px] font-black uppercase tracking-widest text-white">tap to continue</span>
            <ChevronRight className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
      </div>
    );
  }

  /* ── warm — light parchment background for Training briefing ── */
  if (variant === 'warm') {
    const warmStyle = {
      background: '#F5F0E8',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderTop: '1px solid rgba(16, 185, 129, 0.3)',
      borderRadius: '20px 20px 0 0',
      padding: `14px 16px calc(env(safe-area-inset-bottom, 0px) + 20px)`,
    };
    return (
      <div
        onClick={onAdvance}
        className="fixed bottom-0 left-0 right-0 z-[400] cursor-pointer select-none animate-in slide-in-from-bottom-4 duration-300"
        style={warmStyle}
      >
        <div className="flex items-start gap-3">
          <img
            src={avatarSrc}
            alt={label}
            className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-zinc-300"
            onError={(e) => { e.target.src = '/assets/assistant-head.png'; }}
          />
          <div className="flex-1 min-w-0">
            <span className="block text-[8px] font-black uppercase tracking-widest text-emerald-700 mb-1">
              {label}
            </span>
            <p className="text-xs font-bold text-zinc-900 leading-relaxed">
              {message}
            </p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0 mt-0.5" />
        </div>
        <div className="flex items-center justify-end gap-1 pt-2">
          <span className="text-zinc-500 text-xs font-black uppercase tracking-widest">TAP TO CONTINUE</span>
          <ChevronRight className="w-4 h-4 text-zinc-500 animate-pulse" />
        </div>
      </div>
    );
  }

  /* ── compact / compact-warm ───────────────────────────────── */
  const isWarm = variant === 'compact-warm';
  const compactWarmStyle = {
    background: '#F5F0E8',
    borderTop: '1px solid #E5DFD5',
    borderRadius: '20px 20px 0 0',
  };
  const CompactBubble = () => {
    const [expanded, setExpanded] = useState(false);
    return (
      <div
        onClick={onAdvance}
        className="fixed bottom-0 left-0 right-0 z-[400] cursor-pointer select-none animate-in slide-in-from-bottom-4 duration-300"
        style={{
          ...(isWarm ? compactWarmStyle : safeAreaStyle),
          padding: `14px 16px calc(env(safe-area-inset-bottom, 0px) + 20px)`,
        }}
      >
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <img
            src={avatarSrc}
            alt={label}
            className={`w-8 h-8 rounded-full object-cover flex-shrink-0 ${isWarm ? 'border border-[#E5DFD5]' : 'border border-white/10'}`}
            onError={(e) => { e.target.src = '/assets/assistant-head.png'; }}
          />

          {/* Text */}
          <div className="flex-1 min-w-0">
            <span className={`block text-[8px] font-black uppercase tracking-widest mb-1 ${isWarm ? 'text-emerald-700' : 'text-emerald-400'}`}>
              {label}
            </span>
            <p className={`text-xs font-bold leading-relaxed ${expanded ? '' : 'line-clamp-4'} ${isWarm ? 'text-zinc-800' : 'text-white/90'}`}>
              {message}
            </p>
          </div>

          {/* Expand toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(x => !x); }}
            className={`p-1 flex-shrink-0 mt-0.5 ${isWarm ? 'text-zinc-400' : 'text-white/40'}`}
          >
            {expanded
              ? <ChevronUp className="w-3.5 h-3.5" />
              : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Tap indicator */}
        <div className="flex items-center justify-end gap-1 pt-2">
          <span className={`text-xs font-black uppercase tracking-widest ${isWarm ? 'text-zinc-600' : 'text-white/70'}`}>TAP TO CONTINUE</span>
          <ChevronRight className={`w-4 h-4 animate-pulse ${isWarm ? 'text-zinc-600' : 'text-white/70'}`} />
        </div>
      </div>
    );
  };
  return <CompactBubble />;
};

export default JosebaBubble;
