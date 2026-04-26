// STEP 8 unit tests — narrative generators must never invent percentages
// that don't exist in the input data. Specifically prevents the bug class
// that triggered the 2026-04 Sportmonks-only pivot: prose mentioned a
// scoreline percentage that didn't appear in the structured array on the
// same payload.
//
// The handler's narrative_summary deliberately does NOT cite any specific
// scoreline (only W/D/L percentages), so the asserts here are:
//   1. Generated string contains the input W/D/L percentages.
//   2. Generated string does NOT contain any "X-Y" scoreline pattern.
//   3. Bucketing functions return the documented buckets at boundaries.

import { describe, it, expect } from 'vitest';
import { __testables } from '../statsGen/handlers/match-probabilities.js';

const {
  generateResultHeadline,
  generateMatchSummary,
  generateGoalsNarrative,
  generateBttsNarrative,
  bucketUncertainty,
} = __testables;

const SCORELINE_RE = /\b\d-\d\b/;  // matches "1-0", "2-1", etc.

describe('generateMatchSummary', () => {
  it('includes the W/D/L percentages from input', () => {
    const out = generateMatchSummary(0.45, 0.30, 0.25, 'Arsenal', 'Newcastle');
    expect(out).toMatch(/45%/);
    expect(out).toMatch(/30%/);
    expect(out).toMatch(/25%/);
  });

  it('NEVER mentions a specific scoreline like X-Y', () => {
    // Run a sweep across spreads to be sure no branch leaks scoreline syntax.
    const cases = [
      [0.70, 0.20, 0.10], [0.10, 0.20, 0.70], [0.33, 0.34, 0.33],
      [0.45, 0.30, 0.25], [0.25, 0.30, 0.45], [0.40, 0.20, 0.40],
    ];
    for (const [h, d, a] of cases) {
      const out = generateMatchSummary(h, d, a, 'A', 'B');
      expect(out).not.toMatch(SCORELINE_RE);
    }
  });
});

describe('generateResultHeadline', () => {
  it('uses W/D/L percentages from input only', () => {
    const out = generateResultHeadline(0.55, 0.25, 0.20, 'Arsenal', 'Newcastle');
    // Must mention 55 (winner) and at least one other percentage.
    expect(out).toMatch(/55%/);
  });

  it('NEVER cites a specific scoreline pattern', () => {
    const cases = [
      [0.70, 0.20, 0.10], [0.10, 0.20, 0.70], [0.33, 0.34, 0.33],
      [0.45, 0.30, 0.25], [0.25, 0.30, 0.45],
    ];
    for (const [h, d, a] of cases) {
      const out = generateResultHeadline(h, d, a, 'A', 'B');
      expect(out).not.toMatch(SCORELINE_RE);
    }
  });
});

describe('generateGoalsNarrative', () => {
  it('quotes the over_2.5 percentage from input', () => {
    expect(generateGoalsNarrative(0.65)).toMatch(/65%/);
    expect(generateGoalsNarrative(0.50)).toMatch(/50%/);
    expect(generateGoalsNarrative(0.30)).toMatch(/30%/);
  });

  it('NEVER cites a specific scoreline pattern', () => {
    for (const p of [0.0, 0.3, 0.5, 0.65, 0.9]) {
      expect(generateGoalsNarrative(p)).not.toMatch(SCORELINE_RE);
    }
  });
});

describe('generateBttsNarrative', () => {
  it('quotes the BTTS percentage from input', () => {
    expect(generateBttsNarrative(0.70)).toMatch(/70%/);
    expect(generateBttsNarrative(0.50)).toMatch(/50%/);
    expect(generateBttsNarrative(0.20)).toMatch(/20%/);
  });
});

describe('bucketUncertainty', () => {
  it('classifies dominant outcomes as low', () => {
    expect(bucketUncertainty(0.70, 0.20, 0.10)).toBe('low');
    expect(bucketUncertainty(0.10, 0.20, 0.70)).toBe('low');
    expect(bucketUncertainty(0.55, 0.25, 0.20)).toBe('low'); // boundary
  });

  it('classifies mild leans as moderate', () => {
    expect(bucketUncertainty(0.50, 0.30, 0.20)).toBe('moderate');
    expect(bucketUncertainty(0.42, 0.30, 0.28)).toBe('moderate'); // boundary
  });

  it('classifies near-even spreads as high', () => {
    expect(bucketUncertainty(0.34, 0.33, 0.33)).toBe('high');
    expect(bucketUncertainty(0.40, 0.35, 0.25)).toBe('high');
  });
});
