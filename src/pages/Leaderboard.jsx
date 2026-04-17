import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy } from 'lucide-react';


// TODO: Remove placeholder after 2026-04-19 and restore leaderboard rendering
export default function Leaderboard() {
  const navigate = useNavigate();

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-[#0a0a0a] overflow-hidden font-sans select-none md:max-w-[480px] md:mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between p-4 pt-6 bg-black/60 backdrop-blur-md border-b border-white/10 z-50">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-black text-white uppercase tracking-widest">
          Leaderboard
        </h1>
        <div className="w-7" />
      </div>

      {/* Coming-soon placeholder */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-sm w-full text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-6">
            <Trophy className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-white text-2xl font-black uppercase tracking-tight mb-2">
            Leaderboards Coming Soon
          </h2>
          <p className="text-zinc-400 text-sm mb-6">
            Rankings will go live on <span className="text-white font-bold">19 April 2026</span>, after the first matchday of the soft launch.
          </p>
          <button
            onClick={() => navigate('/match-hub')}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-widest text-xs rounded-xl active:scale-95"
          >
            Browse Matches
          </button>
        </div>
      </div>

    </div>
  );
}

