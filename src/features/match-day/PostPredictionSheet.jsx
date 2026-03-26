import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import AffiliateDisclaimer from '../../shared/ui/AffiliateDisclaimer';
import { useAffiliateLink } from '../../shared/hooks/useAffiliateLink';
import { useGame } from '../../shared/context/GameContext';

const AUTO_DISMISS_SECONDS = 8;

/**
 * PostPredictionSheet
 *
 * Slide-up bottom sheet shown after a successful card placement.
 * Auto-dismisses after 8 seconds. Shows a contextual affiliate offer.
 *
 * Parent MUST check userProfile.is_age_verified before rendering this component.
 *
 * Props:
 *   cardType       — e.g. 'c_supersub', 'c_match_result'
 *   selectionLabel — human-readable bet label, e.g. "Arsenal Sub to Score"
 *   odds           — decimal odds float; 0 for Supersub (fixed reward)
 *   matchName      — e.g. "Arsenal vs Chelsea"
 *   matchId        — integer match ID (for affiliate_events tracking)
 *   onDismiss      — callback to clear affiliateSheetData in parent
 */
const PostPredictionSheet = ({ cardType, selectionLabel, odds, matchName, matchId, onDismiss }) => {
  const { userProfile, supabase } = useGame();
  const { operator, affiliateUrl, displayReturn, stakeDisplay } = useAffiliateLink({
    cardType,
    selectionLabel,
    odds,
    matchName,
  });

  // Slide-up animation: start off-screen, move to position after first paint
  const [visible, setVisible] = useState(false);
  // Countdown for auto-dismiss progress bar
  const [secondsLeft, setSecondsLeft] = useState(AUTO_DISMISS_SECONDS);

  // Trigger slide-up on mount (one rAF gives CSS time to paint initial state)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Fire impression event on mount (fire-and-forget)
  useEffect(() => {
    void supabase.from('affiliate_events').insert({
      user_id:    userProfile?.id,
      event_type: 'impression',
      operator:   operator.id,
      card_type:  cardType ?? null,
      match_id:   matchId  ?? null,
      odds:       odds > 0 ? odds : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-dismiss countdown
  useEffect(() => {
    if (secondsLeft <= 0) {
      onDismiss();
      return;
    }
    const timer = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, onDismiss]);

  const handleCTAClick = () => {
    // Fire click event (fire-and-forget)
    void supabase.from('affiliate_events').insert({
      user_id:    userProfile?.id,
      event_type: 'click',
      operator:   operator.id,
      card_type:  cardType ?? null,
      match_id:   matchId  ?? null,
      odds:       odds > 0 ? odds : null,
    });
    window.open(affiliateUrl, '_blank', 'noopener,noreferrer');
  };

  const progressPct = (secondsLeft / AUTO_DISMISS_SECONDS) * 100;

  return (
    // Full-width fixed container at bottom, above the "Locked In!" overlay (z-[120])
    <div className="fixed inset-x-0 bottom-0 z-[130]">

      {/* Progress bar — depletes over 8 seconds */}
      <div className="h-0.5 bg-white/10">
        <div
          className="h-full bg-emerald-500"
          style={{
            width: `${progressPct}%`,
            transition: 'width 1s linear',
          }}
        />
      </div>

      {/* Sheet body */}
      <div
        className="bg-zinc-950 border-t border-white/10 px-5 pt-5 pb-8"
        style={{
          transform:  visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s ease-out',
        }}
      >
        {/* Top row: label + dismiss */}
        <div className="flex items-start justify-between mb-1">
          <p className="text-[9px] font-black uppercase tracking-[3px] text-zinc-500">
            Nice call
          </p>
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            className="w-6 h-6 flex items-center justify-center rounded-full bg-white/10 text-white/40 hover:text-white transition-colors flex-shrink-0 -mt-0.5"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Bet label */}
        <h3 className="text-white font-black text-lg tracking-tight leading-tight mb-1">
          {selectionLabel}
        </h3>

        {/* Subline */}
        <p className="text-zinc-400 text-sm mb-4">Want to back it for real?</p>

        {/* Return display */}
        {displayReturn ? (
          <p className="text-sm mb-4 font-medium">
            <span className="text-white/50">{stakeDisplay}</span>
            <span className="text-white/30 mx-1.5">→</span>
            <span className="text-emerald-400 font-black">£{displayReturn}</span>
            <span className="text-white/40 ml-1.5">at {operator.name}</span>
          </p>
        ) : (
          <p className="text-white/40 text-sm mb-4">
            Place this bet at {operator.name}
          </p>
        )}

        {/* Primary CTA */}
        <button
          onClick={handleCTAClick}
          className="w-full py-4 rounded-2xl font-black uppercase text-sm tracking-widest transition-all active:scale-95 mb-4"
          style={{ background: `#${operator.brandColor}`, color: '#ffffff' }}
        >
          Bet at {operator.name} →
        </button>

        {/* Required disclaimer */}
        <AffiliateDisclaimer />
      </div>
    </div>
  );
};

export default PostPredictionSheet;
