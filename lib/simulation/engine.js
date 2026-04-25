// Monte Carlo match simulator (Phase 1 — sportmonks_baseline).
//
// Inputs are Sportmonks W/D/L probabilities (per match_intel report_sections).
// We numerically calibrate a pair of independent Poisson lambdas (home/away
// expected goals) to fit those probabilities, then run 10k iterations to
// produce: W/D/L, O/U 2.5 + 3.5, BTTS, expected goals, top-20 scoreline
// distribution, and a Shannon-entropy-derived uncertainty level.
//
// This is a v1 calibration. The Poisson independence assumption is decent
// for the league averages we have (EPL/Bundesliga/etc) but ignores
// goal-correlation effects. Dixon-Coles correlation arrives in Phase 3.

// ─── Knuth Poisson sampler ───────────────────────────────────────────────────
// Inverse-CDF via product of uniforms. Fine for small lambdas (typically 0-3).
export function poissonSample(lambda) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

// ─── Shannon entropy → uncertainty bucket ────────────────────────────────────
// Entropy of (home_win, draw, away_win) distribution. Max entropy for 3
// outcomes is ln(3) ≈ 1.0986. We use natural log and bucket as per spec.
function shannonEntropy(probs) {
  let h = 0;
  for (const p of probs) {
    if (p > 0) h -= p * Math.log(p);
  }
  return h;
}

function classifyUncertainty(entropy) {
  if (entropy < 0.9) return 'low';
  if (entropy <= 1.05) return 'moderate';
  return 'high';
}

// ─── Core simulator ──────────────────────────────────────────────────────────
/**
 * simulateMatch(homeLambda, awayLambda, runs?) → simulation object ready for DB.
 */
export function simulateMatch(homeLambda, awayLambda, runs = 10000) {
  let homeWins = 0, draws = 0, awayWins = 0;
  let over25 = 0, over35 = 0, btts = 0;
  let homeGoalsTotal = 0, awayGoalsTotal = 0;
  const scorelineCounts = new Map();

  for (let i = 0; i < runs; i++) {
    const h = poissonSample(homeLambda);
    const a = poissonSample(awayLambda);

    homeGoalsTotal += h;
    awayGoalsTotal += a;

    if (h > a) homeWins++;
    else if (h < a) awayWins++;
    else draws++;

    const total = h + a;
    if (total > 2.5) over25++;
    if (total > 3.5) over35++;
    if (h > 0 && a > 0) btts++;

    const key = `${h}-${a}`;
    scorelineCounts.set(key, (scorelineCounts.get(key) || 0) + 1);
  }

  // Top 20 most-frequent scorelines, by raw count.
  const topScorelines = [...scorelineCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([score, count]) => ({
      score,
      probability: Number((count / runs).toFixed(4)),
      count,
    }));

  const homeWinP = homeWins / runs;
  const drawP    = draws    / runs;
  const awayWinP = awayWins / runs;

  return {
    home_win_probability:  Number(homeWinP.toFixed(4)),
    draw_probability:      Number(drawP.toFixed(4)),
    away_win_probability:  Number(awayWinP.toFixed(4)),
    over_2_5_probability:  Number((over25 / runs).toFixed(4)),
    under_2_5_probability: Number((1 - over25 / runs).toFixed(4)),
    over_3_5_probability:  Number((over35 / runs).toFixed(4)),
    btts_probability:      Number((btts / runs).toFixed(4)),
    expected_home_goals:   Number((homeGoalsTotal / runs).toFixed(2)),
    expected_away_goals:   Number((awayGoalsTotal / runs).toFixed(2)),
    expected_total_goals:  Number(((homeGoalsTotal + awayGoalsTotal) / runs).toFixed(2)),
    scoreline_distribution: topScorelines,
    uncertainty_level:     classifyUncertainty(shannonEntropy([homeWinP, drawP, awayWinP])),
    simulation_count:      runs,
  };
}

// ─── Lambda calibration ──────────────────────────────────────────────────────
/**
 * calibrateLambdas({ pHomeWin, pDraw, pAwayWin }) → { homeLambda, awayLambda, converged }
 *
 * Approximate iterative search per spec. Initial guess is rough EPL average
 * with home advantage. Each iteration runs a small simulation and adjusts
 * lambdas in the direction of the W/D/L target. Converges when both home
 * and away win probabilities are within ±0.02 of target, or after 30
 * iterations falls back to a closed-form linear approximation.
 *
 * NOTE: this is a v1 calibration — it produces sensible lambdas that yield
 * a Poisson goal distribution roughly matching the requested W/D/L mix.
 * The Over 2.5 / BTTS distributions emerge naturally; they are NOT fitted
 * separately. Compare them post-hoc to Sportmonks to flag fixtures with
 * non-Poisson goal profiles.
 */
export function calibrateLambdas({ pHomeWin, pDraw, pAwayWin }) {
  // Normalise — Sportmonks rounding sometimes leaves the trio summing to 99 or 101
  const sum = pHomeWin + pDraw + pAwayWin;
  const tHome = pHomeWin / sum;
  const tDraw = pDraw    / sum;
  const tAway = pAwayWin / sum;

  let homeLambda = 1.5;
  let awayLambda = 1.2;
  const STEP = 0.05;
  const TOL  = 0.02;
  const ITERS = 30;
  const INNER_RUNS = 1000;

  for (let i = 0; i < ITERS; i++) {
    let hw = 0, aw = 0;
    for (let r = 0; r < INNER_RUNS; r++) {
      const h = poissonSample(homeLambda);
      const a = poissonSample(awayLambda);
      if (h > a) hw++;
      else if (h < a) aw++;
    }
    const probHomeWin = hw / INNER_RUNS;
    const probAwayWin = aw / INNER_RUNS;

    const homeDelta = tHome - probHomeWin;
    const awayDelta = tAway - probAwayWin;

    if (Math.abs(homeDelta) < TOL && Math.abs(awayDelta) < TOL) {
      return { homeLambda, awayLambda, converged: true, iterations: i + 1 };
    }

    // Push lambdas toward the targets. Direction-of-error logic per spec.
    if (homeDelta > 0) {
      homeLambda += STEP;
      awayLambda = Math.max(0.1, awayLambda - STEP);
    } else {
      homeLambda = Math.max(0.1, homeLambda - STEP);
      awayLambda += STEP;
    }

    if (awayDelta > 0 && Math.abs(homeDelta) < TOL) {
      // Home is fine but away is off — push away independently
      awayLambda += STEP;
    }
  }

  // Fallback: spec'd linear approximation. Crude but always produces
  // numerically sensible Poisson means (positive, plausible magnitude).
  return {
    homeLambda: 1.6 * tHome + 0.5,
    awayLambda: 1.6 * tAway + 0.5,
    converged: false,
    iterations: ITERS,
  };
}
