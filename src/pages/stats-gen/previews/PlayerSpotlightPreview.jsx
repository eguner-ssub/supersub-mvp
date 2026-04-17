import React from 'react';
import { PreviewShell } from './PreviewShell';

export function PlayerSpotlightPreview({ data }) {
  const players = data.players || [];
  return (
    <PreviewShell contentType="Player Spotlight" context={`Top 10 Supersubs · ${players[0]?.season_label || ''}`} fetchedAt={data._fetchedAt}>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
            <th className="text-left py-2 w-8">#</th>
            <th className="text-left py-2">Player</th>
            <th className="text-right py-2">Goals</th>
            <th className="text-right py-2">Assists</th>
            <th className="text-right py-2">Apps</th>
            <th className="text-right py-2">G/90</th>
          </tr>
        </thead>
        <tbody>
          {players.map(p => (
            <tr key={p.player_id} className="border-t border-zinc-900/50">
              <td className="py-2.5 text-zinc-600 font-mono">{p.rank}</td>
              <td className="py-2.5">
                <div className="flex items-center gap-2">
                  {p.team_badge_url && <img src={p.team_badge_url} alt="" className="w-5 h-5 rounded object-contain" />}
                  <div>
                    <p className="text-white font-medium">{p.player_name}</p>
                    <p className="text-zinc-600 text-[10px]">{p.team_name}</p>
                  </div>
                </div>
              </td>
              <td className="py-2.5 text-right text-cyan-400 font-bold">{p.sub_goals_season}</td>
              <td className="py-2.5 text-right text-zinc-400">{p.sub_assists_season}</td>
              <td className="py-2.5 text-right text-zinc-400">{p.sub_appearances}</td>
              <td className="py-2.5 text-right text-cyan-400 font-mono">{p.goals_per_90_sub}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PreviewShell>
  );
}
