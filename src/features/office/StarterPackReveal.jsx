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
  "Twelve cards. Three of each type. Match Result, Total Goals, Goalscorer — these close at kickoff. The Supersub card is different — you play it once the lineups are announced. Back the bench as a whole for 500 points, or pick one specific player for 2,500. That's the game.";

const StarterPackReveal = ({ onComplete }) => {
  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col overflow-hidden">

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
      <div className="flex-1 flex items-start justify-center overflow-y-auto px-4 pt-12 min-h-0">
        <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
          {STARTER_CARDS.map((card, i) => (
            <div
              key={card.id}
              className="flex flex-col items-center gap-2 animate-in fade-in zoom-in-95 duration-300"
              style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'backwards' }}
            >
              {/* Card at natural size with badge outside the corner */}
              <div className="relative">
                <div className="drop-shadow-2xl">
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
          onAdvance={onComplete}
          variant="compact"
        />
      </div>
    </div>
  );
};

export default StarterPackReveal;
