// Shared shell for the 5 intel-sourced previews. Match header + cyan
// section title + Joseba attribution byline + timestamp. Used by
// IntelFormGuide/KeyMatchup/GoalsMarket/Prediction/SupersubWatch previews.

import React from 'react';

function formatKickoff(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatTimestamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export function MatchHeader({ match }) {
  if (!match) return null;
  return (
    <div className="flex items-center justify-between gap-3 pb-4 border-b border-zinc-900 mb-4">
      <div className="flex items-center gap-3 min-w-0">
        {match.homeLogo && (
          <img src={match.homeLogo} alt="" className="w-7 h-7 rounded object-contain flex-shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-white text-sm font-bold truncate">
            {match.homeTeam} <span className="text-zinc-600 font-normal mx-1">vs</span> {match.awayTeam}
          </p>
          <p className="text-zinc-500 text-[10px] mt-0.5">
            {match.leagueName ? `${match.leagueName} · ` : ''}{formatKickoff(match.kickoffTime)}
          </p>
        </div>
        {match.awayLogo && (
          <img src={match.awayLogo} alt="" className="w-7 h-7 rounded object-contain flex-shrink-0 ml-auto" />
        )}
      </div>
    </div>
  );
}

export function JosebaByline({ generatedAt }) {
  return (
    <div className="flex items-center gap-2 mt-5 pt-4 border-t border-zinc-900/60">
      <img
        src="/assets/assistant-head.png"
        alt=""
        className="w-6 h-6 rounded-full object-cover border border-zinc-800 flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-zinc-400 text-[10px] font-bold">
          Tactical Intel from Joseba
        </p>
        {generatedAt && (
          <p className="text-zinc-600 text-[9px] font-mono mt-0.5">
            As of {formatTimestamp(generatedAt)}
          </p>
        )}
      </div>
    </div>
  );
}

export function IntelUnavailable({ match, generatedAt, reason }) {
  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6">
      <MatchHeader match={match} />
      <p className="text-zinc-600 text-sm text-center py-8">
        {reason === 'intel_window_closed'
          ? 'Pre-match intel is no longer available — inside the final hour before kick-off.'
          : 'Intel unavailable for this match.'}
      </p>
      <JosebaByline generatedAt={generatedAt} />
    </div>
  );
}

// Cyan matches the briefing sheet accent (#00e5ff, tailwind cyan-400 is close).
export const SECTION_TITLE_CLS =
  "text-cyan-400 text-[10px] font-black uppercase tracking-widest mb-2";
export const SECTION_PROSE_CLS =
  "text-white/80 text-sm leading-relaxed font-medium";
