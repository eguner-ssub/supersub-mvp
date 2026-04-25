import React from 'react';
import { PreviewShell } from './PreviewShell';

// Editorial framing only — server-generated narrative fields are rendered
// as-is. No betting language added in the UI layer (no "odds", "bet",
// "stake", "value", "tip"). Probabilities are described as "chance" or
// "probability" matching the API copy.

function pct(p) {
  if (p == null || Number.isNaN(p)) return '–';
  return `${Math.round(Number(p) * 100)}%`;
}

function ProbBar({ label, value, colorCls }) {
  const pctVal = Math.max(0, Math.min(100, Math.round(Number(value || 0) * 100)));
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-zinc-400 text-xs font-medium truncate pr-2">{label}</span>
        <span className="text-white text-xs font-mono font-bold flex-shrink-0">{pctVal}%</span>
      </div>
      <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colorCls}`} style={{ width: `${pctVal}%` }} />
      </div>
    </div>
  );
}

function ScorelineBar({ score, probability }) {
  const pctVal = Math.max(0, Math.min(100, Math.round(Number(probability || 0) * 100)));
  return (
    <div className="flex items-center gap-3">
      <span className="w-12 text-zinc-300 text-sm font-mono text-right">{score}</span>
      <div className="flex-1 h-2 bg-zinc-900 rounded-full overflow-hidden">
        <div className="h-full bg-cyan-500/60 rounded-full" style={{ width: `${Math.max(2, pctVal * 4)}%` }} />
      </div>
      <span className="w-10 text-zinc-500 text-xs font-mono">{pctVal}%</span>
    </div>
  );
}

export function MatchProbabilitiesPreview({ data }) {
  // Unavailable fixture (no sim row, no intel fallback) — handler returns
  // { available: false, reason: 'no_simulation_or_intel' }.
  if (data.available === false) {
    return (
      <PreviewShell
        contentType="Match Probabilities"
        context={`${data.home_team || '—'} v ${data.away_team || '—'}`}
        fetchedAt={data._fetchedAt}
      >
        <div className="py-10 text-center">
          <p className="text-zinc-600 text-sm">Probabilities unavailable for this fixture.</p>
        </div>
      </PreviewShell>
    );
  }

  const result = data.match_result || {};
  const goals  = data.goals || {};
  const btts   = data.btts || {};
  const scorelines = (data.top_scorelines || []).slice(0, 5);

  return (
    <PreviewShell
      contentType="Match Probabilities"
      context={`${data.home_team} v ${data.away_team}`}
      fetchedAt={data._fetchedAt}
    >
      {/* Team header strip */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <div className="flex items-center gap-2 flex-1 justify-end">
          <span className="text-white text-sm font-medium">{data.home_team}</span>
          {data.home_logo && <img src={data.home_logo} alt="" className="w-7 h-7 rounded object-contain" />}
        </div>
        <span className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">v</span>
        <div className="flex items-center gap-2 flex-1">
          {data.away_logo && <img src={data.away_logo} alt="" className="w-7 h-7 rounded object-contain" />}
          <span className="text-white text-sm font-medium">{data.away_team}</span>
        </div>
      </div>

      {/* Narrative summary — server prose, italicised quote block */}
      {data.narrative_summary && (
        <blockquote className="border-l-2 border-cyan-500/60 pl-4 py-1 mb-6">
          <p className="text-zinc-200 text-sm italic leading-relaxed">{data.narrative_summary}</p>
        </blockquote>
      )}

      {/* Match Result probability bars */}
      <section className="mb-6">
        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-3">Match Result</p>
        <div className="space-y-3">
          <ProbBar label={data.home_team}    value={result.home_win} colorCls="bg-cyan-500" />
          <ProbBar label="Draw"              value={result.draw}     colorCls="bg-zinc-600" />
          <ProbBar label={data.away_team}    value={result.away_win} colorCls="bg-amber-500" />
        </div>
        {result.headline && (
          <p className="text-zinc-400 text-xs mt-3 leading-relaxed">{result.headline}</p>
        )}
      </section>

      {/* Goals — large expected_total + over 2.5 % + narrative */}
      <section className="mb-6 grid grid-cols-2 gap-4">
        <div className="bg-zinc-900/50 rounded-lg p-4 text-center">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Expected Goals</p>
          <p className="text-white text-3xl font-black">
            {goals.expected_total != null ? Number(goals.expected_total).toFixed(1) : '–'}
          </p>
        </div>
        <div className="bg-zinc-900/50 rounded-lg p-4 text-center">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Over 2.5</p>
          <p className="text-cyan-400 text-3xl font-black">{pct(goals.over_2_5_probability)}</p>
        </div>
      </section>
      {goals.narrative && (
        <p className="text-zinc-400 text-xs mb-6 leading-relaxed">{goals.narrative}</p>
      )}

      {/* BTTS */}
      <section className="mb-6 bg-zinc-900/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Both Teams to Score</p>
          <p className="text-cyan-400 text-lg font-black">{pct(btts.probability)}</p>
        </div>
        {btts.narrative && (
          <p className="text-zinc-400 text-xs leading-relaxed">{btts.narrative}</p>
        )}
      </section>

      {/* Top 5 scorelines */}
      {scorelines.length > 0 && (
        <section className="mb-6">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-3">Most Likely Scorelines</p>
          <div className="space-y-2">
            {scorelines.map((s, i) => (
              <ScorelineBar key={i} score={s.score} probability={s.probability} />
            ))}
          </div>
        </section>
      )}

      {/* Footer — sim count + uncertainty bucket */}
      <p className="text-zinc-600 text-[10px] mt-4 pt-3 border-t border-zinc-900">
        Based on {data.simulation_count?.toLocaleString() || '10,000'} simulations
        {data.uncertainty_level && <> · uncertainty: <span className="text-zinc-500">{data.uncertainty_level}</span></>}
        {data.simulation_pending && <> · <span className="text-amber-500">cached fallback</span></>}
      </p>
    </PreviewShell>
  );
}
