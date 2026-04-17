import React from 'react';
import { PreviewShell } from './PreviewShell';

function StatBlock({ label, value, accent = false }) {
  return (
    <div className="flex-1 text-center">
      <p className={`text-3xl font-black ${accent ? 'text-cyan-400' : 'text-white'}`}>{value}</p>
      <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">{label}</p>
    </div>
  );
}

export function H2HPreview({ data }) {
  const total = (data.home_wins || 0) + (data.draws || 0) + (data.away_wins || 0);

  return (
    <PreviewShell
      contentType="Head to Head"
      context={`${data.home_team} vs ${data.away_team}`}
      fetchedAt={data._fetchedAt}
    >
      {/* Stat row */}
      <div className="flex items-center gap-4 mb-6 py-4 bg-zinc-900/50 rounded-lg px-4">
        <StatBlock label={data.home_team} value={data.home_wins} accent />
        <StatBlock label="Draws" value={data.draws} />
        <StatBlock label={data.away_team} value={data.away_wins} accent />
      </div>

      {total > 0 && (
        <p className="text-zinc-600 text-[10px] font-mono text-center mb-4">
          {total} meeting{total !== 1 ? 's' : ''} on record
        </p>
      )}

      {/* Recent scorelines */}
      {data.recent_matches?.length > 0 && (
        <div className="space-y-2">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2">Recent Meetings</p>
          {data.recent_matches.map((m, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-900/50 last:border-0">
              <span className="text-zinc-600 text-[10px] font-mono w-20">{m.date}</span>
              <span className="text-white text-xs flex-1 text-center">
                {m.home_team} <span className="text-cyan-400 font-bold mx-2">{m.score}</span> {m.away_team}
              </span>
            </div>
          ))}
        </div>
      )}
    </PreviewShell>
  );
}
