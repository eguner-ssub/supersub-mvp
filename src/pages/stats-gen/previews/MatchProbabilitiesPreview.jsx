import React from 'react';
import { PreviewShell } from './PreviewShell';

// Match Probabilities preview (rewritten 2026-04 with the SportMonks-only
// architecture pivot — see scripts/_archived/README.md).
//
// Editorial framing only — server-generated narrative fields are rendered
// as-is. No betting language added in the UI layer (no "odds", "bet",
// "stake", "value", "tip"). Probabilities are described as "chance" or
// "probability" matching the API copy.
//
// Data shape (post-pivot):
//   { available, data_source, computed_at, partial_data, narrative_summary,
//     match_result: { home_win, draw, away_win, headline },
//     goals:        { over_2_5_probability, over_3_5_probability,
//                     home_over_1_5_probability, narrative } | null,
//     btts:         { probability, narrative }                 | null,
//     top_scorelines: [{ score, probability }, ...]    // up to 5
//     uncertainty_level: 'low' | 'moderate' | 'high'
//   }
// Or:
//   { available: false, reason: 'predictions_unavailable' }

function pct(p) {
  if (p == null || Number.isNaN(p)) return '–';
  return `${Math.round(Number(p) * 100)}%`;
}

function timeAgo(iso) {
  if (!iso) return 'unknown';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return 'unknown';
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
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

// Up to 5 entries (SportMonks typically returns 3). Wider bars than the
// previous Monte Carlo top-20 chart since fewer entries read better wider.
function ScorelineBar({ score, probability }) {
  const pctVal = Math.max(0, Math.min(100, Math.round(Number(probability || 0) * 100)));
  // Scale visual width: with up to 5 scorelines and no probability above ~25%,
  // we want the largest bar to fill most of the row. Using ×3 keeps a 17%
  // bar at ~51% width — visually substantial without spilling.
  const visualWidth = Math.max(4, pctVal * 3);
  return (
    <div className="flex items-center gap-3">
      <span className="w-12 text-zinc-200 text-sm font-mono text-right font-bold">{score}</span>
      <div className="flex-1 h-3 bg-zinc-900 rounded-full overflow-hidden">
        <div className="h-full bg-cyan-500/70 rounded-full" style={{ width: `${visualWidth}%` }} />
      </div>
      <span className="w-12 text-zinc-300 text-xs font-mono font-bold">{pctVal}%</span>
    </div>
  );
}

// Tiny inline label for missing optional sections under partial_data.
function UnavailableLabel() {
  return (
    <p className="text-zinc-600 text-[10px] italic">data unavailable</p>
  );
}

export function MatchProbabilitiesPreview({ data }) {
  // Hard unavailable state — handler returns { available: false, reason }.
  if (data.available === false) {
    const message = data.reason === 'predictions_unavailable'
      ? 'Predictions not yet available for this fixture. Check back closer to kickoff.'
      : 'Match probabilities unavailable for this fixture.';
    return (
      <PreviewShell
        contentType="Match Probabilities"
        context={`${data.home_team || '—'} v ${data.away_team || '—'}`}
        fetchedAt={data._fetchedAt}
      >
        <div className="py-10 text-center">
          <p className="text-zinc-400 text-sm">{message}</p>
        </div>
      </PreviewShell>
    );
  }

  const result = data.match_result || {};
  const goals  = data.goals;          // may be null when partial_data
  const btts   = data.btts;           // may be null when partial_data
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

      {/* Narrative summary — server prose, italicised quote block. Deliberately
          W/D/L only, never quotes a specific scoreline (handler enforces this). */}
      {data.narrative_summary && (
        <blockquote className="border-l-2 border-cyan-500/60 pl-4 py-1 mb-6">
          <p className="text-zinc-200 text-sm italic leading-relaxed">{data.narrative_summary}</p>
        </blockquote>
      )}

      {/* Match Result probability bars */}
      <section className="mb-6">
        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-3">Match Result</p>
        <div className="space-y-3">
          <ProbBar label={data.home_team} value={result.home_win} colorCls="bg-cyan-500" />
          <ProbBar label="Draw"           value={result.draw}     colorCls="bg-zinc-600" />
          <ProbBar label={data.away_team} value={result.away_win} colorCls="bg-amber-500" />
        </div>
        {result.headline && (
          <p className="text-zinc-400 text-xs mt-3 leading-relaxed">{result.headline}</p>
        )}
      </section>

      {/* Goals — over 2.5 % + narrative. expected_total no longer emitted by
          the Sportmonks-only handler; gracefully omit when null. */}
      <section className="mb-6">
        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2">Goals</p>
        {goals ? (
          <>
            <div className="bg-zinc-900/50 rounded-lg p-4 text-center mb-2">
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Over 2.5</p>
              <p className="text-cyan-400 text-3xl font-black">{pct(goals.over_2_5_probability)}</p>
            </div>
            {goals.narrative && (
              <p className="text-zinc-400 text-xs leading-relaxed">{goals.narrative}</p>
            )}
          </>
        ) : (
          <UnavailableLabel />
        )}
      </section>

      {/* BTTS */}
      <section className="mb-6 bg-zinc-900/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Both Teams to Score</p>
          {btts ? (
            <p className="text-cyan-400 text-lg font-black">{pct(btts.probability)}</p>
          ) : (
            <UnavailableLabel />
          )}
        </div>
        {btts?.narrative && (
          <p className="text-zinc-400 text-xs leading-relaxed">{btts.narrative}</p>
        )}
      </section>

      {/* Top scorelines (up to 5). When SportMonks doesn't return any, label
          the section as unavailable rather than rendering an empty card. */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Most Likely Scorelines</p>
          {data.uncertainty_level && (
            <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-zinc-900 text-zinc-400">
              {data.uncertainty_level}
            </span>
          )}
        </div>
        {scorelines.length > 0 ? (
          <div className="space-y-2.5">
            {scorelines.map((s, i) => (
              <ScorelineBar key={i} score={s.score} probability={s.probability} />
            ))}
          </div>
        ) : (
          <UnavailableLabel />
        )}
      </section>

      {/* Footer — Sportmonks-sourced; previous "10,000 simulations" copy
          removed with the Monte Carlo pivot. partial_data + uncertainty_level
          surface the data quality picture. */}
      <p className="text-zinc-600 text-[10px] mt-4 pt-3 border-t border-zinc-900">
        Predictions powered by Sportmonks · Updated {timeAgo(data.computed_at)}
        {data.partial_data && <> · <span className="text-amber-500">partial data</span></>}
      </p>
    </PreviewShell>
  );
}
