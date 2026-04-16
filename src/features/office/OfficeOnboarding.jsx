import React, { useState, useEffect } from 'react';
import { useGame } from '../../shared/context/GameContext';
import JosebaBubble from '../../shared/ui/JosebaBubble';
import SimulationMatchHub from './SimulationMatchHub';
import SimulationMatchDetail from './SimulationMatchDetail';
import StarterPackReveal from './StarterPackReveal';

const INTRO_MESSAGES = [
  // Message 0
  "Welcome to your office, Boss. I'm Joseba — your assistant. Did you know that Solskjær averaged a goal every 93 minutes coming off the bench in the Premier League? I'll be giving you this type of insights all the time.",
  // Message 1
  "1999 is history. Let me show you something more recent — a night where the bench changed everything. Tap the window.",
];

/**
 * OfficeOnboarding — top-level orchestrator rendered as a fixed fullscreen overlay
 * at z-[300], above the NavigationShell nav dock (z-50). Controls all onboarding phases.
 */
const OfficeOnboarding = ({ onComplete }) => {
  const { supabase, userProfile, setIsOnboardingActive } = useGame();

  // Hide GameHeader for the entire duration of the onboarding overlay
  useEffect(() => {
    setIsOnboardingActive(true);
    return () => setIsOnboardingActive(false);
  }, [setIsOnboardingActive]);

  const [phase, setPhase]         = useState('office_intro');
  const [introStep, setIntroStep] = useState(0);

  /* Main intro bubble advance */
  const handleIntroAdvance = () => {
    if (introStep === 0) {
      setIntroStep(1);
    }
    // Step 1 tap is suppressed — user must tap the window instead
  };

  /* Stadium window tap — transitions to sim match hub */
  const handleWindowTap = (e) => {
    e.stopPropagation();
    if (introStep < 1) return; // window not yet active
    setPhase('sim_match_hub');
  };

  /* Write completion to Supabase and call onComplete */
  const handleOnboardingDone = async () => {
    if (userProfile?.id) {
      const { error } = await supabase
        .from('profiles')
        .update({ onboarding_complete: true })
        .eq('id', userProfile.id);
      if (error) {
        console.error('Failed to mark onboarding complete:', error);
        return;
      }
    }
    onComplete();
  };

  /* ── PHASES ─────────────────────────────────────────────── */

  if (phase === 'sim_match_hub') {
    return (
      <div className="fixed inset-0 z-[300]">
        <SimulationMatchHub
          onBack={() => {
            setPhase('office_intro');
            setIntroStep(1);
          }}
          onMatchSelect={() => setPhase('sim_match_detail')}
        />
      </div>
    );
  }

  if (phase === 'sim_match_detail') {
    return (
      <div className="fixed inset-0 z-[300]">
        <SimulationMatchDetail
          onBack={() => setPhase('sim_match_hub')}
          onComplete={() => setPhase('starter_pack')}
        />
      </div>
    );
  }

  if (phase === 'starter_pack') {
    return (
      <div className="fixed inset-0 z-[300]">
        <StarterPackReveal onComplete={handleOnboardingDone} />
      </div>
    );
  }

  if (phase === 'done') return null;

  /* ── office_intro phase ─────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-[300] pointer-events-none">

      {/* Stadium window tap zone — active only after step 1.
          Matches ManagerOffice hotspot-window: top-[8%] left-[42%] w-[58%] h-[42%] */}
      <div
        onClick={introStep >= 1 ? handleWindowTap : undefined}
        className={`absolute top-[8%] left-[42%] w-[58%] h-[42%] pointer-events-auto z-10 ${
          introStep >= 1 ? 'cursor-pointer' : ''
        }`}
      />

      {/* Main intro Joseba bubble — large variant for full-screen narrative feel */}
      <div
        onClick={introStep === 0 ? handleIntroAdvance : undefined}
        className="pointer-events-auto"
      >
        <JosebaBubble
          message={INTRO_MESSAGES[introStep]}
          onAdvance={introStep === 0 ? handleIntroAdvance : () => {}}
          variant="large"
        />
      </div>

      {/* Window tap hint — dark pill badge reads against any stadium background */}
      {introStep >= 1 && (
        <div className="absolute top-[8%] left-[42%] w-[58%] h-[42%] pointer-events-none z-20 flex items-end justify-center pb-5">
          <div className="flex items-center gap-2 bg-black/70 rounded-full px-3 py-1.5 backdrop-blur-sm border border-white/10">
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">
              Tap the window
            </span>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficeOnboarding;
