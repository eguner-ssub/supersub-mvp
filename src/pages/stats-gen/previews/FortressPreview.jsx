import React from 'react';
import { PreviewShell } from './PreviewShell';

export function FortressPreview({ data }) {
  const teams = data.teams || [];
  return (
    <PreviewShell
      contentType="The Fortress"
      context={`${data.league_name} · ${data.season_label}`}
      fetchedAt={data._fetchedAt}
    >
      <table className="w-full text-xs">
        <thead>
          <tr className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
            <th className="text-left py-2 w-8">#</th>
            <th className="text-left py-2">Team</th>
            <th className="text-center py-2">W-D-L</th>
            <th className="text-right py-2">Home Pts</th>
          </tr>
        </thead>
        <tbody>
          {teams.map(t => (
            <tr key={t.team_id} className="border-t border-zinc-900/50">
              <td className="py-2.5 text-zinc-600 font-mono">{t.rank}</td>
              <td className="py-2.5">
                <div className="flex items-center gap-2">
                  {t.team_badge_url && <img src={t.team_badge_url} alt="" className="w-5 h-5 rounded object-contain" />}
                  <span className="text-white font-medium">{t.team_name}</span>
                </div>
              </td>
              <td className="py-2.5 text-center text-zinc-400 font-mono">
                <span className="text-emerald-400">{t.home_wins}</span>-
                <span>{t.home_draws}</span>-
                <span className="text-red-400">{t.home_losses}</span>
              </td>
              <td className="py-2.5 text-right text-cyan-400 font-bold text-sm">{t.home_points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PreviewShell>
  );
}
