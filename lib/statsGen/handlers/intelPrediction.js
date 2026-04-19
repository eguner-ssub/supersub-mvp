// GET /api/stats-gen/intel-prediction?fixture_id=X
// Thin wrapper over /api/intel — extracts the "Prediction" section prose.

import { runIntelHandler, getSection, isPlaceholderProse } from './_intelBase.js';

export default async function handler(req, res) {
  return runIntelHandler(req, res, {
    type: 'intel-prediction',
    buildContent({ analysis }) {
      const section = getSection(analysis, 'Prediction');
      const prose = section?.content || '';
      return {
        content: { prose },
        dataStatus: !prose || isPlaceholderProse(prose) ? 'unavailable' : 'ok',
      };
    },
  });
}
