/**
 * settle.test.js
 *
 * Tests the full prediction lifecycle:
 *   Bet placed (PENDING) → match goes LIVE → match finishes → settlement → WON/LOST + payout
 *
 * Tests the pure logic functions directly (calculateResult, settleSupersub).
 * No DB, no network, no env vars required.
 */

import { describe, it, expect, vi } from 'vitest';

// settle.js calls createClient() at module-load time — mock it before the import
// so it doesn't crash when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are absent.
vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({})),
}));

import { calculateResult, settleSupersub } from '../../scripts/settle.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeBet = (overrides = {}) => ({
    id: 'bet-1',
    user_id: 'user-1',
    match_id: 101,
    card_type: 'c_match_result',
    selection: 'HOME_WIN',
    potential_reward: 210,
    status: 'PENDING',
    team_id: null,
    ...overrides,
});

const makeMatch = (overrides = {}) => ({
    id: 101,
    status: 'FT',
    home_score: 2,
    away_score: 1,
    events: [],
    ...overrides,
});

const goalEvent = (teamId, scorerId, assisterId = null, elapsed = 70, detail = 'Normal Goal') => ({
    type: 'Goal',
    detail,
    team: { id: teamId },
    player: { id: scorerId },
    assist: assisterId ? { id: assisterId } : null,
    time: { elapsed },
});

// Subst event shape: player = coming OFF, assist = coming ON
const substEvent = (teamId, playerOffId, playerOnId, elapsed = 60) => ({
    type: 'subst',
    team: { id: teamId },
    player: { id: playerOffId },
    assist: { id: playerOnId },
    time: { elapsed },
});

const HOME_TEAM = 10;
const AWAY_TEAM = 20;

// ─── Match Result ─────────────────────────────────────────────────────────────

describe('Match Result card', () => {

    it('WON: HOME_WIN predicted, home wins', () => {
        expect(calculateResult(
            makeBet({ selection: 'HOME_WIN' }),
            makeMatch({ home_score: 2, away_score: 0 })
        ).status).toBe('WON');
    });

    it('LOST: HOME_WIN predicted, away wins', () => {
        expect(calculateResult(
            makeBet({ selection: 'HOME_WIN' }),
            makeMatch({ home_score: 0, away_score: 2 })
        ).status).toBe('LOST');
    });

    it('LOST: HOME_WIN predicted, match draws', () => {
        expect(calculateResult(
            makeBet({ selection: 'HOME_WIN' }),
            makeMatch({ home_score: 1, away_score: 1 })
        ).status).toBe('LOST');
    });

    it('WON: AWAY_WIN predicted, away wins', () => {
        expect(calculateResult(
            makeBet({ selection: 'AWAY_WIN' }),
            makeMatch({ home_score: 1, away_score: 3 })
        ).status).toBe('WON');
    });

    it('WON: DRAW predicted, match draws', () => {
        expect(calculateResult(
            makeBet({ selection: 'DRAW' }),
            makeMatch({ home_score: 1, away_score: 1 })
        ).status).toBe('WON');
    });

    it('LOST: DRAW predicted, home wins', () => {
        expect(calculateResult(
            makeBet({ selection: 'DRAW' }),
            makeMatch({ home_score: 2, away_score: 0 })
        ).status).toBe('LOST');
    });

    it('PENDING: match still in progress (2H)', () => {
        expect(calculateResult(
            makeBet({ selection: 'HOME_WIN' }),
            makeMatch({ status: '2H', home_score: 1, away_score: 0 })
        ).status).toBe('PENDING');
    });

    it('WON: AET recognised as finished', () => {
        expect(calculateResult(
            makeBet({ selection: 'HOME_WIN' }),
            makeMatch({ status: 'AET', home_score: 1, away_score: 0 })
        ).status).toBe('WON');
    });

    it('WON: PEN recognised as finished', () => {
        expect(calculateResult(
            makeBet({ selection: 'AWAY_WIN' }),
            makeMatch({ status: 'PEN', home_score: 0, away_score: 1 })
        ).status).toBe('WON');
    });
});

// ─── Total Goals ──────────────────────────────────────────────────────────────

describe('Total Goals card', () => {

    it('WON: OVER_2_5, 3 goals scored', () => {
        expect(calculateResult(
            makeBet({ card_type: 'c_total_goals', selection: 'OVER_2_5' }),
            makeMatch({ home_score: 2, away_score: 1 })
        ).status).toBe('WON');
    });

    it('LOST: OVER_2_5, only 2 goals scored', () => {
        expect(calculateResult(
            makeBet({ card_type: 'c_total_goals', selection: 'OVER_2_5' }),
            makeMatch({ home_score: 1, away_score: 1 })
        ).status).toBe('LOST');
    });

    it('LOST: OVER_2_5, 0-0 draw', () => {
        expect(calculateResult(
            makeBet({ card_type: 'c_total_goals', selection: 'OVER_2_5' }),
            makeMatch({ home_score: 0, away_score: 0 })
        ).status).toBe('LOST');
    });

    it('WON: UNDER_2_5, 1 goal scored', () => {
        expect(calculateResult(
            makeBet({ card_type: 'c_total_goals', selection: 'UNDER_2_5' }),
            makeMatch({ home_score: 1, away_score: 0 })
        ).status).toBe('WON');
    });

    it('LOST: UNDER_2_5, 3 goals scored', () => {
        expect(calculateResult(
            makeBet({ card_type: 'c_total_goals', selection: 'UNDER_2_5' }),
            makeMatch({ home_score: 2, away_score: 1 })
        ).status).toBe('LOST');
    });
});

// ─── Supersub — settleSupersub() ─────────────────────────────────────────────

