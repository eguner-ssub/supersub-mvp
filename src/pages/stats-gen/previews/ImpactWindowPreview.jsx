import React from 'react';
import { PreviewShell } from './PreviewShell';

export function ImpactWindowPreview({ data }) {
  const windows = data.windows || [];
  const max = Math.max(...windows.map(w => w.sub_goals), 1);
  const peak = windows.reduce((best, w) => (!best || w.sub_goals > best.sub_goals ? w : best), null);

  return (
    <PreviewShell
      contentType="Impact Window"
      context={`${data.league_name} · ${data.season_label}`}
      fetchedAt={data._fetchedAt}
    >
      <div className="space-y-3">
        {windows.map(w => {
          const pct = (w.sub_goals / max) * 100;
          const isPeak = w.range === peak?.range && w.sub_goals > 0;
          return (
            <div key={w.range}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-zinc-400 text-xs font-mono w-14">{w.range}'</span>
                <span className={`text-xs font-bold font-mono ${isPeak ? 'text-cyan-400' : 'text-zinc-500'}`}>
                  {w.sub_goals}
                </span>
              </div>
              <div className="w-full h-5 bg-zinc-900 rounded overflow-hidden">
                <div
                  className={`h-full rounded transition-all ${isPeak ? 'bg-cyan-500' : 'bg-zinc-700'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {peak && peak.sub_goals > 0 && (
        <p className="text-center text-zinc-500 text-[10px] font-mono mt-4">
          Peak window: <span className="text-cyan-400 font-bold">{peak.range}'</span> with {peak.sub_goals} sub goal{peak.sub_goals !== 1 ? 's' : ''}
        </p>
      )}
    </PreviewShell>
  );
}
