/**
 * settle.test.js
 *
 * Tests the pure settlement logic functions directly (calculateResult, settleSupersub).
 * No DB, no network, no env vars required.
 *
 * Coverage:
 *   - Match Result: selection matching, all terminal states
 *   - Total Goals: over/under 2.5
 *   - Player Score: normal goal, penalty, own goal exclusion, 90-minute cutoff
 *   - Supersub: team-level (500 pts), player-level (2500 pts), assists, time checks
 *   - Points calculation for all card types
 *   - Edge cases
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
    odds: 2.10,
    status: 'PENDING',
    team_id: null,
    player_id: null,
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
        const result = calculateResult(
            makeBet({ selection: 'HOME_WIN' }),
            makeMatch({ home_score: 2, away_score: 0 })
        );
        expect(result.status).toBe('WON');
        expect(result.points).toBe(210); // Math.round(2.10 * 100)
    });

    it('LOST: HOME_WIN predicted, away wins', () => {
        const result = calculateResult(
            makeBet({ selection: 'HOME_WIN' }),
            makeMatch({ home_score: 0, away_score: 2 })
        );
        expect(result.status).toBe('LOST');
        expect(result.points).toBe(0);
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
            makeMatch({ status: 'INPLAY_2ND_HALF', home_score: 1, away_score: 0 })
        ).status).toBe('PENDING');
    });

    it('WON: AET recognised as finished', () => {
        expect(calculateResult(
            makeBet({ selection: 'HOME_WIN' }),
            makeMatch({ status: 'AET', home_score: 1, away_score: 0 })
        ).status).toBe('WON');
    });

    it('WON: FT_PEN recognised as finished', () => {
        expect(calculateResult(
            makeBet({ selection: 'AWAY_WIN' }),
            makeMatch({ status: 'FT_PEN', home_score: 0, away_score: 1 })
        ).status).toBe('WON');
    });

    it('points = Math.round(odds * 100) on win', () => {
        const result = calculateResult(
            makeBet({ selection: 'HOME_WIN', odds: 1.75 }),
            makeMatch({ home_score: 3, away_score: 0 })
        );
        expect(result.points).toBe(175);
    });
});

// ─── Total Goals ──────────────────────────────────────────────────────────────

describe('Total Goals card', () => {

    it('WON: OVER_2_5, 3 goals scored', () => {
        const result = calculateResult(
            makeBet({ card_type: 'c_total_goals', selection: 'OVER_2_5', odds: 1.90 }),
            makeMatch({ home_score: 2, away_score: 1 })
        );
        expect(result.status).toBe('WON');
        expect(result.points).toBe(190);
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

    it('points = 0 on loss', () => {
        const result = calculateResult(
            makeBet({ card_type: 'c_total_goals', selection: 'OVER_2_5', odds: 1.90 }),
            makeMatch({ home_score: 0, away_score: 0 })
        );
        expect(result.points).toBe(0);
    });
});

// ─── Player Score ─────────────────────────────────────────────────────────────

describe('Player Score card', () => {

    it('WON: player scores a Normal Goal (using player_id)', () => {
        const events = [goalEvent(HOME_TEAM, 42, null, 30, 'Normal Goal')];
        const result = calculateResult(
            makeBet({ card_type: 'c_player_score', selection: 'PLAYER_42', player_id: 42, odds: 3.00 }),
            makeMatch({ events }),
            events
        );
        expect(result.status).toBe('WON');
        expect(result.points).toBe(300);
    });

    it('WON: player scores a Penalty (non-shootout)', () => {
        const events = [goalEvent(HOME_TEAM, 42, null, 85, 'Penalty')];
        const result = calculateResult(
            makeBet({ card_type: 'c_player_score', selection: 'PLAYER_42', player_id: 42 }),
            makeMatch({ events }),
            events
        );
        expect(result.status).toBe('WON');
    });

    it('WON: legacy format (selection = PLAYER_<id>, player_id null)', () => {
        const events = [goalEvent(HOME_TEAM, 42, null, 50, 'Normal Goal')];
        const result = calculateResult(
            makeBet({ card_type: 'c_player_score', selection: 'PLAYER_42', player_id: null }),
            makeMatch({ events }),
            events
        );
        expect(result.status).toBe('WON');
    });

    it('LOST: player does not score', () => {
        const events = [goalEvent(HOME_TEAM, 99, null, 50, 'Normal Goal')];
        expect(calculateResult(
            makeBet({ card_type: 'c_player_score', player_id: 42, selection: 'PLAYER_42' }),
            makeMatch({ events }),
            events
        ).status).toBe('LOST');
    });

    it('LOST: own goal does not count', () => {
        const events = [goalEvent(HOME_TEAM, 42, null, 50, 'Own Goal')];
        expect(calculateResult(
            makeBet({ card_type: 'c_player_score', player_id: 42, selection: 'PLAYER_42' }),
            makeMatch({ events }),
            events
        ).status).toBe('LOST');
    });

    it('LOST: goal after 90 minutes does not count', () => {
        const events = [goalEvent(HOME_TEAM, 42, null, 95, 'Normal Goal')];
        expect(calculateResult(
            makeBet({ card_type: 'c_player_score', player_id: 42, selection: 'PLAYER_42' }),
            makeMatch({ events }),
            events
        ).status).toBe('LOST');
    });

    it('LOST: shootout penalty does not count (elapsed > 90)', () => {
        const events = [goalEvent(HOME_TEAM, 42, null, 125, 'Penalty')];
        expect(calculateResult(
            makeBet({ card_type: 'c_player_score', player_id: 42, selection: 'PLAYER_42' }),
            makeMatch({ events }),
            events
        ).status).toBe('LOST');
    });

    it('WON: goal at exactly 90 minutes counts', () => {
        const events = [goalEvent(HOME_TEAM, 42, null, 90, 'Normal Goal')];
        expect(calculateResult(
            makeBet({ card_type: 'c_player_score', player_id: 42, selection: 'PLAYER_42' }),
            makeMatch({ events }),
            events
        ).status).toBe('WON');
    });

    it('LOST: malformed selection with no player_id returns LOST', () => {
        expect(calculateResult(
            makeBet({ card_type: 'c_player_score', selection: 'INVALID', player_id: null }),
            makeMatch(),
            []
        ).status).toBe('LOST');
    });
});

// ─── Supersub — settleSupersub() ─────────────────────────────────────────────

describe('Supersub card (team-level)', () => {

    it('WON: sub from backed team scores after coming on (500 pts)', () => {
        const events = [
            substEvent(HOME_TEAM, 99, 55, 60),  // player 55 on at 60'
            goalEvent(HOME_TEAM, 55, null, 75),  // player 55 scores at 75'
        ];
        const result = settleSupersub(
            makeBet({ card_type: 'c_supersub', selection: 'HOME', team_id: HOME_TEAM }),
            events
        );
        expect(result.status).toBe('WON');
        expect(result.points).toBe(500);
    });

    it('WON: sub from backed team assists a goal (500 pts)', () => {
        const events = [
            substEvent(HOME_TEAM, 99, 55, 60),  // player 55 on at 60'
            goalEvent(HOME_TEAM, 77, 55, 80),    // player 55 assists at 80'
        ];
        const result = settleSupersub(
            makeBet({ card_type: 'c_supersub', selection: 'HOME', team_id: HOME_TEAM }),
            events
        );
        expect(result.status).toBe('WON');
        expect(result.points).toBe(500);
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

    it('LOST: sub scores before their own substitution time', () => {
        const events = [
            substEvent(HOME_TEAM, 99, 55, 75),  // comes on at 75'
            goalEvent(HOME_TEAM, 55, null, 60),  // "scores" at 60' — before sub
        ];
        expect(settleSupersub(
            makeBet({ card_type: 'c_supersub', selection: 'HOME', team_id: HOME_TEAM }),
            events
        ).status).toBe('LOST');
    });

    it('WON: sub scores at exactly the substitution minute (>= check)', () => {
        const events = [
            substEvent(HOME_TEAM, 99, 55, 60),  // comes on at 60'
            goalEvent(HOME_TEAM, 55, null, 60),  // scores at 60'
        ];
        const result = settleSupersub(
            makeBet({ card_type: 'c_supersub', selection: 'HOME', team_id: HOME_TEAM }),
            events
        );
        expect(result.status).toBe('WON');
        expect(result.points).toBe(500);
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
        const result = settleSupersub(
            makeBet({ card_type: 'c_supersub', selection: 'HOME', team_id: HOME_TEAM }),
            events
        );
        expect(result.status).toBe('WON');
        expect(result.points).toBe(500);
    });
});

// ─── Supersub — player-level ────────────────────────────────────────────────

describe('Supersub card (player-level)', () => {

    it('WON: specific player scores → 2500 pts', () => {
        const events = [
            substEvent(HOME_TEAM, 99, 55, 60),
            goalEvent(HOME_TEAM, 55, null, 75),
        ];
        const result = settleSupersub(
            makeBet({ card_type: 'c_supersub', team_id: HOME_TEAM, player_id: 55 }),
            events
        );
        expect(result.status).toBe('WON');
        expect(result.points).toBe(2500);
    });

    it('WON: specific player assists → 2500 pts', () => {
        const events = [
            substEvent(HOME_TEAM, 99, 55, 60),
            goalEvent(HOME_TEAM, 77, 55, 80),
        ];
        const result = settleSupersub(
            makeBet({ card_type: 'c_supersub', team_id: HOME_TEAM, player_id: 55 }),
            events
        );
        expect(result.status).toBe('WON');
        expect(result.points).toBe(2500);
    });

    it('LOST: different sub scores — not the target player', () => {
        const events = [
            substEvent(HOME_TEAM, 99, 55, 60),  // player 55 comes on
            substEvent(HOME_TEAM, 88, 66, 70),  // player 66 comes on
            goalEvent(HOME_TEAM, 66, null, 80),  // player 66 scores, not 55
        ];
        const result = settleSupersub(
            makeBet({ card_type: 'c_supersub', team_id: HOME_TEAM, player_id: 55 }),
            events
        );
        expect(result.status).toBe('LOST');
        expect(result.points).toBe(0);
    });

    it('LOST: target player never comes on as sub', () => {
        const events = [
            substEvent(HOME_TEAM, 99, 66, 60),  // player 66 comes on, not 55
            goalEvent(HOME_TEAM, 66, null, 80),
        ];
        expect(settleSupersub(
            makeBet({ card_type: 'c_supersub', team_id: HOME_TEAM, player_id: 55 }),
            events
        ).status).toBe('LOST');
    });
});

// ─── calculateResult → routing ──────────────────────────────────────────────

describe('calculateResult routing', () => {

    it('routes c_supersub bets through settleSupersub correctly', () => {
        const events = [
            substEvent(HOME_TEAM, 99, 55, 60),
            goalEvent(HOME_TEAM, 55, null, 75),
        ];
        const result = calculateResult(
            makeBet({ card_type: 'c_supersub', selection: 'HOME', team_id: HOME_TEAM }),
            makeMatch({ events }),
            events
        );
        expect(result.status).toBe('WON');
        expect(result.points).toBe(500);
    });

    it('routes c_player_score through player score logic', () => {
        const events = [goalEvent(HOME_TEAM, 42, null, 30)];
        const result = calculateResult(
            makeBet({ card_type: 'c_player_score', selection: 'PLAYER_42', player_id: 42, odds: 2.50 }),
            makeMatch({ events }),
            events
        );
        expect(result.status).toBe('WON');
        expect(result.points).toBe(250);
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

    it('points are 0 when odds are missing', () => {
        const result = calculateResult(
            makeBet({ selection: 'HOME_WIN', odds: undefined }),
            makeMatch({ home_score: 2, away_score: 0 })
        );
        expect(result.status).toBe('WON');
        expect(result.points).toBe(0);
    });
});
