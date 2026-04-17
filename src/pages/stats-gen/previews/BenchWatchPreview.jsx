import React from 'react';
import { PreviewShell } from './PreviewShell';

const THREAT_COLORS = { high: 'bg-emerald-400', medium: 'bg-amber-400', low: 'bg-red-400' };

function PlayerRow({ player, rank }) {
  const maxGoals = 10; // rough scale for bar width
  const barPct = Math.min((player.sub_goals_season / maxGoals) * 100, 100);

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-zinc-600 text-[10px] font-mono w-4 text-right">{rank}</span>
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${THREAT_COLORS[player.threat_level] || 'bg-zinc-700'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-medium truncate">{player.player_name}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 bg-zinc-900 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-500/40 rounded-full" style={{ width: `${barPct}%` }} />
          </div>
          <span className="text-cyan-400 text-[10px] font-mono w-6 text-right">{player.sub_goals_season}</span>
          <span className="text-zinc-600 text-[10px] font-mono w-10 text-right">{player.goals_per_90_sub}/90</span>
        </div>
      </div>
    </div>
  );
}

function TeamColumn({ label, players }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-3">{label}</p>
      {players?.length > 0 ? (
        players.map((p, i) => <PlayerRow key={p.player_id} player={p} rank={i + 1} />)
      ) : (
        <p className="text-zinc-700 text-xs">No bench data</p>
      )}
    </div>
  );
}

export function BenchWatchPreview({ data }) {
  return (
    <PreviewShell
      contentType="Bench Watch"
      context={`${data.home_team} vs ${data.away_team}`}
      lineupConfirmed={data.lineup_confirmed}
      fetchedAt={data._fetchedAt}
    >
      <div className="flex gap-8">
        <TeamColumn label={data.home_team} players={data.home_bench} />
        <div className="w-px bg-zinc-900 flex-shrink-0" />
        <TeamColumn label={data.away_team} players={data.away_bench} />
      </div>
    </PreviewShell>
  );
}
