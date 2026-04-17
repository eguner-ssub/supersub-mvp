import React from 'react';
import { PreviewShell } from './PreviewShell';

export function GoalsPerGroundPreview({ data }) {
  const grounds = data.grounds || [];
  return (
    <PreviewShell
      contentType="Goals Per Ground"
      context={`${data.league_name} · ${data.season_label}`}
      fetchedAt={data._fetchedAt}
    >
      <table className="w-full text-xs">
        <thead>
          <tr className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
            <th className="text-left py-2 w-8">#</th>
            <th className="text-left py-2">Venue</th>
            <th className="text-right py-2">Matches</th>
            <th className="text-right py-2">Avg Goals</th>
            <th className="text-right py-2">O2.5</th>
          </tr>
        </thead>
        <tbody>
          {grounds.map((g, i) => (
            <tr key={g.team_name} className="border-t border-zinc-900/50">
              <td className="py-2.5 text-zinc-600 font-mono">{i + 1}</td>
              <td className="py-2.5">
                <div className="flex items-center gap-2">
                  {g.team_badge_url && <img src={g.team_badge_url} alt="" className="w-5 h-5 rounded object-contain" />}
                  <div>
                    <p className="text-white font-medium">{g.team_name}</p>
                    <p className="text-zinc-600 text-[10px]">{g.ground_name}</p>
                  </div>
                </div>
              </td>
              <td className="py-2.5 text-right text-zinc-400">{g.matches_played}</td>
              <td className="py-2.5 text-right text-cyan-400 font-bold">{g.avg_goals_per_match}</td>
              <td className="py-2.5 text-right text-zinc-400">{g.over_2_5_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PreviewShell>
  );
}
