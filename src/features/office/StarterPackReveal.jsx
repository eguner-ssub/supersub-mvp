import React from 'react';
import CardBase from '../../shared/ui/CardBase';
import JosebaBubble from '../../shared/ui/JosebaBubble';

const STARTER_CARDS = [
  { id: 'c_match_result', label: 'MATCH RESULT' },
  { id: 'c_total_goals',  label: 'TOTAL GOALS'  },
  { id: 'c_player_score', label: 'PLAYER SCORE' },
  { id: 'c_supersub',     label: 'SUPERSUB'     },
];

const JOSEBA_MESSAGE =
  "Twelve cards. Three of each type. Match Result, Total Goals, Goalscorer — these close at kickoff. Place them before the whistle. The Supersub card is different. You play it once the lineups are announced. Back the bench as a whole — any substitute who scores wins you 500 points. Or go specific — pick one player from the bench, and if they come on and score, you win 2,500. More risk, more reward. That's the game.";

/**
 * StarterPackReveal — fullscreen overlay showing the 12 starter cards.
 * Cards are already in inventory from the DB trigger. This screen only explains them.
 * Tapping the Joseba bubble calls onComplete().
 */
const StarterPackReveal = ({ onComplete }) => {
  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex-none pt-14 pb-4 px-4 text-center">
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-400 mb-1">
          Signing Bonus
        </p>
        <h2 className="text-2xl font-black uppercase tracking-tight text-white">
          Starter Pack
        </h2>
        <p className="text-xs text-zinc-500 mt-1">12 cards · 3 of each type</p>
      </div>

      {/* Card grid — 2×2, one per card type with x3 badge */}
      <div className="flex-1 overflow-y-auto px-4 pb-40 scrollbar-hide flex items-center justify-center">
        <div className="grid grid-cols-2 gap-5 w-full max-w-sm">
          {STARTER_CARDS.map((card, i) => (
            <div
              key={card.id}
              className="flex flex-col items-center gap-2 animate-in fade-in zoom-in-95 duration-300"
              style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'backwards' }}
            >
              {/* Card with ×3 badge */}
              <div className="relative w-fit">
                <div className="drop-shadow-2xl">
                  <CardBase
                    type={card.id}
                    status="generic"
                  />
                </div>
                <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs font-black rounded-full w-7 h-7 flex items-center justify-center shadow-lg z-30">
                  ×3
                </div>
              </div>

              {/* Label — identical style for all four cards */}
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 text-center">
                {card.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Joseba bubble — tapping calls onComplete */}
      <JosebaBubble
        message={JOSEBA_MESSAGE}
        onAdvance={onComplete}
      />
    </div>
  );
};

export default StarterPackReveal;
