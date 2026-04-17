import React from 'react';
import { PreviewShell } from './PreviewShell';

const POS_LABELS = { 24: 'GK', 25: 'DF', 26: 'MF', 27: 'FW' };
const POS_COLORS = { 24: 'bg-amber-500/20 text-amber-400', 25: 'bg-blue-500/20 text-blue-400', 26: 'bg-emerald-500/20 text-emerald-400', 27: 'bg-red-500/20 text-red-400' };

function PositionBadge({ positionId }) {
  const label = POS_LABELS[positionId] || '??';
  const cls = POS_COLORS[positionId] || 'bg-zinc-800 text-zinc-500';
  return (
    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${cls}`}>{label}</span>
  );
}

function PlayerLine({ player }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="text-zinc-600 text-[10px] font-mono w-5 text-right">{player.shirt_number || '–'}</span>
      <PositionBadge positionId={player.position} />
      <p className="text-white text-xs truncate">{player.player_name}</p>
    </div>
  );
}

function TeamColumn({ label, starters, bench }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-3">{label}</p>
      <div className="space-y-0">
        {(starters || []).map(p => <PlayerLine key={p.player_id} player={p} />)}
      </div>
      {bench?.length > 0 && (
        <>
          <div className="border-t border-zinc-900 my-3" />
          <p className="text-zinc-600 text-[9px] font-bold uppercase tracking-widest mb-2">Bench</p>
          {bench.map(p => <PlayerLine key={p.player_id} player={p} />)}
        </>
      )}
    </div>
  );
}

export function LineupsPreview({ data }) {
  return (
    <PreviewShell
      contentType="Lineups"
      context={`${data.home_team} vs ${data.away_team}`}
      lineupConfirmed={data.lineup_confirmed}
      fetchedAt={data._fetchedAt}
    >
      <div className="flex gap-8">
        <TeamColumn label={data.home_team} starters={data.home_starters} bench={data.home_bench} />
        <div className="w-px bg-zinc-900 flex-shrink-0" />
        <TeamColumn label={data.away_team} starters={data.away_starters} bench={data.away_bench} />
      </div>
    </PreviewShell>
  );
}
