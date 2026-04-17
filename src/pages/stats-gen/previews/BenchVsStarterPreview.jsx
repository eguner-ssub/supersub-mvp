import React from 'react';
import { PreviewShell } from './PreviewShell';

export function BenchVsStarterPreview({ data }) {
  const players = data.players || [];
  return (
    <PreviewShell contentType="Bench vs Starter" context={`Top 10 by differential · ${players[0]?.season_label || ''}`} fetchedAt={data._fetchedAt}>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
            <th className="text-left py-2">Player</th>
            <th className="text-right py-2">Starter G/90</th>
            <th className="text-right py-2">Sub G/90</th>
            <th className="text-right py-2">Diff</th>
          </tr>
        </thead>
        <tbody>
          {players.map(p => (
            <tr key={p.player_id} className="border-t border-zinc-900/50">
              <td className="py-2.5">
                <div className="flex items-center gap-2">
                  {p.team_badge_url && <img src={p.team_badge_url} alt="" className="w-5 h-5 rounded object-contain" />}
                  <div>
                    <p className="text-white font-medium">{p.player_name}</p>
                    <p className="text-zinc-600 text-[10px]">{p.team_name}</p>
                  </div>
                </div>
              </td>
              <td className="py-2.5 text-right text-zinc-400 font-mono">{p.starter_goals_per_90}</td>
              <td className="py-2.5 text-right text-zinc-400 font-mono">{p.sub_goals_per_90}</td>
              <td className={`py-2.5 text-right font-bold font-mono ${p.differential > 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                {p.differential > 0 ? '+' : ''}{p.differential}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PreviewShell>
  );
}
