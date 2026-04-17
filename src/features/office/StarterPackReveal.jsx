import React from 'react';
import CardBase from '../../shared/ui/CardBase';
import JosebaBubble from '../../shared/ui/JosebaBubble';
import { useGame } from '../../shared/context/GameContext';

const STARTER_CARDS = [
  { id: 'c_match_result', label: 'MATCH RESULT' },
  { id: 'c_total_goals',  label: 'TOTAL GOALS'  },
  { id: 'c_player_score', label: 'PLAYER SCORE' },
  { id: 'c_supersub',     label: 'SUPERSUB'     },
];

const JOSEBA_MESSAGE =
  "Twelve cards. Three of each type. Match Result, Total Goals, Goalscorer — these close at kickoff. The Supersub card is different — you play it once the lineups are announced. Back the bench as a whole for 500 points, or pick one specific player for 2,500. That's the game.";

const StarterPackReveal = ({ onComplete }) => {
  const { updateInventory, supabase, userProfile } = useGame();

  /**
   * Credit 3 of each starter card (12 total) to the user's inventory, then stamp
   * profiles.starter_pack_credited_at so we never double-credit on refresh.
   * Any failure is logged but does not block the reveal from dismissing — the
   * idempotency guard in OfficeOnboarding re-invokes this flow on next visit.
   */
  const handleCompleteWithCredit = async () => {
    const cardsToCredit = STARTER_CARDS.flatMap(card => [card.id, card.id, card.id]);

    try {
      await updateInventory(cardsToCredit);
    } catch (err) {
      console.error('[StarterPackReveal] Failed to credit cards:', err);
    }

    if (userProfile?.id) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ starter_pack_credited_at: new Date().toISOString() })
          .eq('id', userProfile.id);
        if (error) console.error('[StarterPackReveal] Failed to stamp starter_pack_credited_at:', error);
      } catch (err) {
        console.error('[StarterPackReveal] Failed to stamp starter_pack_credited_at:', err);
      }
    }

    onComplete();
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-black flex flex-col overflow-hidden"
      style={{ '--card-scale': 'clamp(0.65, 0.75 + 0.002 * (100vh - 700px), 1)' }}
    >

      {/* Header - fixed top, compact */}
      <div className="flex-shrink-0 pt-10 pb-6 px-4 text-center">
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-400 mb-1">
          Signing Bonus
        </p>
        <h2 className="text-2xl font-black uppercase tracking-tight text-white">
          Starter Pack
        </h2>
        <p className="text-[11px] text-zinc-500 mt-0.5">12 cards · 3 of each type</p>
      </div>

      {/* Card grid - pushed down from header for breathing room */}
      <div className="flex-1 flex items-start justify-center overflow-y-auto px-4 pt-6 md:pt-12 min-h-0">
        <div className="grid grid-cols-2 gap-3 md:gap-4 w-full max-w-xs">
          {STARTER_CARDS.map((card, i) => (
            <div
              key={card.id}
              className="flex flex-col items-center gap-2 animate-in fade-in zoom-in-95 duration-300"
              style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'backwards' }}
            >
              {/* Card scales visually with --card-scale; wrapper claims the scaled layout footprint */}
              <div
                className="relative"
                style={{
                  width: 'calc(6.5rem * var(--card-scale, 1))',
                  height: 'calc(10rem * var(--card-scale, 1))',
                }}
              >
                <div
                  className="drop-shadow-2xl"
                  style={{
                    transform: 'scale(var(--card-scale, 1))',
                    transformOrigin: 'top left',
                  }}
                >
                  <CardBase type={card.id} status="generic" />
                </div>
                <div className="absolute -top-2 -right-2 bg-yellow-500 text-black font-black font-mono text-[10px] px-2 py-0.5 rounded-md border border-black/20 shadow-lg z-30 flex items-center gap-0.5">
                  <span>x</span>
                  <span className="text-sm">3</span>
                </div>
              </div>

              {/* Label */}
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 text-center">
                {card.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Joseba bubble - fixed bottom, not overlapping cards */}
      <div className="flex-shrink-0">
        <JosebaBubble
          message={JOSEBA_MESSAGE}
          onAdvance={handleCompleteWithCredit}
          variant="compact"
        />
      </div>
    </div>
  );
};

export default StarterPackReveal;
