import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import JosebaBubble from '../../shared/ui/JosebaBubble';

const SIMULATION_MATCH = {
  id: 'sim_lfc_barca_2019',
  home_team: 'Liverpool',
  away_team: 'Barcelona',
  home_logo: '/assets/sim/lfc-crest.webp',
  away_logo: '/assets/sim/barca-crest.webp',
  kickoff_time: '1557244800000',
  status: 'NS',
  league_name: 'UEFA Champions League — Semi-Final 2nd Leg',
};

const SimulationMatchHub = ({ onMatchSelect, onBack }) => {
  const [bubbleDismissed, setBubbleDismissed] = useState(false);

  const handleMatchTap = () => {
    setBubbleDismissed(true);
    onMatchSelect(SIMULATION_MATCH);
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col text-white font-sans select-none overflow-hidden relative bg-[url('/assets/bg-stadium.webp')] bg-cover bg-center">

      {/* HEADER */}
      <div className="fixed top-0 left-0 right-0 z-50 h-14 bg-black/80 backdrop-blur-md border-b border-white/10 flex items-center px-4">
        <button
          onClick={onBack}
          className="w-9 h-9 flex-shrink-0 bg-white/10 border border-white/20 rounded-full flex items-center justify-center text-white active:scale-95"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="flex-1 text-center text-[11px] font-black uppercase tracking-widest text-emerald-400">
          Match Hub
        </span>
        {/* Spacer to balance the back button and truly centre the title */}
        <div className="w-9 h-9 flex-shrink-0" />
      </div>
      {/* Push content below fixed header */}
      <div className="h-14 flex-shrink-0" />

      {/* MATCH LIST */}
      <div className="flex-1 overflow-y-auto p-4 pb-48 space-y-3 scrollbar-hide">
        {/* Single simulation match card */}
        <div
          onClick={handleMatchTap}
          className="bg-zinc-900 border border-white/10 rounded-xl p-4 active:scale-95 transition-all cursor-pointer hover:bg-zinc-800"
        >
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
              {SIMULATION_MATCH.league_name}
            </span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border text-zinc-500 border-zinc-700 bg-zinc-800">
              <span className="text-[9px] font-black">19:45</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-1">
            <div className="flex flex-col items-center flex-[1.2] min-w-0">
              <img
                src="https://cdn.sportmonks.com/images/soccer/teams/8/8.png"
                className="w-10 h-10 object-contain mb-1"
                alt="Liverpool"
              />
              <span className="text-[11px] font-bold text-center truncate w-full uppercase">
                {SIMULATION_MATCH.home_team}
              </span>
            </div>

            <div className="px-2 flex flex-col items-center justify-center min-w-[60px]">
              <div className="text-2xl font-black font-mono tracking-tighter">VS</div>
            </div>

            <div className="flex flex-col items-center flex-[1.2] min-w-0">
              <img
                src="https://cdn.sportmonks.com/images/soccer/teams/19/83.png"
                className="w-10 h-10 object-contain mb-1"
                alt="Barcelona"
              />
              <span className="text-[11px] font-bold text-center truncate w-full uppercase">
                {SIMULATION_MATCH.away_team}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Joseba bubble — large variant matches the office_intro narrative feel */}
      {!bubbleDismissed && (
        <JosebaBubble
          message="This is your Match Hub. Every fixture you can play lives here. One match is available tonight. Tap it."
          onAdvance={handleMatchTap}
          variant="large"
        />
      )}
    </div>
  );
};

export default SimulationMatchHub;
