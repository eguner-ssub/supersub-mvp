import React, { useState, useEffect } from 'react';
import { Play, Zap } from 'lucide-react';

/**
 * AdOverlay — rewarded ad placeholder.
 *
 * Sequencing contract:
 *   1. Countdown drives the progress bar UI (5 → 0).
 *   2. When countdown hits 0 the "Claim Reward" screen appears.
 *   3. onReward() is called ONLY when the user taps "Claim Reward".
 *      (Never auto-fired — mirrors real SDK behaviour where the app
 *       calls the reward callback after the user explicitly dismisses.)
 *   4. After onReward() resolves, the overlay closes via onClose().
 *
 * When a real ad SDK is integrated, replace the countdown UI block
 * with the SDK's rewarded video component. The onReward / onClose
 * contract and the rest of Training.jsx remain unchanged.
 */
const AdOverlay = ({ onReward, onClose }) => {
  const AD_DURATION = 5;
  const [countdown, setCountdown] = useState(AD_DURATION);
  const [isComplete, setIsComplete] = useState(false);
  const [claiming, setClaiming] = useState(false);

  /* Countdown tick — stops at 0, reveals claim screen */
  useEffect(() => {
    if (countdown <= 0) {
      setIsComplete(true);
      return;
    }
    const t = setTimeout(() => setCountdown(prev => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleClaim = async () => {
    if (claiming) return;
    setClaiming(true);
    try {
      if (onReward) await onReward();
    } finally {
      setClaiming(false);
      if (onClose) onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-gradient-to-br from-purple-900 to-blue-900 rounded-2xl p-8 text-center border-2 border-purple-500 shadow-[0_0_50px_rgba(168,85,247,0.5)]">

        {!isComplete ? (
          /* ── Watching phase ─────────────────────────────────────── */
          <>
            <div className="mb-6 flex justify-center">
              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm border-2 border-white/20">
                <Play className="w-10 h-10 text-white fill-white" />
              </div>
            </div>

            <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-wide">
              Sponsored Ad
            </h2>
            <p className="text-purple-200 text-sm mb-8">
              Watch to earn your reward
            </p>

            {/* Countdown ring */}
            <div className="mb-6">
              <div className="w-24 h-24 mx-auto bg-white/10 rounded-full flex items-center justify-center border-4 border-white/30 backdrop-blur-sm">
                <span className="text-5xl font-black text-white">{countdown}</span>
              </div>
              <p className="text-white/70 text-xs mt-4 uppercase tracking-widest">
                Reward in {countdown}s…
              </p>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-1000 ease-linear"
                style={{ width: `${((AD_DURATION - countdown) / AD_DURATION) * 100}%` }}
              />
            </div>

            <p className="text-white/50 text-xs mt-6 italic">
              Please wait for the ad to complete
            </p>
          </>
        ) : (
          /* ── Claim phase ────────────────────────────────────────── */
          <>
            <div className="mb-6 flex justify-center">
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center border-2 border-emerald-500">
                <Zap className="w-12 h-12 text-emerald-400" />
              </div>
            </div>

            <h2 className="text-2xl font-black text-white mb-2 uppercase">
              Ad Complete
            </h2>
            <p className="text-emerald-300 text-sm mb-8">
              Tap below to claim your energy reward
            </p>

            <button
              onClick={handleClaim}
              disabled={claiming}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-60 text-white font-black uppercase rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5" />
              {claiming ? 'Claiming…' : 'Claim Reward'}
            </button>
          </>
        )}
      </div>

      {/* Staging label — remove when real SDK is integrated */}
      <p className="text-white/25 text-[10px] mt-5 uppercase tracking-widest">
        Mock Rewarded Ad · Replace with real SDK
      </p>
    </div>
  );
};

export default AdOverlay;
