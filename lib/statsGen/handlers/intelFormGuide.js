// GET /api/stats-gen/intel-form-guide?fixture_id=X
// Thin wrapper over /api/intel — extracts the "Form Guide" section prose.

import { runIntelHandler, getSection, isPlaceholderProse } from './_intelBase.js';

export default async function handler(req, res) {
  return runIntelHandler(req, res, {
    type: 'intel-form-guide',
    buildContent({ analysis }) {
      const section = getSection(analysis, 'Form Guide');
      const prose = section?.content || '';
      return {
        content: { prose },
        dataStatus: !prose || isPlaceholderProse(prose) ? 'unavailable' : 'ok',
      };
    },
  });
}
