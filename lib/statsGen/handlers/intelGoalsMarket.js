// GET /api/stats-gen/intel-goals-market?fixture_id=X
// Thin wrapper over /api/intel — extracts the "Goals Market" section prose.

import { runIntelHandler, getSection, isPlaceholderProse } from './_intelBase.js';

export default async function handler(req, res) {
  return runIntelHandler(req, res, {
    type: 'intel-goals-market',
    buildContent({ analysis }) {
      const section = getSection(analysis, 'Goals Market');
      const prose = section?.content || '';
      return {
        content: { prose },
        dataStatus: !prose || isPlaceholderProse(prose) ? 'unavailable' : 'ok',
      };
    },
  });
}
