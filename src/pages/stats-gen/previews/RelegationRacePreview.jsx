import React from 'react';
import { PreviewShell } from './PreviewShell';

function timeAgo(iso) {
  if (!iso) return 'unknown';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return 'unknown';
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function pct(p) {
  if (p == null) return '–';
  return `${Math.round(Number(p) * 100)}%`;
}

export function RelegationRacePreview({ data }) {
  const teams = (data.teams || []).slice(0, 10);

  return (
    <PreviewShell
      contentType="Relegation Race"
      context={`${data.league_name || 'League'} ${data.season || ''} · Relegation Race`}
      fetchedAt={data._fetchedAt}
    >
      {teams.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-zinc-600 text-sm">No relegation-race data available.</p>
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
              <th className="text-left py-2 w-8">#</th>
              <th className="text-left py-2">Team</th>
              <th className="text-center py-2 w-10">Pos</th>
              <th className="text-right py-2 w-12">Pts</th>
              <th className="text-right py-2 w-14">xPts</th>
              <th className="text-right py-2 w-14">Drop %</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t, i) => {
              const isMostAtRisk = i === 0;
              // Use the same amber/red palette already in use for danger states
              // (RefereeWatch reds, BankerPreview confidence bar). Sticking to
              // existing tokens — no new colours.
              return (
                <tr
                  key={t.team_id}
                  className={`border-t border-zinc-900/50 ${isMostAtRisk ? 'bg-red-500/5' : ''}`}
                >
                  <td className={`py-2.5 font-mono ${isMostAtRisk ? 'text-red-400' : 'text-zinc-600'}`}>
                    {t.rank ?? i + 1}
                  </td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      {t.team_logo && <img src={t.team_logo} alt="" className="w-5 h-5 rounded object-contain" />}
                      <span className={`font-medium ${isMostAtRisk ? 'text-red-400' : 'text-white'}`}>{t.team_name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-center">
                    <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded">
                      {t.current_position}
                    </span>
                  </td>
                  <td className="py-2.5 text-right text-zinc-400 font-mono">{t.current_points}</td>
                  <td className="py-2.5 text-right text-zinc-300 font-mono">
                    {Number(t.expected_final_points).toFixed(1)}
                  </td>
                  <td className={`py-2.5 text-right font-bold ${isMostAtRisk ? 'text-red-400' : 'text-zinc-300'}`}>
                    {pct(t.relegation_probability)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <p className="text-zinc-600 text-[10px] mt-4 pt-3 border-t border-zinc-900">
        Based on 10,000 simulations of remaining fixtures · Updated {timeAgo(data.computed_at)}
      </p>
    </PreviewShell>
  );
}
