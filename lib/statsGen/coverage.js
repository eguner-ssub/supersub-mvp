// Shared helper for /api/stats-gen/title-probabilities and
// /api/stats-gen/relegation-probabilities. Both endpoints surface the same
// per-(league,season) coverage metadata to let the FE render a "Limited
// Coverage" badge when the season simulation only sampled a small fraction
// of remaining fixtures.
//
// Coverage is populated by scripts/run-season-simulations.js — see
// supabase/migrations/064_create_season_simulation_coverage.sql.

const COMPLETENESS_THRESHOLDS = [
  { min: 80, label: 'Complete' },
  { min: 50, label: 'Good'     },
  { min: 20, label: 'Limited'  },
  { min: 0,  label: 'Sparse'   },
];

function pickLabel(pct) {
  for (const t of COMPLETENESS_THRESHOLDS) {
    if (pct >= t.min) return t.label;
  }
  return 'Sparse';
}

// Explainer copy varies by completeness bucket so the wording feels natural
// at each level. Templated from the actual counts so the user gets concrete
// numbers, not just a vague "limited" label.
function buildExplainer(label, { remaining, sampled, skipped }) {
  switch (label) {
    case 'Complete':
      return `Predictions available for ${sampled} of ${remaining} remaining fixtures.`;
    case 'Good':
      return `${sampled} of ${remaining} remaining fixtures have predictions. Coverage will widen as more fixtures enter the intel window.`;
    case 'Limited':
      return `${skipped} of ${remaining} remaining fixtures don't yet have predictions. The intel window covers the next 14 days; coverage will widen as the season progresses.`;
    case 'Sparse':
    default:
      return `Only ${sampled} of ${remaining} remaining fixtures have predictions yet. Title race probabilities will be more reliable closer to season end.`;
  }
}

/**
 * Fetch the coverage row for a (league, season) and return the API-shaped
 * coverage block. Returns null if no row exists yet (e.g. sim:seasons hasn't
 * run since the table was added) — handlers can decide how to fall back.
 */
export async function getCoverageBlock(supabase, leagueSmId, seasonSmId) {
  const { data } = await supabase
    .from('season_simulation_coverage')
    .select('remaining_fixtures, sampled_fixtures, skipped_fixtures, coverage_percentage')
    .eq('league_id', leagueSmId)
    .eq('season_id', seasonSmId)
    .maybeSingle();
  if (!data) return null;

  const remaining = data.remaining_fixtures || 0;
  const sampled   = data.sampled_fixtures   || 0;
  const skipped   = data.skipped_fixtures   || 0;
  const pct       = Number(data.coverage_percentage) || 0;
  const label     = pickLabel(pct);

  return {
    remaining_fixtures:    remaining,
    sampled_fixtures:      sampled,
    skipped_fixtures:      skipped,
    coverage_percentage:   pct,
    completeness_label:    label,
    completeness_explainer: buildExplainer(label, { remaining, sampled, skipped }),
  };
}

// Exported for unit tests.
export const __testables = { pickLabel, buildExplainer };
