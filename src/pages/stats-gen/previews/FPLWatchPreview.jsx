import React from 'react';
import { PreviewShell } from './PreviewShell';

export function FPLWatchPreview({ data }) {
  const players = data.players || [];

  return (
    <PreviewShell
      contentType="FPL Watch"
      context={`Trending Players · GW ${data.gameweek}`}
      fetchedAt={data._fetchedAt}
    >
      <table className="w-full text-xs">
        <thead>
          <tr className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
            <th className="text-left py-2 w-8">#</th>
            <th className="text-left py-2">Player</th>
            <th className="text-right py-2">Price</th>
            <th className="text-right py-2">Form</th>
            <th className="text-right py-2">Total Pts</th>
            <th className="text-right py-2">Transfers In</th>
          </tr>
        </thead>
        <tbody>
          {players.map(p => (
            <tr key={p.rank} className="border-t border-zinc-900/50">
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
              <td className="py-2.5 text-right text-zinc-400 font-mono">{p.fpl_price != null ? `£${p.fpl_price}m` : '–'}</td>
              <td className="py-2.5 text-right text-cyan-400 font-mono">{p.fpl_form ?? '–'}</td>
              <td className="py-2.5 text-right text-zinc-400">{p.fpl_total_points ?? '–'}</td>
              <td className="py-2.5 text-right text-emerald-400 font-mono">
                {p.transfers_in_gw != null ? `+${p.transfers_in_gw.toLocaleString()}` : '–'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PreviewShell>
  );
}
