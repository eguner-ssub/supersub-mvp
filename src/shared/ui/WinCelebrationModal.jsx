import React from 'react';
import { Trophy, X } from 'lucide-react';
import AffiliateDisclaimer from './AffiliateDisclaimer';
import ShareCardButton from './ShareCardButton';
import { useAffiliateLink } from '../hooks/useAffiliateLink';
import { useGame } from '../context/GameContext';

/**
 * WinCelebrationModal
 *
 * Shown on Dashboard when the user has unseen settled predictions.
 * Separate from WinModal.jsx (which is used only in the onboarding tutorial).
 *
 * WON variant: trophy, "You called it", points, share button, affiliate CTA.
 * LOST variant: muted styling, "Unlucky", softer affiliate CTA.
 *
 * Parent MUST check userProfile.is_age_verified before rendering.
 *
 * Props:
 *   prediction — full predictions row from Supabase
 *   onDismiss  — called when user closes; parent calls markPredictionsSeen([id])
 */
const WinCelebrationModal = ({ prediction, onDismiss }) => {
  const { userProfile, supabase } = useGame();
  const isWon = prediction?.settled_status === 'WON';

  const { operator, affiliateUrl, displayReturn } = useAffiliateLink({
    cardType:       prediction?.card_type,
    selectionLabel: prediction?.team_name,
    odds:           prediction?.odds,
  });

  const handleCTAClick = () => {
    void supabase.from('affiliate_events').insert({
      user_id:    userProfile?.id,
      event_type: 'click',
      operator:   operator.id,
      card_type:  prediction?.card_type ?? null,
      match_id:   prediction?.match_id  ?? null,
      odds:       prediction?.odds > 0 ? prediction.odds : null,
    });
    window.open(affiliateUrl, '_blank', 'noopener,noreferrer');
  };

  // Points to display: prefer points_awarded (set on WON settlement),
  // fall back to potential_reward for compatibility
  const pointsEarned = prediction?.points_awarded ?? prediction?.potential_reward ?? 0;

  // Only show for WON predictions — LOST ones are silently marked seen in Dashboard
  if (!isWon) return null;

  if (isWon) {
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center px-5 bg-black/80 backdrop-blur-sm">
        <div className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-3xl p-7 relative shadow-2xl">

          {/* Close */}
          <button
            onClick={onDismiss}
            aria-label="Close"
            className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 text-white/40 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Top accent bar */}
          <div className="absolute top-0 left-0 w-full h-1 rounded-t-3xl bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />

          {/* Trophy */}
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
            <Trophy className="w-8 h-8 text-emerald-400" />
          </div>

          <h2 className="text-white font-black text-2xl uppercase tracking-tighter text-center mb-1">
            You called it
          </h2>
          <p className="text-zinc-500 text-[10px] uppercase tracking-widest text-center mb-5">
            {prediction?.match_title || 'Match prediction'}
          </p>

          {/* Points earned */}
          <div className="bg-white/5 rounded-2xl px-4 py-3 text-center mb-5 border border-white/10">
            <p className="text-zinc-500 text-[9px] uppercase tracking-widest mb-1">Points earned</p>
            <p className="text-white font-black text-3xl tracking-tighter">+{pointsEarned}</p>
          </div>

          {/* Share button */}
          <ShareCardButton prediction={prediction} variant="won" className="w-full py-3 mb-3" />

          {/* Affiliate CTA */}
          <p className="text-zinc-400 text-xs text-center mb-3 leading-relaxed">
            {displayReturn ? (
              <>
                You could have won{' '}
                <span className="text-emerald-400 font-bold">£{displayReturn}</span>{' '}
                on this at {operator.name}
              </>
            ) : (
              <>Back your next call at {operator.name}</>
            )}
          </p>

          <button
            onClick={handleCTAClick}
            className="w-full py-3.5 rounded-2xl font-black uppercase text-sm tracking-widest transition-all active:scale-95 mb-4"
            style={{ background: `#${operator.brandColor}`, color: '#ffffff' }}
          >
            Try it for real →
          </button>

          <AffiliateDisclaimer />
        </div>
      </div>
    );
  }

};

export default WinCelebrationModal;
