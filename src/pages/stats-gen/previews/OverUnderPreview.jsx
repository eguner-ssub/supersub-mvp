import React from 'react';
import { PreviewShell } from './PreviewShell';

export function OverUnderPreview({ data }) {
  return (
    <PreviewShell
      contentType="Over/Under Split"
      context={`${data.home_team} vs ${data.away_team}`}
      fetchedAt={data._fetchedAt}
    >
      {/* Large O/U percentages */}
      <div className="flex items-center gap-6 mb-4">
        <div className="flex-1 text-center py-6 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
          <p className="text-4xl font-black text-emerald-400">{data.home_over_pct}%</p>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">{data.home_team} Over 2.5</p>
        </div>
        <div className="flex-1 text-center py-6 bg-red-500/5 border border-red-500/10 rounded-lg">
          <p className="text-4xl font-black text-red-400">{data.home_under_pct}%</p>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">{data.home_team} Under 2.5</p>
        </div>
      </div>

      <div className="flex items-center gap-6 mb-6">
        <div className="flex-1 text-center py-6 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
          <p className="text-4xl font-black text-emerald-400">{data.away_over_pct}%</p>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">{data.away_team} Over 2.5</p>
        </div>
        <div className="flex-1 text-center py-6 bg-red-500/5 border border-red-500/10 rounded-lg">
          <p className="text-4xl font-black text-red-400">{data.away_under_pct}%</p>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">{data.away_team} Under 2.5</p>
        </div>
      </div>

      <p className="text-zinc-600 text-[10px] font-mono text-center mb-4">
        Sample: {data.sample_size} matches per team
      </p>

      {/* Recent scorelines */}
      <div className="grid grid-cols-2 gap-6">
        {[
          { label: `${data.home_team} Recent`, scores: data.recent_home_scores },
          { label: `${data.away_team} Recent`, scores: data.recent_away_scores },
        ].map(({ label, scores }) => (
          <div key={label}>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2">{label}</p>
            {(scores || []).slice(0, 5).map((s, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-zinc-900/50 last:border-0">
                <span className="text-zinc-600 text-[10px] font-mono">{s.date}</span>
                <span className="text-cyan-400 text-xs font-bold">{s.score}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </PreviewShell>
  );
}
