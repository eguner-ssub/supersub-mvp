import { INTEL_CONFIG } from '../../config/intel.js';

const { THRESHOLDS } = INTEL_CONFIG;

export const PROSE_TEMPLATES = {

  openingCharge: ({ data, homeTeam, awayTeam }) => {
    const { home, draw, away } = data;

    if (home >= 55) {
      return `${homeTeam} are primed to strike early, with a ${home}% probability of leading at the break.`;
    } else if (home >= 45) {
      return `${homeTeam} have a decent shot at a halftime lead (${home}%), though this could go either way.`;
    } else if (away > home) {
      return `${awayTeam} might steal an early advantage — ${away}% to lead at halftime.`;
    } else {
      return `The first half looks evenly matched. ${home}% chance ${homeTeam} lead at the break.`;
    }
  },

  commandOfPitch: ({ data, homeTeam, awayTeam }) => {
    const { home, draw, away } = data;

    if (home >= THRESHOLDS.STRONG_FAVORITE) {
      return `${homeTeam} are strong favorites at ${home}%. ${awayTeam} face an uphill battle.`;
    } else if (away >= THRESHOLDS.STRONG_FAVORITE) {
      return `${awayTeam} are heavy road favorites at ${away}%. ${homeTeam} face a tough task.`;
    } else if (home >= THRESHOLDS.SLIGHT_FAVORITE) {
      return `${homeTeam} are slight favorites at ${home}%, though ${awayTeam}'s ${away}% keeps this competitive.`;
    } else if (away >= THRESHOLDS.SLIGHT_FAVORITE) {
      return `${awayTeam} are road favorites at ${away}%. ${homeTeam} will need to upset the odds.`;
    } else if (Math.abs(home - away) < 8) {
      return `This is a coin flip — ${homeTeam} at ${home}% vs ${awayTeam} at ${away}%.`;
    } else if (away > home) {
      return `${awayTeam} hold a slight edge at ${away}% despite playing away. ${homeTeam} at ${home}%.`;
    } else {
      return `${homeTeam} hold a marginal home advantage at ${home}% vs ${awayTeam}'s ${away}%.`;
    }
  },

  scoreboardForecast: ({ data, homeTeam, awayTeam }) => {
    const { topScores, highScoringBias } = data;

    if (!topScores || !topScores.length) {
      return `Scoreline predictions unavailable for this match.`;
    }

    const [first, second] = topScores;
    let prose = `The most likely outcome is ${first.score} (${first.probability}%)`;

    if (second) {
      prose += `, followed by ${second.score} (${second.probability}%)`;
    }
    prose += '.';

    if (highScoringBias) {
      prose += ` There's a notable chance of a high-scoring affair.`;
    }

    return prose;
  },

  defensiveDiscipline: ({ data, homeTeam, awayTeam }) => {
    const { bttsYes, bttsNo } = data;

    if (bttsNo >= 50) {
      return `At least one defense should hold firm — ${bttsNo}% chance of a clean sheet in this match.`;
    } else if (bttsYes >= THRESHOLDS.HIGH_BTTS) {
      return `Both defenses may struggle here — ${bttsYes}% chance both teams find the net.`;
    } else {
      return `BTTS is a toss-up at ${bttsYes}%. Could go either way.`;
    }
  },

  attackingFirepower: ({ data, homeTeam }) => {
    const { homeOver15 } = data;

    if (homeOver15 >= THRESHOLDS.HIGH_GOALS) {
      return `${homeTeam}'s attack looks potent with a ${homeOver15}% probability of scoring 2+ goals.`;
    } else if (homeOver15 >= 50) {
      return `${homeTeam} have a reasonable ${homeOver15}% chance of hitting 2+ goals.`;
    } else {
      return `${homeTeam} may struggle to score multiple — only ${homeOver15}% to hit 2+ goals.`;
    }
  },

  sustainedDominance: ({ data, homeTeam }) => {
    const { homeWinEitherHalf } = data;

    if (homeWinEitherHalf >= 70) {
      return `Expect ${homeTeam} to control at least one half — ${homeWinEitherHalf}% to win either the first or second period.`;
    } else if (homeWinEitherHalf >= 55) {
      return `${homeTeam} have a solid ${homeWinEitherHalf}% chance of winning at least one half.`;
    } else {
      return `${homeTeam} may struggle to dominate either half (${homeWinEitherHalf}%).`;
    }
  },

  pitchIntensity: ({ data }) => {
    const { cornersOver85 } = data;

    if (cornersOver85 >= 60) {
      return `High tempo expected — ${cornersOver85}% chance of 9+ corners suggests plenty of wing play and pressure.`;
    } else if (cornersOver85 >= 45) {
      return `Moderate tempo expected — ${cornersOver85}% chance of 9+ corners.`;
    } else {
      return `A slower-paced affair is likely — only ${cornersOver85}% chance of 9+ corners.`;
    }
  },

  safetyMargin: ({ data, homeTeam }) => {
    const { homeOrDraw } = data;

    if (homeOrDraw >= 75) {
      return `Playing it safe? ${homeTeam} or Draw sits at a comfortable ${homeOrDraw}%.`;
    } else if (homeOrDraw >= 60) {
      return `The double chance (${homeTeam} or Draw) comes in at ${homeOrDraw}%.`;
    } else {
      return `Even the double chance is risky — ${homeTeam} or Draw at just ${homeOrDraw}%.`;
    }
  },

  halftimeBlueprint: ({ data, homeTeam }) => {
    const { homeHome } = data;

    if (homeHome >= 40) {
      return `${homeTeam} could control this wire-to-wire — ${homeHome}% to lead at both halftime and fulltime.`;
    } else if (homeHome >= 25) {
      return `There's a ${homeHome}% chance ${homeTeam} lead at both intervals.`;
    } else {
      return `Full control is uncertain — only ${homeHome}% chance ${homeTeam} lead both halves.`;
    }
  },

  totalGoalOutlook: ({ data }) => {
    const { over25, under25 } = data;

    if (over25 >= THRESHOLDS.HIGH_GOALS) {
      return `Goals are on the menu. Over 2.5 sits at ${over25}%.`;
    } else if (over25 >= 50) {
      return `A balanced outlook — Over 2.5 at ${over25}%, Under at ${under25}%.`;
    } else {
      return `A cagey affair is expected — Under 2.5 at ${under25}%.`;
    }
  },

  benchWatch: ({ data, homeTeam, awayTeam }) => {
    const { home, away } = data;
    const parts = [];

    if (!home && !away) {
      return `Bench analysis data unavailable for this match.`;
    }

    // Home bench analysis
    if (home?.benchGoalsPerMatch >= THRESHOLDS.DANGEROUS_BENCH) {
      parts.push(`${homeTeam}'s bench is a threat — averaging ${home.benchGoalsPerMatch.toFixed(1)} goals per match from substitutes.`);
    } else if (home?.benchGoalsPerMatch > 0) {
      parts.push(`${homeTeam}'s bench has been quiet, averaging ${home.benchGoalsPerMatch.toFixed(1)} goals per match.`);
    }

    // Home top supersub
    if (home?.topSupersub) {
      const ts = home.topSupersub;
      parts.push(`Watch for ${ts.name} (${ts.goalsAsSub} goals as sub this season, ${ts.goalsPer90AsSub.toFixed(1)} per 90).`);
    }

    // Away bench comparison
    if (away?.benchGoalsPerMatch >= THRESHOLDS.DANGEROUS_BENCH) {
      parts.push(`${awayTeam} also have bench firepower (${away.benchGoalsPerMatch.toFixed(1)} gpg).`);
    }

    if (away?.topSupersub && (!home?.topSupersub || away.topSupersub.goalsPer90AsSub > home.topSupersub.goalsPer90AsSub)) {
      const ts = away.topSupersub;
      parts.push(`${awayTeam}'s ${ts.name} is dangerous off the bench (${ts.goalsPer90AsSub.toFixed(1)} goals per 90 as sub).`);
    }

    if (parts.length === 0) {
      return `Neither bench has been particularly productive this season.`;
    }

    return parts.join(' ');
  },

  managerTendencies: ({ data, homeTeam, awayTeam }) => {
    const { home, away } = data;
    const parts = [];

    if (!home?.coachName && !away?.coachName) {
      return `Manager substitution patterns unavailable.`;
    }

    // Home manager
    if (home?.coachName && home?.avgFirstSubMinute) {
      const style = home.avgFirstSubMinute < THRESHOLDS.EARLY_SUB_MINUTE ? 'proactive' :
                    home.avgFirstSubMinute > THRESHOLDS.LATE_SUB_MINUTE ? 'patient' : 'measured';
      parts.push(`${home.coachName} is ${style} with changes, averaging his first sub at ${Math.round(home.avgFirstSubMinute)}'.`);

      if (home.benchGoalPct >= 20) {
        parts.push(`His subs have delivered — bench goals in ${Math.round(home.benchGoalPct)}% of matches.`);
      }
    }

    // Away manager comparison
    if (away?.coachName && home?.avgFirstSubMinute && away?.avgFirstSubMinute) {
      if (Math.abs(home.avgFirstSubMinute - away.avgFirstSubMinute) >= 8) {
        if (away.avgFirstSubMinute < home.avgFirstSubMinute) {
          parts.push(`${away.coachName} tends to act earlier (${Math.round(away.avgFirstSubMinute)}' avg).`);
        } else {
          parts.push(`${away.coachName} is more patient (${Math.round(away.avgFirstSubMinute)}' avg).`);
        }
      }
    }

    if (parts.length === 0) {
      return `Manager substitution patterns unavailable.`;
    }

    return parts.join(' ');
  },

  formGuide: ({ data, homeTeam, awayTeam }) => {
    const { home, away } = data;
    const parts = [];

    function ordinal(n) {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    if (home?.form) {
      const recent = home.form.slice(-5);
      const wins = (recent.match(/W/g) || []).length;
      parts.push(`${homeTeam} are ${ordinal(home.position)} with ${wins}W in their last 5 (${recent}).`);
    } else if (home?.position) {
      parts.push(`${homeTeam} sit ${ordinal(home.position)} with ${home.points} points from ${home.played} games.`);
    }

    if (away?.form) {
      const recent = away.form.slice(-5);
      const wins = (recent.match(/W/g) || []).length;
      parts.push(`${awayTeam} are ${ordinal(away.position)} — ${wins} wins in their last 5 (${recent}).`);
    } else if (away?.position) {
      parts.push(`${awayTeam} sit ${ordinal(away.position)} with ${away.points} points from ${away.played} games.`);
    }

    return parts.length ? parts.join(' ') : `Form data unavailable for this match.`;
  },

  summary: ({ sections, homeTeam, awayTeam }) => {
    const parts = [];

    // Favorite assessment — use explicit spread check to avoid false "too close to call"
    const cop = sections.commandOfPitch;
    if (cop?.available && cop.data) {
      const { home, away } = cop.data;
      if (home >= THRESHOLDS.STRONG_FAVORITE) {
        parts.push(`${homeTeam} are clear favorites`);
      } else if (away >= THRESHOLDS.STRONG_FAVORITE) {
        parts.push(`${awayTeam} are heavy road favorites`);
      } else if (home >= THRESHOLDS.SLIGHT_FAVORITE) {
        parts.push(`${homeTeam} enter as slight favorites`);
      } else if (away >= THRESHOLDS.SLIGHT_FAVORITE) {
        parts.push(`${awayTeam} are favorites despite playing away`);
      } else if (Math.abs(home - away) < 8) {
        parts.push(`This one's too close to call`);
      } else if (away > home) {
        parts.push(`${awayTeam} hold the slight edge away from home`);
      } else {
        parts.push(`${homeTeam} hold a marginal home advantage`);
      }
    }

    // Bench factor
    const bench = sections.benchWatch;
    if (bench?.available && bench.data?.home?.benchGoalsPerMatch >= THRESHOLDS.DANGEROUS_BENCH) {
      parts.push(`with a dangerous bench`);
    }

    // Manager factor
    const manager = sections.managerTendencies;
    if (manager?.available && manager.data?.home?.avgFirstSubMinute < THRESHOLDS.EARLY_SUB_MINUTE) {
      parts.push(`${manager.data.home.coachName}'s early substitution patterns could unlock a late winner if the game is tight`);
    }

    // Goal expectation
    const goals = sections.totalGoalOutlook;
    if (goals?.available && goals.data) {
      if (goals.data.over25 >= THRESHOLDS.HIGH_GOALS) {
        parts.push(`Expect goals`);
      } else if (goals.data.under25 >= 55) {
        parts.push(`A tight, low-scoring affair is likely`);
      }
    }

    if (parts.length === 0) {
      return `Check back closer to kickoff for more detailed analysis.`;
    }

    return parts.join('. ') + '.';
  },
};

/**
 * Generate all prose from structured sections.
 */
export function generateProse(sections, homeTeam, awayTeam) {
  const prose = {};

  for (const [key, template] of Object.entries(PROSE_TEMPLATES)) {
    try {
      if (key === 'summary') {
        prose.summary = template({ sections, homeTeam, awayTeam });
      } else if (sections[key]?.available && sections[key]?.data) {
        prose[key] = template({
          data: sections[key].data,
          homeTeam,
          awayTeam,
        });
      }
    } catch (err) {
      console.error(`[intel/templates] Error generating prose for ${key}:`, err.message);
    }
  }

  return prose;
}
