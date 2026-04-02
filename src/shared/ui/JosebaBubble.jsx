import React from 'react';
import { ChevronRight } from 'lucide-react';

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

  /* ── compact (default) ─────────────────────────────────────── */
  return (
    <div
      onClick={onAdvance}
      className="fixed bottom-0 left-0 right-0 z-[400] cursor-pointer select-none animate-in slide-in-from-bottom-4 duration-300"
      style={{
        ...safeAreaStyle,
        padding: `16px 16px calc(env(safe-area-inset-bottom, 0px) + 20px)`,
      }}
    >
      <div className="flex items-start gap-3 relative">
        {/* Avatar */}
        <img
          src={avatarSrc}
          alt={label}
          className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-white/10"
          onError={(e) => { e.target.src = '/assets/assistant-head.png'; }}
        />

        {/* Text */}
        <div className="flex-1 min-w-0 pr-12">
          <span className="block text-[8px] font-black uppercase tracking-widest text-emerald-400 mb-1">
            {label}
          </span>
          <p className="text-[13px] font-bold text-white/90 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Tap indicator */}
        <div className="absolute bottom-0 right-0 flex items-center gap-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">tap</span>
          <ChevronRight className="w-3.5 h-3.5 text-white/30" />
        </div>
      </div>
    </div>
  );
};

export default JosebaBubble;
