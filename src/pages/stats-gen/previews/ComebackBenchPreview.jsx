import React from 'react';
import { PreviewShell } from './PreviewShell';

function MatchCard({ match }) {
  return (
    <div className="bg-zinc-900/50 rounded-lg p-4 mb-3 last:mb-0">
      {/* Match header */}
      <div className="flex items-center gap-3 mb-3">
        {match.home_team_badge_url && <img src={match.home_team_badge_url} alt="" className="w-6 h-6 rounded object-contain" />}
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-bold">{match.match_title}</p>
          <p className="text-zinc-600 text-[10px] font-mono">{match.match_date}</p>
        </div>
        {match.away_team_badge_url && <img src={match.away_team_badge_url} alt="" className="w-6 h-6 rounded object-contain" />}
      </div>

      {/* Score transformation */}
      <div className="flex items-center justify-center gap-3 mb-3 py-2">
        <span className="text-red-400 text-lg font-bold font-mono">{match.score_at_concession}</span>
        <span className="text-zinc-600 text-xs">→</span>
        <span className="text-emerald-400 text-lg font-bold font-mono">{match.final_score}</span>
        <span className="text-zinc-600 text-[10px] ml-2">comeback at {match.comeback_minute}'</span>
      </div>

      {/* Key sub players */}
      {match.key_sub_players?.length > 0 && (
        <div className="border-t border-zinc-800 pt-2">
          <p className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest mb-1">Key Subs</p>
          {match.key_sub_players.map((p, i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <span className="text-white text-xs">{p.player_name} <span className="text-zinc-600 text-[10px]">on {p.entry_minute}'</span></span>
              <span className="text-cyan-400 text-xs font-bold">{p.goals_scored} goal{p.goals_scored !== 1 ? 's' : ''}</span>
            </div>
          ))}
          <p className="text-zinc-500 text-[10px] mt-1">Total sub contribution: <span className="text-cyan-400 font-bold">{match.total_sub_contribution}</span></p>
        </div>
      )}
    </div>
  );
}

export function ComebackBenchPreview({ data }) {
  const matches = data.matches || [];

  return (
    <PreviewShell
      contentType="Comeback Bench"
      context={`${matches.length} comeback${matches.length !== 1 ? 's' : ''} found`}
      fetchedAt={data._fetchedAt}
    >
      {matches.length > 0 ? (
        matches.map((m, i) => <MatchCard key={i} match={m} />)
      ) : (
        <p className="text-zinc-600 text-sm text-center py-8">No bench-driven comebacks found for this selection.</p>
      )}
    </PreviewShell>
  );
}
