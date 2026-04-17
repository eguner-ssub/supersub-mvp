import React from 'react';
import { PreviewShell } from './PreviewShell';

export function SupersubOfWeekPreview({ data }) {
  if (!data.player_id) {
    return (
      <PreviewShell contentType="Supersub of the Week" context={`GW ${data.gameweek}`} fetchedAt={data._fetchedAt}>
        <p className="text-zinc-600 text-sm text-center py-8">{data.message || 'No sub scored or assisted this gameweek.'}</p>
      </PreviewShell>
    );
  }

  return (
    <PreviewShell contentType="Supersub of the Week" context={`GW ${data.gameweek}`} fetchedAt={data._fetchedAt}>
      {/* Hero card */}
      <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-lg p-5 mb-4 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          {data.team_badge_url && <img src={data.team_badge_url} alt="" className="w-10 h-10 rounded object-contain" />}
          <div className="text-left">
            <p className="text-white text-xl font-black">{data.player_name}</p>
            <p className="text-zinc-400 text-xs">{data.team_name}</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-center gap-6 mb-4">
          <div className="text-center">
            <p className="text-cyan-400 text-2xl font-black">{data.goals}</p>
            <p className="text-zinc-500 text-[9px] uppercase tracking-widest">Goals</p>
          </div>
          <div className="text-center">
            <p className="text-cyan-400 text-2xl font-black">{data.assists}</p>
            <p className="text-zinc-500 text-[9px] uppercase tracking-widest">Assists</p>
          </div>
          <div className="text-center">
            <p className="text-white text-2xl font-black">{data.entry_minute}'</p>
            <p className="text-zinc-500 text-[9px] uppercase tracking-widest">Entry</p>
          </div>
        </div>
      </div>

      {/* Match context */}
      <div className="bg-zinc-900/50 rounded-lg p-4">
        <p className="text-white text-xs font-bold mb-2">{data.match_title}</p>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-zinc-400 text-xs font-mono">{data.match_score_before}</span>
          <span className="text-zinc-600 text-xs">→</span>
          <span className="text-cyan-400 text-xs font-mono font-bold">{data.match_score_after}</span>
          <span className="text-zinc-600 text-[10px]">after sub entry at {data.entry_minute}'</span>
        </div>
        <p className="text-zinc-500 text-[10px]">vs <span className="text-zinc-300">{data.opponent}</span></p>
      </div>
    </PreviewShell>
  );
}
