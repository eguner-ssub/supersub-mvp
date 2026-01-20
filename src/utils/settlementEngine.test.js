import { describe, it, expect } from 'vitest';
import {
    calculateBetResult,
    calculateBatchResults,
    isMatchFinished,
    shouldVoidMatch
} from '../utils/settlementEngine';

describe('Settlement Engine', () => {
    // ============================================================================
    // MATCH RESULT BETS
    // ============================================================================
    describe('Match Result Bets', () => {
        it('should return WON for HOME_WIN when home team wins', () => {
            const result = calculateBetResult('MATCH_RESULT', 'HOME_WIN', 2, 1, 'FT');

            expect(result.status).toBe('WON');
            expect(result.payoutMultiplier).toBe(2.0);
        });

        it('should return LOST for HOME_WIN when away team wins', () => {
            const result = calculateBetResult('MATCH_RESULT', 'HOME_WIN', 1, 2, 'FT');

            expect(result.status).toBe('LOST');
            expect(result.payoutMultiplier).toBe(0);
        });

        it('should return LOST for HOME_WIN when match is a draw', () => {
            const result = calculateBetResult('MATCH_RESULT', 'HOME_WIN', 1, 1, 'FT');

            expect(result.status).toBe('LOST');
            expect(result.payoutMultiplier).toBe(0);
        });

        it('should return WON for AWAY_WIN when away team wins', () => {
            const result = calculateBetResult('MATCH_RESULT', 'AWAY_WIN', 1, 3, 'FT');

            expect(result.status).toBe('WON');
            expect(result.payoutMultiplier).toBe(2.0);
        });

        it('should return LOST for AWAY_WIN when home team wins', () => {
            const result = calculateBetResult('MATCH_RESULT', 'AWAY_WIN', 2, 0, 'FT');

            expect(result.status).toBe('LOST');
            expect(result.payoutMultiplier).toBe(0);
        });

        it('should return WON for DRAW when match ends in draw', () => {
            const result = calculateBetResult('MATCH_RESULT', 'DRAW', 2, 2, 'FT');

            expect(result.status).toBe('WON');
            expect(result.payoutMultiplier).toBe(2.0);
        });

        it('should return LOST for DRAW when there is a winner', () => {
            const result = calculateBetResult('MATCH_RESULT', 'DRAW', 3, 1, 'FT');

            expect(result.status).toBe('LOST');
            expect(result.payoutMultiplier).toBe(0);
        });

        it('should handle 0-0 draw correctly', () => {
            const result = calculateBetResult('MATCH_RESULT', 'DRAW', 0, 0, 'FT');

            expect(result.status).toBe('WON');
            expect(result.payoutMultiplier).toBe(2.0);
        });

        it('should work with AET (After Extra Time) status', () => {
            const result = calculateBetResult('MATCH_RESULT', 'HOME_WIN', 3, 2, 'AET');

            expect(result.status).toBe('WON');
            expect(result.payoutMultiplier).toBe(2.0);
        });

        it('should work with PEN (Penalties) status', () => {
            const result = calculateBetResult('MATCH_RESULT', 'AWAY_WIN', 1, 2, 'PEN');

            expect(result.status).toBe('WON');
            expect(result.payoutMultiplier).toBe(2.0);
        });
    });

    // ============================================================================
    // VOID CASES
    // ============================================================================
    describe('Void Cases', () => {
        it('should return VOID for postponed match (PST)', () => {
            const result = calculateBetResult('MATCH_RESULT', 'HOME_WIN', 0, 0, 'PST');

            expect(result.status).toBe('VOID');
            expect(result.payoutMultiplier).toBe(1.0);
            expect(result.reason).toContain('PST');
        });

        it('should return VOID for cancelled match (CANC)', () => {
            const result = calculateBetResult('MATCH_RESULT', 'AWAY_WIN', 1, 1, 'CANC');

            expect(result.status).toBe('VOID');
            expect(result.payoutMultiplier).toBe(1.0);
        });

        it('should return VOID for abandoned match (ABD)', () => {
            const result = calculateBetResult('MATCH_RESULT', 'DRAW', 0, 0, 'ABD');

            expect(result.status).toBe('VOID');
            expect(result.payoutMultiplier).toBe(1.0);
        });

        it('should return VOID for suspended match (SUSP)', () => {
            const result = calculateBetResult('MATCH_RESULT', 'HOME_WIN', 1, 0, 'SUSP');

            expect(result.status).toBe('VOID');
            expect(result.payoutMultiplier).toBe(1.0);
        });

        it('should return VOID for interrupted match (INT)', () => {
            const result = calculateBetResult('MATCH_RESULT', 'HOME_WIN', 2, 1, 'INT');

            expect(result.status).toBe('VOID');
            expect(result.payoutMultiplier).toBe(1.0);
        });
    });

    // ============================================================================
    // TOTAL GOALS BETS
    // ============================================================================
    describe('Total Goals Bets', () => {
        it('should return WON for OVER_2.5 when total goals > 2.5', () => {
            const result = calculateBetResult('TOTAL_GOALS', 'OVER_2.5', 2, 1, 'FT');

            expect(result.status).toBe('WON');
            expect(result.payoutMultiplier).toBe(1.8);
        });

        it('should return LOST for OVER_2.5 when total goals <= 2.5', () => {
            const result = calculateBetResult('TOTAL_GOALS', 'OVER_2.5', 1, 1, 'FT');

            expect(result.status).toBe('LOST');
            expect(result.payoutMultiplier).toBe(0);
        });

        it('should return WON for UNDER_2.5 when total goals < 2.5', () => {
            const result = calculateBetResult('TOTAL_GOALS', 'UNDER_2.5', 1, 0, 'FT');

            expect(result.status).toBe('WON');
            expect(result.payoutMultiplier).toBe(1.8);
        });

        it('should return LOST for UNDER_2.5 when total goals >= 2.5', () => {
            const result = calculateBetResult('TOTAL_GOALS', 'UNDER_2.5', 2, 2, 'FT');

            expect(result.status).toBe('LOST');
            expect(result.payoutMultiplier).toBe(0);
        });

        it('should handle OVER_3.5 correctly', () => {
            const result = calculateBetResult('TOTAL_GOALS', 'OVER_3.5', 3, 2, 'FT');

            expect(result.status).toBe('WON');
            expect(result.payoutMultiplier).toBe(1.8);
        });

        it('should handle UNDER_1.5 correctly', () => {
            const result = calculateBetResult('TOTAL_GOALS', 'UNDER_1.5', 0, 1, 'FT');

            expect(result.status).toBe('WON');
            expect(result.payoutMultiplier).toBe(1.8);
        });

        it('should handle high-scoring match for OVER bets', () => {
            const result = calculateBetResult('TOTAL_GOALS', 'OVER_2.5', 4, 3, 'FT');

            expect(result.status).toBe('WON');
            expect(result.payoutMultiplier).toBe(1.8);
        });

        it('should handle 0-0 for UNDER bets', () => {
            const result = calculateBetResult('TOTAL_GOALS', 'UNDER_2.5', 0, 0, 'FT');

            expect(result.status).toBe('WON');
            expect(result.payoutMultiplier).toBe(1.8);
        });
    });

    // ============================================================================
    // EDGE CASES
    // ============================================================================
    describe('Edge Cases', () => {
        it('should handle unknown selection gracefully', () => {
            const result = calculateBetResult('MATCH_RESULT', 'INVALID_SELECTION', 2, 1, 'FT');

            expect(result.status).toBe('LOST');
            expect(result.payoutMultiplier).toBe(0);
            expect(result.reason).toContain('Unknown selection');
        });

        it('should handle unknown bet type gracefully', () => {
            const result = calculateBetResult('UNKNOWN_TYPE', 'HOME_WIN', 2, 1, 'FT');

            expect(result.status).toBe('LOST');
            expect(result.payoutMultiplier).toBe(0);
            expect(result.reason).toContain('Unknown bet type');
        });

        it('should handle null/undefined scores', () => {
            const result = calculateBetResult('MATCH_RESULT', 'HOME_WIN', null, undefined, 'FT');

            expect(result.status).toBe('LOST'); // 0-0 draw
            expect(result.payoutMultiplier).toBe(0);
        });

        it('should handle missing match status', () => {
            const result = calculateBetResult('MATCH_RESULT', 'HOME_WIN', 2, 1, null);

            expect(result.status).toBe('WON');
            expect(result.payoutMultiplier).toBe(2.0);
        });

        it('should normalize case-insensitive inputs', () => {
            const result = calculateBetResult('match_result', 'home_win', 2, 1, 'ft');

            expect(result.status).toBe('WON');
            expect(result.payoutMultiplier).toBe(2.0);
        });

        it('should handle string numbers correctly', () => {
            const result = calculateBetResult('MATCH_RESULT', 'HOME_WIN', '3', '1', 'FT');

            expect(result.status).toBe('WON');
            expect(result.payoutMultiplier).toBe(2.0);
        });
    });

    // ============================================================================
    // FUTURE BET TYPES (Not Yet Implemented)
    // ============================================================================
    describe('Future Bet Types', () => {
        it('should return VOID for PLAYER_SCORE bets (not yet implemented)', () => {
            const result = calculateBetResult('PLAYER_SCORE', 'HAALAND_SCORES', 2, 1, 'FT');

            expect(result.status).toBe('VOID');
            expect(result.payoutMultiplier).toBe(1.0);
            expect(result.reason).toContain('not yet supported');
        });

        it('should return VOID for SUPERSUB bets (not yet implemented)', () => {
            const result = calculateBetResult('SUPERSUB', 'FODEN_ASSIST', 3, 0, 'FT');

            expect(result.status).toBe('VOID');
            expect(result.payoutMultiplier).toBe(1.0);
            expect(result.reason).toContain('not yet supported');
        });
    });

    // ============================================================================
    // BATCH CALCULATION
    // ============================================================================
    describe('Batch Calculation', () => {
        it('should calculate results for multiple bets', () => {
            const bets = [
                { id: 'bet1', bet_type: 'MATCH_RESULT', selection: 'HOME_WIN' },
                { id: 'bet2', bet_type: 'MATCH_RESULT', selection: 'AWAY_WIN' },
                { id: 'bet3', bet_type: 'MATCH_RESULT', selection: 'DRAW' }
            ];

            const matchData = {
                goals: { home: 2, away: 1 },
                fixture: { status: { short: 'FT' } }
            };

            const results = calculateBatchResults(bets, matchData);

            expect(results).toHaveLength(3);
            expect(results[0].betId).toBe('bet1');
            expect(results[0].status).toBe('WON');
            expect(results[1].betId).toBe('bet2');
            expect(results[1].status).toBe('LOST');
            expect(results[2].betId).toBe('bet3');
            expect(results[2].status).toBe('LOST');
        });

        it('should handle empty bets array', () => {
            const matchData = {
                goals: { home: 1, away: 1 },
                fixture: { status: { short: 'FT' } }
            };

            const results = calculateBatchResults([], matchData);

            expect(results).toHaveLength(0);
        });
    });

    // ============================================================================
    // HELPER FUNCTIONS
    // ============================================================================
    describe('Helper Functions', () => {
        describe('isMatchFinished', () => {
            it('should return true for FT status', () => {
                expect(isMatchFinished('FT')).toBe(true);
            });

            it('should return true for AET status', () => {
                expect(isMatchFinished('AET')).toBe(true);
            });

            it('should return true for PEN status', () => {
                expect(isMatchFinished('PEN')).toBe(true);
            });

            it('should return false for NS (Not Started) status', () => {
                expect(isMatchFinished('NS')).toBe(false);
            });

            it('should return false for LIVE status', () => {
                expect(isMatchFinished('LIVE')).toBe(false);
            });

            it('should return false for PST status', () => {
                expect(isMatchFinished('PST')).toBe(false);
            });

            it('should handle case-insensitive input', () => {
                expect(isMatchFinished('ft')).toBe(true);
            });
        });

        describe('shouldVoidMatch', () => {
            it('should return true for PST status', () => {
                expect(shouldVoidMatch('PST')).toBe(true);
            });

            it('should return true for CANC status', () => {
                expect(shouldVoidMatch('CANC')).toBe(true);
            });

            it('should return true for ABD status', () => {
                expect(shouldVoidMatch('ABD')).toBe(true);
            });

            it('should return false for FT status', () => {
                expect(shouldVoidMatch('FT')).toBe(false);
            });

            it('should return false for LIVE status', () => {
                expect(shouldVoidMatch('LIVE')).toBe(false);
            });

            it('should handle case-insensitive input', () => {
                expect(shouldVoidMatch('pst')).toBe(true);
            });
        });
    });
});