describe('Supersub card', () => {

    it('WON: sub from backed team scores after coming on', () => {
        const events = [
            substEvent(HOME_TEAM, 99, 55, 60),  // player 55 on at 60'
            goalEvent(HOME_TEAM, 55, null, 75),  // player 55 scores at 75'
        ];
        expect(settleSupersub(
            makeBet({ card_type: 'c_supersub', selection: 'HOME', team_id: HOME_TEAM }),
            events
        ).status).toBe('WON');
    });

    it('WON: sub from backed team assists a goal', () => {
        const events = [
            substEvent(HOME_TEAM, 99, 55, 60),  // player 55 on at 60'
            goalEvent(HOME_TEAM, 77, 55, 80),    // player 55 assists at 80'
        ];
        expect(settleSupersub(
            makeBet({ card_type: 'c_supersub', selection: 'HOME', team_id: HOME_TEAM }),
            events
        ).status).toBe('WON');
    });

    it('LOST: sub scores but for the wrong team', () => {
        const events = [
            substEvent(AWAY_TEAM, 99, 55, 60),
            goalEvent(AWAY_TEAM, 55, null, 75),
        ];
        expect(settleSupersub(
            makeBet({ card_type: 'c_supersub', selection: 'HOME', team_id: HOME_TEAM }),
            events
        ).status).toBe('LOST');
    });

    it('LOST: sub scores before their own substitution time (data integrity)', () => {
        const events = [
            substEvent(HOME_TEAM, 99, 55, 75),  // comes on at 75'
            goalEvent(HOME_TEAM, 55, null, 60),  // "scores" at 60' — before sub, invalid
        ];
        expect(settleSupersub(
            makeBet({ card_type: 'c_supersub', selection: 'HOME', team_id: HOME_TEAM }),
            events
        ).status).toBe('LOST');
    });

    it('LOST: no substitutions made at all', () => {
        const events = [goalEvent(HOME_TEAM, 9, null, 50)];
        expect(settleSupersub(
            makeBet({ card_type: 'c_supersub', selection: 'HOME', team_id: HOME_TEAM }),
            events
        ).status).toBe('LOST');
    });

    it('LOST: subs come on but none score or assist', () => {
        const events = [
            substEvent(HOME_TEAM, 99, 55, 60),
            goalEvent(HOME_TEAM, 9, null, 80), // starter scores, not the sub
        ];
        expect(settleSupersub(
            makeBet({ card_type: 'c_supersub', selection: 'HOME', team_id: HOME_TEAM }),
            events
        ).status).toBe('LOST');
    });

    it('LOST: team_id is null (legacy bet without team context)', () => {
        const events = [
            substEvent(HOME_TEAM, 99, 55, 60),
            goalEvent(HOME_TEAM, 55, null, 75),
        ];
        expect(settleSupersub(
            makeBet({ card_type: 'c_supersub', team_id: null }),
            events
        ).status).toBe('LOST');
    });

    it('LOST: own goal does not count toward win', () => {
        const events = [
            substEvent(HOME_TEAM, 99, 55, 60),
            { ...goalEvent(HOME_TEAM, 55, null, 75), detail: 'Own Goal' },
        ];
        expect(settleSupersub(
            makeBet({ card_type: 'c_supersub', selection: 'HOME', team_id: HOME_TEAM }),
            events
        ).status).toBe('LOST');
    });

    it('LOST: shootout penalty (elapsed > 120) does not count', () => {
        const events = [
            substEvent(HOME_TEAM, 99, 55, 60),
            { ...goalEvent(HOME_TEAM, 55, null, 125), detail: 'Penalty' },
        ];
        expect(settleSupersub(
            makeBet({ card_type: 'c_supersub', selection: 'HOME', team_id: HOME_TEAM }),
            events
        ).status).toBe('LOST');
    });

    it('WON: normal penalty within 120 minutes counts', () => {
        const events = [
            substEvent(HOME_TEAM, 99, 55, 60),
            { ...goalEvent(HOME_TEAM, 55, null, 85), detail: 'Penalty' },
        ];
        expect(settleSupersub(
            makeBet({ card_type: 'c_supersub', selection: 'HOME', team_id: HOME_TEAM }),
            events
        ).status).toBe('WON');
    });
});

// ─── calculateResult → Supersub routing ──────────────────────────────────────

describe('calculateResult routing for Supersub', () => {

    it('routes c_supersub bets through settleSupersub correctly', () => {
        const events = [
            substEvent(HOME_TEAM, 99, 55, 60),
            goalEvent(HOME_TEAM, 55, null, 75),
        ];
        expect(calculateResult(
            makeBet({ card_type: 'c_supersub', selection: 'HOME', team_id: HOME_TEAM }),
            makeMatch({ events }),
            events
        ).status).toBe('WON');
    });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('Edge cases', () => {

    it('returns LOST for an unknown card type', () => {
        expect(calculateResult(
            makeBet({ card_type: 'c_unknown' }),
            makeMatch()
        ).status).toBe('LOST');
    });

    it('handles null events without throwing', () => {
        expect(() => calculateResult(
            makeBet({ card_type: 'c_supersub', team_id: HOME_TEAM }),
            makeMatch({ events: null })
        )).not.toThrow();
    });

    it('treats missing scores as 0 (0 vs 0 = DRAW)', () => {
        expect(calculateResult(
            makeBet({ selection: 'DRAW' }),
            makeMatch({ home_score: undefined, away_score: undefined })
        ).status).toBe('WON');
    });

    it('returns PENDING for NS (not started)', () => {
        expect(calculateResult(
            makeBet({ selection: 'HOME_WIN' }),
            makeMatch({ status: 'NS' })
        ).status).toBe('PENDING');
    });
});
