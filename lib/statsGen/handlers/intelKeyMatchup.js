// GET /api/stats-gen/intel-key-matchup?fixture_id=X
// Thin wrapper over /api/intel — extracts the "Key Matchup" section prose.

import { runIntelHandler, getSection, isPlaceholderProse } from './_intelBase.js';

export default async function handler(req, res) {
  return runIntelHandler(req, res, {
    type: 'intel-key-matchup',
    buildContent({ analysis }) {
      const section = getSection(analysis, 'Key Matchup');
      const prose = section?.content || '';
      return {
        content: { prose },
        dataStatus: !prose || isPlaceholderProse(prose) ? 'unavailable' : 'ok',
      };
    },
  });
}
