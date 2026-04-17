import React from 'react';
import { PreviewShell } from './PreviewShell';

function StatRow({ label, value, unit }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-900/50">
      <span className="text-zinc-400 text-xs">{label}</span>
      <span className="text-cyan-400 text-sm font-bold font-mono">
        {value}{unit && <span className="text-zinc-600 text-[10px] ml-1">{unit}</span>}
      </span>
    </div>
  );
}

export function RefereeWatchPreview({ data }) {
  if (data.referee_available === false) {
    return (
      <PreviewShell contentType="Referee Watch" context="No referee assigned" fetchedAt={data._fetchedAt}>
        <p className="text-zinc-600 text-sm text-center py-8">
          Referee data not available for this fixture.
        </p>
      </PreviewShell>
    );
  }

  return (
    <PreviewShell
      contentType="Referee Watch"
      context={data.referee_name}
      fetchedAt={data._fetchedAt}
    >
      <div className="mb-6">
        <StatRow label="Matches This Season" value={data.matches_officiated_season} />
        <StatRow label="Avg Goals / Match" value={data.avg_goals_per_match} />
        <StatRow label="Avg Cards / Match" value={data.avg_cards_per_match} />
        <StatRow label="Penalties / Match" value={data.penalties_per_match} />
      </div>

      {data.recent_fixtures?.length > 0 && (
        <div>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2">Recent Fixtures</p>
          {data.recent_fixtures.map((f, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-900/50 last:border-0">
              <span className="text-zinc-600 text-[10px] font-mono w-20">{f.date}</span>
              <span className="text-white text-xs flex-1 text-center">
                {f.home} <span className="text-cyan-400 font-bold mx-2">{f.score}</span> {f.away}
              </span>
            </div>
          ))}
        </div>
      )}
    </PreviewShell>
  );
}
