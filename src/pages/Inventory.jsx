import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGame } from '../shared/context/GameContext';
import { toast } from 'sonner';
import { ArrowLeft, Zap, Star, X } from 'lucide-react';
import CardBase from '../shared/ui/CardBase';
import JosebaBubble from '../shared/ui/JosebaBubble';

// ─── Expiry helper (mirrors ViewDeck.jsx) ───────────────────────────────────
function timeUntilExpiry(isoDate) {
  if (!isoDate) return null;
  const expiry = new Date(isoDate);
  const now = new Date();
  if (expiry <= now) return null;

  const todayDay = now.getDay();
  const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

  let urgency = 'normal';
  if (todayDay === 1) urgency = 'red';
  else if (todayDay === 0 || todayDay === 6) urgency = 'amber';

  let label;
  if (todayDay === 1) label = 'exp. today';
  else if (daysLeft <= 1) label = 'exp. tmrw';
  else label = 'exp. Mon';

  return { label, urgency };
}

// ─── Constants ───────────────────────────────────────────────────────────────
const TIER_LABELS = { 0: '', 1: 'On a Roll', 2: 'On Fire', 3: 'Unstoppable' };
const TIER_COLORS = {
  0: 'text-zinc-500',
  1: 'text-zinc-400',
  2: 'text-amber-400',
  3: 'text-emerald-400',
};

const CARD_ICON_MAP = {
  c_match_result: '/assets/stadium_icon.webp',
  c_total_goals:  '/assets/goal_icon.webp',
  c_player_score: '/assets/player_icon.webp',
  c_supersub:     '/assets/supersub_icon.webp',
};

const CARD_INFO = {
  c_match_result: {
    label:       'Match Result',
    description: 'Predict which team wins, or if the match ends in a draw.',
    placement:   'Must be placed before kick-off.',
    expiry:      'Expires Monday at midnight — use it before then.',
    common:      true,
  },
  c_total_goals: {
    label:       'Total Goals',
    description: 'Predict whether the match has more or fewer than 2.5 goals.',
    placement:   'Must be placed before kick-off.',
    expiry:      'Expires Monday at midnight — use it before then.',
    common:      true,
  },
  c_player_score: {
    label:       'Player Score',
    description: 'Pick a specific player to score during the match.',
    placement:   'Must be placed before kick-off.',
    expiry:      'Expires Monday at midnight — use it before then.',
    common:      true,
  },
  c_supersub: {
    label:       'Super Sub',
    description: 'Back a substitute to score or assist after coming on.',
    placement:   'Placed after lineups are announced.',
    expiry:      'Never expires. Use it when the moment is right.',
    common:      false,
  },
};

const CARD_TYPES = [
  { id: 'c_match_result' },
  { id: 'c_total_goals' },
  { id: 'c_player_score' },
  { id: 'c_supersub' },
];

const MILESTONES = [3, 5, 7];

