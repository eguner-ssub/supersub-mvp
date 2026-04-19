// GET /api/stats-gen/intel-supersub-watch?fixture_id=X
// Thin wrapper over /api/intel — surfaces the supersubWatch items.
//
// dataSource is derived from analysis.greetingContext:
//   'confirmed_xi' → lineups are published (~1h pre-KO), items are real bench
//   otherwise      → items are cached top season subs (the intel generation
//                    snapshot, stored on match_intel.{home,away}_top_supersubs)

import { runIntelHandler } from './_intelBase.js';

export default async function handler(req, res) {
  return runIntelHandler(req, res, {
    type: 'intel-supersub-watch',
    buildContent({ analysis }) {
      const ssw = analysis?.supersubWatch || { available: false, items: [] };
      const items = Array.isArray(ssw.items) ? ssw.items : [];
      const dataSource = analysis?.greetingContext === 'confirmed_xi'
        ? 'confirmed_xi'
        : 'cached_top_supersubs';

      if (!ssw.available || items.length === 0) {
        return {
          content: { items: [], dataSource },
          dataStatus: 'unavailable',
        };
      }

      return {
        content: { items, dataSource },
        dataStatus: 'ok',
      };
    },
  });
}
