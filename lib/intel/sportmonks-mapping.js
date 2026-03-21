import { INTEL_CONFIG } from '../../config/intel.js';

const { TYPE_IDS } = INTEL_CONFIG;

export const SPORTMONKS_TYPE_MAP = {
  openingCharge: {
    typeId: TYPE_IDS.FIRST_HALF_1X2,
    parse: (predictions) => ({
      home: Math.round(predictions.home),
      draw: Math.round(predictions.draw),
      away: Math.round(predictions.away),
    }),
    getInsight: (data) => {
      if (data.home >= 55) return 'home_strong';
      if (data.away > data.home) return 'away_leads';
      if (data.draw >= 35) return 'cagey_start';
      return 'balanced';
    },
  },

  commandOfPitch: {
    typeId: TYPE_IDS.FULLTIME_1X2,
    parse: (predictions) => ({
      home: Math.round(predictions.home),
      draw: Math.round(predictions.draw),
      away: Math.round(predictions.away),
    }),
    getInsight: (data) => {
      if (data.home >= 55) return 'home_clear_favorite';
      if (data.home >= 45) return 'home_slight_favorite';
      if (Math.abs(data.home - data.away) < 8) return 'coin_flip';
      if (data.away > data.home) return 'away_favorite';
      return 'balanced';
    },
  },

  scoreboardForecast: {
    typeId: TYPE_IDS.CORRECT_SCORE,
    parse: (predictions) => {
      // Sportmonks nests correct scores under a 'scores' key
      const scoreData = predictions.scores && typeof predictions.scores === 'object'
        ? predictions.scores
        : predictions;

      const scores = Object.entries(scoreData)
        .filter(([key]) => !key.startsWith('Other') && typeof scoreData[key] === 'number')
        .map(([score, prob]) => ({ score, probability: Math.round(prob) }))
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 3);

      const otherHome = (predictions.scores ? predictions['Other_1'] : scoreData['Other_1']) || 0;
      const otherAway = (predictions.scores ? predictions['Other_2'] : scoreData['Other_2']) || 0;

      return {
        topScores: scores,
        highScoringBias: (otherHome + otherAway) > 15,
      };
    },
    getInsight: (data) => {
      if (data.highScoringBias) return 'high_scoring';
      const topScore = data.topScores[0]?.score;
      if (topScore) {
        const [home, away] = topScore.split('-').map(Number);
        if (home + away <= 2) return 'low_scoring';
      }
      return 'moderate';
    },
  },

  defensiveDiscipline: {
    typeId: TYPE_IDS.BTTS,
    parse: (predictions) => ({
      bttsYes: Math.round(predictions.yes),
      bttsNo: Math.round(predictions.no),
    }),
    getInsight: (data) => {
      if (data.bttsNo >= 50) return 'clean_sheet_likely';
      if (data.bttsYes >= 65) return 'both_likely_to_score';
      return 'uncertain';
    },
  },

  attackingFirepower: {
    typeId: TYPE_IDS.HOME_OVER_15,
    parse: (predictions) => ({
      homeOver15: Math.round(predictions.yes),
    }),
    getInsight: (data) => {
      if (data.homeOver15 >= 65) return 'home_attack_strong';
      if (data.homeOver15 < 40) return 'home_attack_weak';
      return 'moderate';
    },
  },

  sustainedDominance: {
    typeId: TYPE_IDS.WIN_EITHER_HALF,
    parse: (predictions) => ({
      homeWinEitherHalf: Math.round(predictions.draw_home || predictions.home || 0),
    }),
    getInsight: (data) => {
      if (data.homeWinEitherHalf >= 70) return 'home_consistent';
      if (data.homeWinEitherHalf < 50) return 'home_inconsistent';
      return 'moderate';
    },
  },

  pitchIntensity: {
    typeId: TYPE_IDS.CORNERS_OVER_85,
    parse: (predictions) => ({
      cornersOver85: Math.round(predictions.yes),
    }),
    getInsight: (data) => {
      if (data.cornersOver85 >= 60) return 'high_tempo';
      if (data.cornersOver85 < 40) return 'low_tempo';
      return 'moderate_tempo';
    },
  },

  safetyMargin: {
    typeId: TYPE_IDS.DOUBLE_CHANCE,
    parse: (predictions) => ({
      homeOrDraw: Math.round(predictions.home),
    }),
    getInsight: (data) => {
      if (data.homeOrDraw >= 75) return 'home_safe_bet';
      if (data.homeOrDraw >= 60) return 'reasonable_safety';
      return 'risky';
    },
  },

  halftimeBlueprint: {
    typeId: TYPE_IDS.HT_FT,
    parse: (predictions) => ({
      homeHome: Math.round(predictions.home_home || 0),
    }),
    getInsight: (data) => {
      if (data.homeHome >= 40) return 'home_control_likely';
      if (data.homeHome < 20) return 'control_uncertain';
      return 'moderate';
    },
  },

  totalGoalOutlook: {
    typeId: TYPE_IDS.OVER_UNDER_25,
    parse: (predictions) => ({
      over25: Math.round(predictions.yes),
      under25: Math.round(predictions.no),
    }),
    getInsight: (data) => {
      if (data.over25 >= 65) return 'goals_expected';
      if (data.under25 >= 55) return 'cagey_affair';
      return 'balanced';
    },
  },
};

/**
 * Parse raw Sportmonks predictions response into structured sections.
 */
export function parseSportmonksResponse(rawData) {
  const sections = {};

  if (!rawData?.data || !Array.isArray(rawData.data)) {
    return sections;
  }

  // Create lookup by type_id
  const byTypeId = {};
  for (const item of rawData.data) {
    byTypeId[item.type_id] = item.predictions;
  }

  // Process each section
  for (const [sectionName, config] of Object.entries(SPORTMONKS_TYPE_MAP)) {
    const predictions = byTypeId[config.typeId];

    if (predictions) {
      const data = config.parse(predictions);
      sections[sectionName] = {
        typeId: config.typeId,
        available: true,
        data,
        insight: config.getInsight(data),
      };
    } else {
      sections[sectionName] = {
        typeId: config.typeId,
        available: false,
        data: null,
        insight: null,
      };
    }
  }

  return sections;
}