// ─── Component ───────────────────────────────────────────────────────────────
const Inventory = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const {
    userProfile,
    supabase,
    bagAvailableToday,
    claimTrainingBag,
    currentStreak,
    streakTier,
    expiryMap,
    useEnergyDrink,
    energyDrinks,
    trainingSessionsToday,
  } = useGame();

  // Bag claim state
  const claimAttempted      = useRef(false);
  const [bagReward, setBagReward]       = useState(null);
  const [showJoseba, setShowJoseba]     = useState(false);
  const [josebaDone, setJosebaDone]     = useState(false);

  // Card info sheet
  const [selectedCard, setSelectedCard] = useState(null);

  // Energy drink action
  const [isDrinking, setIsDrinking]     = useState(false);

  // Ref for scroll-to on /inventory/energy-drinks path
  const energyRef = useRef(null);

  // ── Claim bag on mount if available ──────────────────────────────────────
  useEffect(() => {
    if (!bagAvailableToday || claimAttempted.current || !userProfile) return;
    claimAttempted.current = true;
    claimTrainingBag().then(reward => {
      if (reward) {
        setBagReward(reward);
        setTimeout(() => setShowJoseba(true), 300);
      }
    });
  }, [bagAvailableToday, userProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll to energy drinks if navigated via /inventory/energy-drinks ────
  useEffect(() => {
    if (location.pathname === '/inventory/energy-drinks' && energyRef.current) {
      setTimeout(() => {
        energyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 350);
    }
  }, [location.pathname]);

  // ── Derived values ────────────────────────────────────────────────────────
  const tier       = streakTier(currentStreak);
  const tierLabel  = TIER_LABELS[tier];
  const tierColor  = TIER_COLORS[tier];
  const filledDots = Math.min(currentStreak, 7);

  const nextMilestone      = MILESTONES.find(m => m > currentStreak);
  const nextMilestoneLabel = nextMilestone
    ? `Next milestone: Day ${nextMilestone}`
    : 'Max tier reached';

  const getCardCount = (id) => userProfile?.inventoryMap?.[id] || 0;
  const allEmpty     = CARD_TYPES.every(c => getCardCount(c.id) === 0);

  const drinkDisabled =
    isDrinking ||
    energyDrinks === 0 ||
    (userProfile && userProfile.energy >= (userProfile.max_energy || 5));

  // ── Joseba message ────────────────────────────────────────────────────────
  const isFirstEver     = bagReward && !userProfile?.kit_bag_onboarding_seen;
  const isMilestone     = bagReward && MILESTONES.includes(currentStreak);
  const nextTierCount   = currentStreak >= 3 ? 3 : 2;

  let josebaMessage = '';
  if (bagReward) {
    if (isFirstEver) {
      josebaMessage =
        "This is your training bag, Boss. Open it every day and I'll keep it stocked. Your streak grows each time you return — and the longer the streak, the bigger the bag.";
    } else if (isMilestone) {
      josebaMessage = `Day ${currentStreak} — milestone reached, Boss. Keep this run going.`;
    } else {
      josebaMessage = `Day ${currentStreak} bag collected. Come back tomorrow for your Day ${currentStreak + 1} bag — ${nextTierCount} cards waiting.`;
    }
  }

  const handleJosebaAdvance = async () => {
    if (isFirstEver && userProfile?.id) {
      await supabase
        .from('profiles')
        .update({ kit_bag_onboarding_seen: true })
        .eq('id', userProfile.id);
    }
    setJosebaDone(true);
    setShowJoseba(false);
  };

  // ── Energy drink handler ──────────────────────────────────────────────────
  const handleDrink = async () => {
    if (isDrinking) return;
    setIsDrinking(true);
    try {
      const result = await useEnergyDrink();
      if (result?.success) {
        toast.success('⚡ Energy restored!');
      } else if (result?.reason) {
        toast.error(result.reason);
      }
    } finally {
      setIsDrinking(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Fixed full-bleed background */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: "url('/assets/bg-training-quiz.webp')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <div className="fixed inset-0 bg-black/50 z-0" />

      {/* Scrollable content */}
      <div className="relative z-10 h-screen overflow-y-auto flex justify-center">
        <div className="w-full max-w-md flex flex-col px-5 pb-40">

          {/* ── Header ── */}
          <div
            className="flex items-center justify-between pb-6"
            style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
          >
            <button
              onClick={() => navigate('/dashboard')}
              className="w-9 h-9 flex-shrink-0 bg-white/10 border border-white/20 rounded-full flex items-center justify-center text-white active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="flex-1 text-center text-[11px] font-black uppercase tracking-widest text-white">
              Kit Bag
            </h1>
            <div className="flex items-center gap-2">
              <span className="bg-black/80 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5 flex items-center gap-1">
                <Zap className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                <span className="text-sm font-bold font-mono text-white">
                  {userProfile?.energy ?? 0}/{userProfile?.max_energy ?? 5}
                </span>
              </span>
              <span className="bg-black/80 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5 flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-400" />
                <span className="text-sm font-bold font-mono text-white">
                  {userProfile?.points ?? 0}
                </span>
              </span>
            </div>
          </div>

          {/* ── Persistent streak status line ── */}
          {!bagAvailableToday && (!bagReward || josebaDone) && (
            <div className="flex items-center justify-center gap-2 my-3">
              <span className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-full px-4 py-2 text-sm text-white font-bold">
                💪 Day {currentStreak} streak · Come back tomorrow for your Day {currentStreak + 1} bag
              </span>
            </div>
          )}

          {/* ── Section 2: Streak Card ── */}
          <div className="mb-4 bg-black/60 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
            {/* Row 1: day count + tier label */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl leading-none">🔥</span>
                <span className="text-2xl font-black text-white font-mono leading-none">
                  DAY {currentStreak}
                </span>
              </div>
              {tierLabel && (
                <span className={`text-[11px] font-black uppercase tracking-widest ${tierColor}`}>
                  {tierLabel}
                </span>
              )}
            </div>

            {/* Row 2: 7 day dots */}
            <div className="flex items-center gap-1.5 mb-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-all ${
                    i < filledDots ? 'bg-emerald-400' : 'bg-zinc-700'
                  }`}
                />
              ))}
            </div>

            {/* Row 3: next milestone */}
            <p className="text-zinc-500 text-[11px] font-bold uppercase tracking-wide">
              {nextMilestoneLabel}
            </p>
          </div>

          {/* ── Section 3: Training Status ── */}
          <div className="mb-4 bg-black/60 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.15em] mb-3">
              Training Today
            </p>
            <p className="text-white font-bold text-sm mb-3">
              {trainingSessionsToday} of 4 sessions used
            </p>

            {/* Progress segments */}
            <div className="flex gap-1.5 mb-4">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${
                    i < trainingSessionsToday ? 'bg-emerald-400' : 'bg-zinc-700'
                  }`}
                />
              ))}
            </div>

            {trainingSessionsToday < 4 ? (
              <button
                onClick={() => navigate('/training')}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-widest rounded-xl transition-colors active:scale-95"
              >
                Train Now →
              </button>
            ) : (
              <p className="text-zinc-500 text-xs font-bold text-center">
                Come back tomorrow for 4 more sessions
              </p>
            )}
          </div>

          {/* ── Section 4: Tactical Deck ── */}
          <div className="mb-6">
            <div className="inline-block bg-black/40 backdrop-blur-sm rounded px-2 py-0.5 mb-4">
              <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-[0.2em]">
                Tactical Deck
              </p>
            </div>

            {/* Empty deck prompt */}
            {allEmpty && (
              <div className="mb-5 bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl p-4 text-center">
                <p className="text-zinc-400 text-sm mb-3">
                  Your deck is empty. Complete training to earn more cards.
                </p>
                <button
                  onClick={() => navigate('/training')}
                  className="px-4 py-2 bg-emerald-500 text-black font-black text-xs uppercase tracking-widest rounded-lg active:scale-95 transition-colors"
                >
                  Go to Training →
                </button>
              </div>
            )}

            {/* 2×2 grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-8">
              {CARD_TYPES.map(card => {
                const count      = getCardCount(card.id);
                const hasCards   = count > 0;
                const expiryChip = hasCards ? timeUntilExpiry(expiryMap[card.id]) : null;

                return (
                  <div
                    key={card.id}
                    className="relative transition-transform duration-200 active:scale-95 cursor-pointer"
                    onClick={() => setSelectedCard(card.id)}
                  >
                    <div className={hasCards ? 'opacity-100 drop-shadow-2xl' : 'opacity-40 grayscale contrast-125'}>
                      <div className="flex justify-center">
                        <CardBase type={card.id} status="generic" />
                      </div>
                    </div>

                    {/* Count badge */}
                    {hasCards && (
                      <div className="absolute top-3 right-3 z-30">
                        <div className="bg-yellow-500 text-black font-black font-mono text-[10px] px-2 py-0.5 rounded-md border border-black/20 shadow-lg flex items-center gap-0.5">
                          <span>x</span>
                          <span className="text-sm">{count}</span>
                        </div>
                      </div>
                    )}

                    {/* Expiry chip */}
                    {hasCards && expiryChip && (
                      <div className="absolute bottom-3 left-0 right-0 flex justify-center z-30 pointer-events-none">
                        <div className={`text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                          expiryChip.urgency === 'red'
                            ? 'bg-red-500/20 border-red-400/50 text-red-300'
                            : expiryChip.urgency === 'amber'
                              ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                              : 'bg-black/60 border-white/30 text-white/70'
                        }`}>
                          {expiryChip.label}
                        </div>
                      </div>
                    )}

                    {/* Empty overlay */}
                    {!hasCards && (
                      <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                        <div className="bg-black/60 backdrop-blur-[2px] px-3 py-1 rounded text-[10px] font-bold text-white/70 uppercase border border-white/10">
                          Empty
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Section 5: Energy Drinks ── */}
          <div className="mb-6" ref={energyRef}>
            <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-[0.2em] mb-3 pl-1">
              Energy Drinks
            </p>

            <div className="flex items-center justify-between bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">Energy Drinks</p>
                  <p className="text-yellow-400 font-mono text-[11px]">x{energyDrinks}</p>
                </div>
              </div>
              <button
                onClick={handleDrink}
                disabled={drinkDisabled}
                className="px-4 py-2 rounded-lg bg-yellow-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-black text-xs uppercase tracking-widest transition-colors active:scale-95"
              >
                {isDrinking ? '...' : 'Use'}
              </button>
            </div>

            <p className="text-zinc-600 text-[10px] mt-2 pl-1">
              Drinks restore 1 energy.{' '}
              <span className="text-zinc-700">Watch an ad to earn more.</span>
            </p>
          </div>

        </div>
      </div>

      {/* ── Card Info Bottom Sheet ── */}
      {selectedCard && (() => {
        const info  = CARD_INFO[selectedCard];
        const count = getCardCount(selectedCard);
        return (
          <div className="fixed inset-0 z-[200]">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setSelectedCard(null)}
            />
            {/* Sheet */}
            <div className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto bg-zinc-950 border-t-2 border-emerald-500/40 rounded-t-2xl p-6 animate-in slide-in-from-bottom duration-300">
              {/* Handle */}
              <div className="h-1 w-16 bg-emerald-500 rounded-full mx-auto mt-3 mb-2" />

              {/* Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-24 h-24 rounded-2xl bg-white/8 border border-white/15 flex items-center justify-center">
                  <img
                    src={CARD_ICON_MAP[selectedCard]}
                    alt={info?.label}
                    className="w-16 h-16 object-contain"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                </div>
              </div>

              {/* Name */}
              <h3 className="text-2xl font-black text-white text-center mb-2">
                {info?.label}
              </h3>

              {/* Description */}
              <p className="text-zinc-400 text-sm text-center mb-5">
                {info?.description}
              </p>

              <div className="border-t border-white/10 my-4" />

              {/* Rules */}
              <div className="space-y-3 mb-5">
                <div className="flex gap-3">
                  <span className="text-zinc-600 text-[11px] font-bold uppercase tracking-wide w-20 flex-shrink-0 pt-0.5">
                    Placement
                  </span>
                  <span className="text-zinc-300 text-xs leading-relaxed">{info?.placement}</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-zinc-600 text-[11px] font-bold uppercase tracking-wide w-20 flex-shrink-0 pt-0.5">
                    Expiry
                  </span>
                  <span className="text-zinc-300 text-xs leading-relaxed">{info?.expiry}</span>
                </div>
              </div>

              {/* CTA line */}
              {count > 0 ? (
                <p className="text-zinc-400 text-base text-center">
                  Use this card on any match you see in{' '}
                  <button
                    onClick={() => { setSelectedCard(null); navigate('/match-hub'); }}
                    className="text-emerald-400 font-bold"
                  >
                    Match Hub
                  </button>
                </p>
              ) : (
                <p className="text-zinc-500 text-sm text-center">
                  Complete training sessions to earn more of these cards.
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Bag Reveal Bottom Sheet ── */}
      {bagReward && !josebaDone && (
        <div className="fixed inset-0 z-[100]">
          {/* Top 12% — tap-to-dismiss area */}
          <button
            onClick={handleJosebaAdvance}
            className="absolute top-0 left-0 right-0 h-[12vh] w-full bg-black/60"
            aria-label="Dismiss bag"
          />

          {/* Bottom 88% — sheet */}
          <div className="absolute bottom-0 left-0 right-0 top-[12vh] bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 rounded-t-3xl flex flex-col animate-in slide-in-from-bottom duration-500">
            {/* Drag handle */}
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mt-3 flex-shrink-0" />

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 pt-8 pb-8 flex flex-col items-center justify-start">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-1 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">
                Today's Training Bag
              </p>
              <p className="text-zinc-400 text-sm">
                Day {currentStreak} · Tier {bagReward.tier}
              </p>
              <div className="w-16 h-px bg-white/10 mx-auto mt-3 mb-6" />

              {/* Single CardBase + ×count badge */}
              <div className="relative mb-6 animate-in fade-in zoom-in-95 duration-500">
                <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-3xl scale-110" />
                <div className="relative" style={{ transform: 'scale(1.1)' }}>
                  <CardBase type={bagReward.cardType} status="generic" />
                </div>
                <div className="absolute -top-2 -right-2 bg-yellow-500 text-black font-black font-mono text-[10px] px-2 py-0.5 rounded-md border border-black/20 shadow-lg z-30 flex items-center gap-0.5">
                  <span>x</span>
                  <span className="text-sm">{bagReward.cardCount}</span>
                </div>
              </div>

              {/* Replacement text */}
              <p className="text-zinc-300 text-sm text-center mb-8">
                {bagReward.cardCount} {CARD_INFO[bagReward.cardType]?.label} card{bagReward.cardCount > 1 ? 's' : ''} added to your deck.
              </p>

              {/* Conditional: Joseba bubble OR Tap to continue */}
              {showJoseba && (isFirstEver || isMilestone) ? (
                <div className="w-full">
                  <JosebaBubble
                    message={josebaMessage}
                    onAdvance={handleJosebaAdvance}
                    variant="compact-warm"
                  />
                </div>
              ) : (
                <button
                  onClick={handleJosebaAdvance}
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-widest rounded-xl transition-colors active:scale-95"
                >
                  Tap to continue →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Inventory;
