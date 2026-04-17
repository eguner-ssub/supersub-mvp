import React from 'react';
import { PreviewShell } from './PreviewShell';

export function FirstBloodPreview({ data }) {
  const players = data.players || [];
  return (
    <PreviewShell
      contentType="First Blood"
      context={`${data.league_name} · ${data.season_label}`}
      fetchedAt={data._fetchedAt}
    >
      <div className="space-y-1">
        {players.map(p => (
          <div key={p.player_id} className="flex items-center gap-3 py-2.5 border-b border-zinc-900/50 last:border-0">
            <span className="text-zinc-600 text-[10px] font-mono w-5 text-right">{p.rank}</span>
            {p.team_badge_url && <img src={p.team_badge_url} alt="" className="w-5 h-5 rounded object-contain flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{p.player_name}</p>
              <p className="text-zinc-600 text-[10px]">{p.team_name}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-cyan-400 text-lg font-black">{p.opening_goals}</p>
              <p className="text-zinc-600 text-[9px]">{p.total_goals != null ? `${p.total_goals} total` : ''}</p>
            </div>
          </div>
        ))}
      </div>
    </PreviewShell>
  );
}
