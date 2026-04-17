import React from 'react';
import { PreviewShell } from './PreviewShell';

function PctPill({ label, value, highlight }) {
  return (
    <div className={`flex-1 text-center py-4 rounded-lg ${highlight ? 'bg-cyan-500/10 border border-cyan-500/20' : 'bg-zinc-900'}`}>
      <p className={`text-2xl font-black ${highlight ? 'text-cyan-400' : 'text-white'}`}>
        {value != null ? `${value}%` : '–'}
      </p>
      <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">{label}</p>
    </div>
  );
}

export function BankerPreview({ data }) {
  const maxPct = Math.max(data.home_win_pct || 0, data.draw_pct || 0, data.away_win_pct || 0);

  return (
    <PreviewShell
      contentType="The Banker"
      context={`${data.home_team} vs ${data.away_team}`}
      fetchedAt={data._fetchedAt}
    >
      {/* Win probability pills */}
      <div className="flex gap-3 mb-6">
        <PctPill label={data.home_team} value={data.home_win_pct} highlight={data.home_win_pct === maxPct && maxPct > 0} />
        <PctPill label="Draw" value={data.draw_pct} highlight={data.draw_pct === maxPct && maxPct > 0} />
        <PctPill label={data.away_team} value={data.away_win_pct} highlight={data.away_win_pct === maxPct && maxPct > 0} />
      </div>

      {/* Predicted score */}
      {data.predicted_score && (
        <div className="text-center mb-6">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2">Predicted Score</p>
          <p className="text-white text-5xl font-black">
            {data.predicted_score.home} <span className="text-zinc-700">–</span> {data.predicted_score.away}
          </p>
        </div>
      )}

      {/* Confidence bar */}
      {data.confidence != null && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Confidence</p>
            <p className="text-cyan-400 text-xs font-mono">{data.confidence}%</p>
          </div>
          <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all"
              style={{ width: `${data.confidence}%` }}
            />
          </div>
        </div>
      )}
    </PreviewShell>
  );
}
