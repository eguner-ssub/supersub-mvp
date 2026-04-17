import React from 'react';
import { PreviewShell } from './PreviewShell';

function Metric({ label, value, unit }) {
  return (
    <div className="bg-zinc-900/50 rounded-lg p-4 text-center">
      <p className="text-2xl font-black text-cyan-400">
        {value}{unit && <span className="text-lg text-zinc-500 ml-0.5">{unit}</span>}
      </p>
      <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">{label}</p>
    </div>
  );
}

export function AnalyticsPreview({ data }) {
  return (
    <PreviewShell
      contentType="Analytics"
      context={`${data.league_name} · ${data.season_label}`}
      fetchedAt={data._fetchedAt}
    >
      <div className="grid grid-cols-3 gap-3 mb-3">
        <Metric label="Total Goals" value={data.total_goals_season} />
        <Metric label="Sub Goals" value={data.total_sub_goals} />
        <Metric label="Sub Goal %" value={data.sub_goal_percentage} unit="%" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Metric label="Sub Goals / Match" value={data.sub_goals_per_match} />
        <Metric label="Matches Played" value={data.matches_played} />
      </div>
    </PreviewShell>
  );
}
