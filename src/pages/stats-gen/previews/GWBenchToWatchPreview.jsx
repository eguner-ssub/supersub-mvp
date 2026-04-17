import React from 'react';
import { PreviewShell } from './PreviewShell';

function SecondaryCard({ player }) {
  return (
    <div className="bg-zinc-900/50 rounded-lg p-3 flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-1">
        {player.badge_url && <img src={player.badge_url} alt="" className="w-4 h-4 rounded object-contain" />}
        <p className="text-white text-xs font-medium truncate">{player.player_name}</p>
      </div>
      <p className="text-zinc-500 text-[10px]">{player.team_name}</p>
      <p className="text-cyan-400 text-sm font-bold mt-1">{player.sub_goals} sub goal{player.sub_goals !== 1 ? 's' : ''}</p>
      <p className="text-zinc-600 text-[10px] mt-0.5">{player.insight}</p>
    </div>
  );
}

export function GWBenchToWatchPreview({ data }) {
  const hasFeatured = !!data.featured_player_name;

  return (
    <PreviewShell
      contentType="GW Bench to Watch"
      context={`Gameweek ${data.gameweek}`}
      fetchedAt={data._fetchedAt}
    >
      {hasFeatured ? (
        <>
          {/* Featured player hero */}
          <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-lg p-5 mb-4">
            <div className="flex items-center gap-3 mb-3">
              {data.featured_player_badge_url && (
                <img src={data.featured_player_badge_url} alt="" className="w-8 h-8 rounded object-contain" />
              )}
              <div>
                <p className="text-white text-lg font-black">{data.featured_player_name}</p>
                <p className="text-zinc-400 text-xs">{data.featured_player_team}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-cyan-400 text-2xl font-black">{data.featured_player_sub_goals}</p>
                <p className="text-zinc-500 text-[9px] uppercase tracking-widest">Sub Goals</p>
              </div>
            </div>
            <p className="text-zinc-400 text-xs">{data.featured_player_insight}</p>
            {data.upcoming_match_title && (
              <div className="mt-3 pt-3 border-t border-cyan-500/10">
                <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Next Match</p>
                <p className="text-white text-xs mt-1">{data.upcoming_match_title}</p>
              </div>
            )}
          </div>

          {/* Secondary players */}
          {data.secondary_players?.length > 0 && (
            <div className="flex gap-3">
              {data.secondary_players.map((p, i) => <SecondaryCard key={i} player={p} />)}
            </div>
          )}
        </>
      ) : (
        <p className="text-zinc-600 text-sm text-center py-8">No notable sub-scorers found for this gameweek window.</p>
      )}
    </PreviewShell>
  );
}
