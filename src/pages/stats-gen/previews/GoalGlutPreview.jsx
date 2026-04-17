import React from 'react';
import { PreviewShell } from './PreviewShell';

function SeasonView({ data }) {
  const gws = data.gameweeks || [];
  const max = Math.max(...gws.map(g => g.total_goals), 1);
  const barW = Math.max(Math.floor(800 / gws.length) - 2, 6);
  const h = 140;

  return (
    <>
      <svg viewBox={`0 0 ${gws.length * (barW + 2)} ${h + 18}`} className="w-full" style={{ maxHeight: 180 }}>
        {gws.map((g, i) => {
          const barH = (g.total_goals / max) * h;
          const x = i * (barW + 2);
          const isPeak = g.gameweek === data.peak_gameweek;
          return (
            <g key={i}>
              <rect x={x} y={h - barH} width={barW} height={barH} rx={1}
                className={isPeak ? 'fill-cyan-400' : 'fill-zinc-700'} />
              {isPeak && (
                <text x={x + barW / 2} y={h - barH - 3} textAnchor="middle"
                  className="fill-cyan-400 text-[7px] font-bold">{g.total_goals}</text>
              )}
              <text x={x + barW / 2} y={h + 12} textAnchor="middle"
                className="fill-zinc-700 text-[6px]">{g.gameweek?.replace?.(/\D/g, '')}</text>
            </g>
          );
        })}
      </svg>
      {data.peak_gameweek && (
        <p className="text-center text-zinc-500 text-[10px] font-mono mt-2">
          Peak: <span className="text-cyan-400 font-bold">GW {data.peak_gameweek}</span>
        </p>
      )}
    </>
  );
}

function SingleGWView({ data }) {
  return (
    <>
      <div className="bg-zinc-900/50 rounded-lg p-4 text-center mb-4">
        <p className="text-3xl font-black text-cyan-400">{data.total_goals}</p>
        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">Total Goals · GW {data.gameweek}</p>
      </div>
      {data.matches?.length > 0 && (
        <div className="space-y-1">
          {data.matches.map((m, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-900/50 last:border-0">
              <span className="text-zinc-600 text-[10px] font-mono w-20">{m.date}</span>
              <span className="text-white text-xs flex-1 text-center">
                {m.home_team} <span className="text-cyan-400 font-bold mx-2">{m.score}</span> {m.away_team}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function GoalGlutPreview({ data }) {
  return (
    <PreviewShell
      contentType="Goal Glut"
      context={`${data.league_name} · ${data.season_label} · ${data.mode === 'single' ? `GW ${data.gameweek}` : 'Season'}`}
      fetchedAt={data._fetchedAt}
    >
      {data.mode === 'season' ? <SeasonView data={data} /> : <SingleGWView data={data} />}
    </PreviewShell>
  );
}
