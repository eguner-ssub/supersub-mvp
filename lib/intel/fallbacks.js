import { PROSE_TEMPLATES } from './templates.js';

export const GENERIC_FALLBACK = {
  available: true,
  sportmonksAvailable: false,
  sections: {},
  prose: {
    summary: 'Detailed predictions unavailable for this match. Check back closer to kickoff for lineup-based analysis.',
  },
  proseMethod: 'fallback',
};

/**
 * Generate fallback intel when Sportmonks data is unavailable.
 * Uses internal bench/coach data if available, otherwise generic message.
 */
export function generateFallbackIntel(match, internalSections) {
  const hasInternalData = Object.values(internalSections).some(s => s.available);

  if (hasInternalData) {
    const prose = {};

    if (internalSections.benchWatch?.available && internalSections.benchWatch?.data) {
      try {
        prose.benchWatch = PROSE_TEMPLATES.benchWatch({
          data: internalSections.benchWatch.data,
          homeTeam: match.home_team,
          awayTeam: match.away_team,
        });
      } catch (_) { /* skip */ }
    }

    if (internalSections.managerTendencies?.available && internalSections.managerTendencies?.data) {
      try {
        prose.managerTendencies = PROSE_TEMPLATES.managerTendencies({
          data: internalSections.managerTendencies.data,
          homeTeam: match.home_team,
          awayTeam: match.away_team,
        });
      } catch (_) { /* skip */ }
    }

    prose.summary = 'Sportmonks predictions unavailable. Here\'s what our data tells us about this match.';

    return {
      available: true,
      sportmonksAvailable: false,
      sections: internalSections,
      prose,
      proseMethod: 'fallback',
    };
  }

  return GENERIC_FALLBACK;
}
