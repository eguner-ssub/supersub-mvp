import React from 'react';
import { PreviewShell } from './PreviewShell';

function Metric({ label, value }) {
  return (
    <div className="bg-zinc-900/50 rounded-lg p-3 text-center">
      <p className="text-xl font-black text-cyan-400">{value ?? '–'}</p>
      <p className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest mt-1">{label}</p>
    </div>
  );
}

function GwBarChart({ breakdown }) {
  if (!breakdown?.length) return null;
  const max = Math.max(...breakdown.map(g => g.sub_goals), 1);
  const barW = Math.max(Math.floor(600 / breakdown.length) - 4, 8);
  const h = 120;

  return (
    <svg viewBox={`0 0 ${breakdown.length * (barW + 4)} ${h + 20}`} className="w-full" style={{ maxHeight: 160 }}>
      {breakdown.map((g, i) => {
        const barH = (g.sub_goals / max) * h;
        const x = i * (barW + 4);
        const isPeak = g.sub_goals === max && g.sub_goals > 0;
        return (
          <g key={i}>
            <rect x={x} y={h - barH} width={barW} height={barH} rx={2}
              className={isPeak ? 'fill-cyan-400' : 'fill-zinc-700'} />
            {isPeak && (
              <text x={x + barW / 2} y={h - barH - 4} textAnchor="middle"
                className="fill-cyan-400 text-[8px] font-bold">{g.sub_goals}</text>
            )}
            <text x={x + barW / 2} y={h + 12} textAnchor="middle"
              className="fill-zinc-600 text-[7px]">{g.gameweek?.replace?.(/\D/g,'') || i + 1}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function SupersubStatsPreview({ data }) {
  const isTeam = data.entity_type === 'team';

  return (
    <PreviewShell
      contentType="Supersub Stats"
      context={
        <span className="flex items-center gap-2">
          {data.entity_badge_url && <img src={data.entity_badge_url} alt="" className="w-6 h-6 rounded object-contain" />}
          {data.entity_name} · {data.season_label}
        </span>
      }
      fetchedAt={data._fetchedAt}
    >
      <div className="grid grid-cols-4 gap-3 mb-6">
        <Metric label="Sub Goals" value={data.total_sub_goals} />
        <Metric label="Per Match" value={data.sub_goals_per_match} />
        <Metric label="Matches" value={data.matches_played} />
        {isTeam && <Metric label="League Rank" value={data.rank_vs_peers ? `#${data.rank_vs_peers}` : '–'} />}
        {!isTeam && <Metric label="Teams" value={data.matches_played > 0 ? '–' : '0'} />}
      </div>

      {data.top_sub_scorer_name && (
        <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-lg p-3 mb-6 flex items-center gap-3">
          <span className="text-cyan-400 text-lg">⚡</span>
          <div>
            <p className="text-white text-xs font-bold">{data.top_sub_scorer_name}</p>
            <p className="text-zinc-500 text-[10px]">{data.top_sub_scorer_goals} sub goal{data.top_sub_scorer_goals !== 1 ? 's' : ''} this season</p>
          </div>
        </div>
      )}

      {data.gameweek_breakdown?.length > 0 && (
        <div>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2">Gameweek Breakdown</p>
          <GwBarChart breakdown={data.gameweek_breakdown} />
        </div>
      )}
    </PreviewShell>
  );
}
