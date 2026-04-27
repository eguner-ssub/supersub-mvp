import React from 'react';

// Coverage badge + explainer rendered below the team table in Title Race
// and Relegation Race previews. Surfaces the "this league only has N of M
// fixtures sampled" reality so a 100% title probability with sparse coverage
// doesn't look misleading.
//
// Hidden entirely when coverage is "Complete" or coverage is null (handler
// returns null when sim:seasons hasn't run since migration 064).

const BADGE_STYLES = {
  Sparse:  'bg-red-500/15    text-red-400    border-red-500/30',
  Limited: 'bg-amber-500/15  text-amber-400  border-amber-500/30',
  Good:    'bg-cyan-500/15   text-cyan-400   border-cyan-500/30',
};

export function CoverageNotice({ coverage }) {
  if (!coverage) return null;
  if (coverage.completeness_label === 'Complete') return null;

  const badgeCls = BADGE_STYLES[coverage.completeness_label] ?? BADGE_STYLES.Limited;

  return (
    <div className="mt-4 pt-3 border-t border-zinc-900">
      <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${badgeCls}`}>
        {coverage.completeness_label} Coverage
      </span>
      <p className="text-zinc-500 text-[11px] mt-2 leading-relaxed">
        {coverage.completeness_explainer}
      </p>
    </div>
  );
}
