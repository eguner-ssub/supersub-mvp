// Coverage label + explainer logic. Locks the threshold boundaries and
// the wording variation across buckets so a copy edit can't accidentally
// move the FE into the wrong bucket.

import { describe, it, expect } from 'vitest';
import { __testables } from '../statsGen/coverage.js';

const { pickLabel, buildExplainer } = __testables;

describe('pickLabel — completeness bucket boundaries', () => {
  it('classifies >=80 as Complete', () => {
    expect(pickLabel(100)).toBe('Complete');
    expect(pickLabel(80)).toBe('Complete');
  });
  it('classifies 50–79 as Good', () => {
    expect(pickLabel(79.99)).toBe('Good');
    expect(pickLabel(50)).toBe('Good');
  });
  it('classifies 20–49 as Limited', () => {
    expect(pickLabel(49)).toBe('Limited');
    expect(pickLabel(20)).toBe('Limited');
  });
  it('classifies <20 as Sparse', () => {
    expect(pickLabel(19.99)).toBe('Sparse');
    expect(pickLabel(0)).toBe('Sparse');
  });
});

describe('buildExplainer — wording variation', () => {
  const counts = { remaining: 41, sampled: 8, skipped: 33 };

  it('Complete copy uses sampled/remaining only', () => {
    const out = buildExplainer('Complete', counts);
    expect(out).toMatch(/8 of 41/);
    expect(out).not.toMatch(/intel window|widen|reliable/);
  });
  it('Limited copy mentions the 14-day window', () => {
    const out = buildExplainer('Limited', counts);
    expect(out).toMatch(/33 of 41/);
    expect(out).toMatch(/14 days/);
  });
  it('Sparse copy mentions reliability caveat', () => {
    const out = buildExplainer('Sparse', counts);
    expect(out).toMatch(/8 of 41/);
    expect(out).toMatch(/reliable/);
  });
  it('Good copy mentions widening', () => {
    const out = buildExplainer('Good', counts);
    expect(out).toMatch(/widen/);
  });
});
