import React from 'react';
import { PreviewShell } from './PreviewShell';

export function BenchContributionPreview({ data }) {
  const teams = data.teams || [];
  return (
    <PreviewShell contentType="Bench Contribution" context={teams[0]?.league_name || 'League'} fetchedAt={data._fetchedAt}>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
            <th className="text-left py-2 w-8">#</th>
            <th className="text-left py-2">Team</th>
            <th className="text-right py-2">Sub Goals</th>
            <th className="text-right py-2">Per Match</th>
            <th className="text-right py-2">Avg Sub Min</th>
            <th className="text-right py-2">Total Subs</th>
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
              <td className="py-2.5 text-right text-cyan-400 font-bold">{t.sub_goals_season}</td>
              <td className="py-2.5 text-right text-cyan-400 font-mono">{t.sub_goals_per_match}</td>
              <td className="py-2.5 text-right text-zinc-400">{t.avg_sub_minute ? `${t.avg_sub_minute}'` : '–'}</td>
              <td className="py-2.5 text-right text-zinc-400">{t.sub_appearances_total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PreviewShell>
  );
}
