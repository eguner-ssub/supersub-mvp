import { describe, it, expect } from 'vitest';

/**
 * api/share-card.js uses JSX for @vercel/og ImageResponse, which only runs
 * in the Vercel Edge runtime. Vite cannot parse JSX in .js files, so we
 * cannot import the handler directly. Instead we test the shared logic
 * (token validation, cache strategy, card config) that the handler relies on.
 *
 * Full integration testing of the OG image endpoint requires a deployed
 * Vercel environment or `vercel dev`.
 */

// ── Token validation (mirrors the regex in share-card.js) ───────────────────
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('share-card token validation', () => {
  it('accepts a valid UUID v4', () => {
    expect(UUID_REGEX.test('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBe(true);
  });

  it('accepts uppercase UUIDs', () => {
    expect(UUID_REGEX.test('AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE')).toBe(true);
  });

  it('rejects non-UUID strings', () => {
    expect(UUID_REGEX.test('not-a-uuid')).toBe(false);
    expect(UUID_REGEX.test('')).toBe(false);
    expect(UUID_REGEX.test('12345')).toBe(false);
  });

  it('rejects UUIDs with wrong segment lengths', () => {
    expect(UUID_REGEX.test('aaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBe(false);
    expect(UUID_REGEX.test('aaaaaaaa-bbb-cccc-dddd-eeeeeeeeeeee')).toBe(false);
  });
});

// ── Card config (mirrors CARD_CONFIG in share-card.js) ──────────────────────
const CARD_CONFIG = {
  c_supersub:      { label: 'SUPERSUB CARD',    color: '#00E5FF' },
  c_match_result:  { label: 'MATCH RESULT',     color: '#00D4A0' },
  c_total_goals:   { label: 'TOTAL GOALS',      color: '#FFB800' },
  c_player_score:  { label: 'GOALSCORER',       color: '#FF4D6A' },
};

describe('share-card card config', () => {
  it('has entries for all four card types', () => {
    expect(Object.keys(CARD_CONFIG)).toHaveLength(4);
    expect(CARD_CONFIG).toHaveProperty('c_supersub');
    expect(CARD_CONFIG).toHaveProperty('c_match_result');
    expect(CARD_CONFIG).toHaveProperty('c_total_goals');
    expect(CARD_CONFIG).toHaveProperty('c_player_score');
  });

  it('each entry has a label and hex color', () => {
    for (const [key, conf] of Object.entries(CARD_CONFIG)) {
      expect(conf.label).toBeTruthy();
      expect(conf.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

// ── Cache strategy (mirrors logic in share-card.js handler) ─────────────────
describe('share-card cache strategy', () => {
  const getCacheMaxAge = (status) => {
    const isWon = status === 'WON';
    const isLost = status === 'LOST';
    const isPre = !isWon && !isLost;
    return isPre ? 60 : 3600;
  };

  it('uses short cache (60s) for PENDING predictions', () => {
    expect(getCacheMaxAge('PENDING')).toBe(60);
  });

  it('uses short cache (60s) for LIVE predictions', () => {
    expect(getCacheMaxAge('LIVE')).toBe(60);
  });

  it('uses long cache (3600s) for WON predictions', () => {
    expect(getCacheMaxAge('WON')).toBe(3600);
  });

  it('uses long cache (3600s) for LOST predictions', () => {
    expect(getCacheMaxAge('LOST')).toBe(3600);
  });
});
