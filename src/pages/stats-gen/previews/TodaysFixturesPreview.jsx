import React from 'react';
import { PreviewShell } from './PreviewShell';

// Match-status classification mirrors api/stats-gen/[endpoint].js logic.
// Live = INPLAY_*, HT, BREAK, ET. Finished = FT/AET/PEN/FT_PEN.
const LIVE_PREFIXES = ['INPLAY', 'HT', 'BREAK', 'ET', 'EXTRA_TIME_BREAK'];
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN', 'FT_PEN', 'FINISHED', 'AWARDED', 'ENDED']);

function statusBadge(status) {
  if (!status) return null;
  if (LIVE_PREFIXES.some(p => status.startsWith(p)) || status === '1H' || status === '2H' || status === 'P') {
    return <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400">LIVE</span>;
  }
  if (FINISHED_STATUSES.has(status)) {
    return <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-zinc-800 text-zinc-500">FT</span>;
  }
  return null;
}

function formatKickoff(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatHeaderDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function TodaysFixturesPreview({ data }) {
  const fixtures = data.fixtures || [];

  return (
    <PreviewShell
      contentType="Today's Fixtures"
      context={`${data.league_name} · ${formatHeaderDate(data.date)}`}
      fetchedAt={data._fetchedAt}
    >
      {fixtures.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-zinc-600 text-sm">No {data.league_name} fixtures today.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {fixtures.map(f => {
            const badge = statusBadge(f.status);
            return (
              <div
                key={f.id}
                className="flex items-center gap-3 py-3 px-4 bg-zinc-900/50 rounded-lg border border-zinc-900"
              >
                {/* Home */}
                <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                  <span className="text-white text-sm font-medium truncate">{f.home_team}</span>
                  {f.home_logo && <img src={f.home_logo} alt="" className="w-6 h-6 rounded object-contain flex-shrink-0" />}
                </div>

                {/* Centre — kickoff or status badge */}
                <div className="w-20 text-center flex-shrink-0">
                  {badge ?? (
                    <p className="text-cyan-400 text-xs font-mono font-bold">{formatKickoff(f.kickoff_time)}</p>
                  )}
                  <p className="text-zinc-600 text-[9px] font-bold uppercase tracking-widest mt-0.5">vs</p>
                </div>

                {/* Away */}
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  {f.away_logo && <img src={f.away_logo} alt="" className="w-6 h-6 rounded object-contain flex-shrink-0" />}
                  <span className="text-white text-sm font-medium truncate">{f.away_team}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PreviewShell>
  );
}
