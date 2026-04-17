import React from 'react';
import { PreviewShell } from './PreviewShell';

const STATUS_STYLES = {
  UNUSED: 'bg-red-500/15 text-red-400',
  LOW_MINUTES: 'bg-amber-500/15 text-amber-400',
};

function StatusPill({ status, minutes }) {
  if (status === 'UNUSED') {
    return <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md ${STATUS_STYLES.UNUSED}`}>Unused</span>;
  }
  if (status === 'LOW_MINUTES') {
    return <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md ${STATUS_STYLES.LOW_MINUTES}`}>{minutes}' Low</span>;
  }
  return <span className="text-zinc-400 text-[9px] font-mono">{minutes}'</span>;
}

export function WastedBenchPreview({ data }) {
  if (data.available === false) {
    return (
      <PreviewShell contentType="Wasted Bench" context={data.reason || 'Not available'} fetchedAt={data._fetchedAt}>
        <p className="text-zinc-600 text-sm text-center py-8">
          {data.reason === 'match_not_finished' ? 'Match not finished yet.' : 'Data not available.'}
        </p>
      </PreviewShell>
    );
  }

  return (
    <PreviewShell
      contentType="Wasted Bench"
      context={data.team_name}
      fetchedAt={data._fetchedAt}
    >
      <div className="space-y-1">
        {(data.bench_players || []).map((p, i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-900/50 last:border-0">
            <div className="flex items-center gap-2">
              <span className="text-zinc-600 text-[10px] font-mono w-4 text-right">{i + 1}</span>
              <p className="text-white text-xs">{p.player_name}</p>
            </div>
            <StatusPill status={p.status} minutes={p.minutes_played} />
          </div>
        ))}
      </div>
    </PreviewShell>
  );
}
