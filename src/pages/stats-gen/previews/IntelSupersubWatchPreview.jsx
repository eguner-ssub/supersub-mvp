import React from 'react';
import {
  MatchHeader, JosebaByline, IntelUnavailable,
  SECTION_TITLE_CLS,
} from './IntelShell';

const DATA_SOURCE_CONFIG = {
  confirmed_xi: {
    label: 'Confirmed XI',
    className: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    tooltip: 'Source: confirmed team sheets released ~1 hour before kick-off. These are the actual bench players available today.',
  },
  cached_top_supersubs: {
    label: 'Top Season Subs',
    className: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
    tooltip: 'Source: season-to-date supersub stats (lineups not yet confirmed). Shows the most dangerous subs based on their recent form — actual bench availability may differ.',
  },
};

function TeamBlock({ label, items }) {
  if (!items.length) return null;
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2">{label}</p>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-baseline justify-between py-1.5 px-3 bg-zinc-900/50 rounded-md">
            <span className="text-white text-sm font-medium truncate">{item.playerName}</span>
            <span className="text-zinc-400 text-xs font-mono flex-shrink-0 ml-3">
              <span className="text-cyan-400 font-bold">{item.goalsAsSub}</span>
              <span className="text-zinc-600"> goals · </span>
              <span className="text-cyan-400 font-bold">{item.goalsPer90AsSub}</span>
              <span className="text-zinc-600">/90</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function IntelSupersubWatchPreview({ data }) {
  if (data?.dataStatus === 'unavailable') {
    return <IntelUnavailable match={data.match} generatedAt={data.generatedAt} reason={data.reason} />;
  }

  const items = data.content?.items || [];
  const dataSource = data.content?.dataSource || 'cached_top_supersubs';
  const sourceCfg = DATA_SOURCE_CONFIG[dataSource] || DATA_SOURCE_CONFIG.cached_top_supersubs;

  const homeItems = items.filter(i => i.team === 'home');
  const awayItems = items.filter(i => i.team === 'away');
  const homeTeamName = homeItems[0]?.teamName || data.match?.homeTeam;
  const awayTeamName = awayItems[0]?.teamName || data.match?.awayTeam;

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6">
      <MatchHeader match={data.match} />

      <div className="flex items-center justify-between mb-4">
        <p className={SECTION_TITLE_CLS + ' mb-0'}>Supersub Watch</p>
        <span
          className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${sourceCfg.className}`}
          title={sourceCfg.tooltip}
        >
          {sourceCfg.label}
        </span>
      </div>

      <TeamBlock label={homeTeamName} items={homeItems} />
      <TeamBlock label={awayTeamName} items={awayItems} />

      <JosebaByline generatedAt={data.generatedAt} />
    </div>
  );
}
