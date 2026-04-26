// Sanity tests for the Monte Carlo simulation engine.
// Stochastic — uses 10k runs so deltas should stay within the spec'd tolerances.
//
// ARCHIVED 2026-04: the engine these tests cover is no longer wired into the
// active codebase (see scripts/_archived/README.md). Retained as a regression
// net for any future revival of the Poisson pipeline.
//
// Run via: npx vitest run lib/_archived/simulation/engine.test.js

import { describe, it, expect } from 'vitest';
import { simulateMatch, calibrateLambdas, poissonSample } from './engine.js';

describe('poissonSample', () => {
  it('returns non-negative integers', () => {
    for (let i = 0; i < 100; i++) {
      const v = poissonSample(1.5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('mean approximates lambda over many samples', () => {
    const lambda = 1.7;
    let sum = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) sum += poissonSample(lambda);
    const mean = sum / N;
    expect(Math.abs(mean - lambda)).toBeLessThan(0.05);
  });
});

describe('simulateMatch', () => {
  it('produces equal home/away win probabilities for a 50/50 match', () => {
    const r = simulateMatch(1.3, 1.3, 10000);
    expect(Math.abs(r.home_win_probability - r.away_win_probability)).toBeLessThan(0.03);
  });

  it('produces home_win > 0.75 for a heavily favoured home team', () => {
    const r = simulateMatch(3.0, 0.5, 10000);
    expect(r.home_win_probability).toBeGreaterThan(0.75);
  });

  it('expected goals match input lambdas within 0.1', () => {
    const r = simulateMatch(1.7, 1.2, 10000);
    expect(Math.abs(r.expected_home_goals - 1.7)).toBeLessThan(0.1);
    expect(Math.abs(r.expected_away_goals - 1.2)).toBeLessThan(0.1);
    expect(Math.abs(r.expected_total_goals - 2.9)).toBeLessThan(0.15);
  });

  it('returns exactly 20 scoreline_distribution entries', () => {
    const r = simulateMatch(1.5, 1.2, 10000);
    expect(r.scoreline_distribution).toHaveLength(20);
    for (const entry of r.scoreline_distribution) {
      expect(entry).toHaveProperty('score');
      expect(entry).toHaveProperty('probability');
      expect(entry).toHaveProperty('count');
    }
  });

  it('W + D + L probabilities sum to ~1.0', () => {
    const r = simulateMatch(1.5, 1.2, 10000);
    const sum = r.home_win_probability + r.draw_probability + r.away_win_probability;
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
  });

  it('over_2_5 + under_2_5 sum to ~1.0', () => {
    const r = simulateMatch(1.5, 1.2, 10000);
    expect(Math.abs(r.over_2_5_probability + r.under_2_5_probability - 1.0)).toBeLessThan(0.001);
  });

  it('classifies a lopsided match as low uncertainty', () => {
    const r = simulateMatch(3.0, 0.4, 10000);
    expect(r.uncertainty_level).toBe('low');
  });

  it('classifies a coin-flip match as moderate or high uncertainty', () => {
    const r = simulateMatch(1.3, 1.3, 10000);
    expect(['moderate', 'high']).toContain(r.uncertainty_level);
  });
});

describe('calibrateLambdas', () => {
  it('produces sensible lambdas for a balanced match', () => {
    const { homeLambda, awayLambda } = calibrateLambdas({ pHomeWin: 0.40, pDraw: 0.30, pAwayWin: 0.30 });
    expect(homeLambda).toBeGreaterThan(0.5);
    expect(homeLambda).toBeLessThan(3.0);
    expect(awayLambda).toBeGreaterThan(0.5);
    expect(awayLambda).toBeLessThan(3.0);
  });

  it('produces home_lambda > away_lambda when home team is favoured', () => {
    const { homeLambda, awayLambda } = calibrateLambdas({ pHomeWin: 0.65, pDraw: 0.20, pAwayWin: 0.15 });
    expect(homeLambda).toBeGreaterThan(awayLambda);
  });

  it('handles non-normalised input (Sportmonks rounding)', () => {
    const { homeLambda, awayLambda } = calibrateLambdas({ pHomeWin: 0.50, pDraw: 0.25, pAwayWin: 0.26 });
    expect(homeLambda).toBeGreaterThan(0);
    expect(awayLambda).toBeGreaterThan(0);
  });
});
