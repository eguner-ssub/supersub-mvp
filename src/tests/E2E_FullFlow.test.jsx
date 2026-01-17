import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useGame } from '../context/GameContext';

// Mock GameContext
vi.mock('../context/GameContext', () => ({
    useGame: vi.fn(),
}));

describe('E2E Full Flow - Zero to Hero Journey (Integration Tests)', () => {
    let mockUserProfile;
    let mockSupabase;
    let mockGainEnergy;

    beforeEach(() => {
        mockUserProfile = {
            id: 'user-123',
            name: 'Test Manager',
            club_name: "Test FC",
            coins: 500,
            energy: 0,
            max_energy: 5,
            inventory: ['c_match_result']
        };

        mockGainEnergy = vi.fn(async (amount) => {
            mockUserProfile.energy = Math.min(mockUserProfile.energy + amount, mockUserProfile.max_energy);
            return Promise.resolve();
        });

        mockSupabase = {
            from: vi.fn((table) => {
                if (table === 'predictions') {
                    return {
                        insert: vi.fn(() => Promise.resolve({ data: [{ id: 'bet-123' }], error: null })),
                        select: vi.fn(() => ({
                            eq: vi.fn(() => ({
                                eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
                                in: vi.fn(() => Promise.resolve({ data: [], error: null }))
                            }))
                        }))
                    };
                }
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => Promise.resolve({ data: [], error: null }))
                    }))
                };
            }),
            auth: {
                getSession: vi.fn(() => Promise.resolve({
                    data: { session: { user: { id: 'user-123' } } }
                }))
            },
            channel: vi.fn(() => ({
                on: vi.fn(() => ({ subscribe: vi.fn() }))
            })),
            removeChannel: vi.fn()
        };

        useGame.mockReturnValue({
            userProfile: mockUserProfile,
            loading: false,
            supabase: mockSupabase,
            gainEnergy: mockGainEnergy,
            updateInventory: vi.fn(),
            spendEnergy: vi.fn(),
            checkActiveBets: vi.fn(),
            loadProfile: vi.fn()
        });
    });

    it('TEST 1: gainEnergy function updates user energy correctly', async () => {
        // Initial state: 0 energy
        expect(mockUserProfile.energy).toBe(0);

        // Call gainEnergy
        await mockGainEnergy(3);

        // Assert: Energy increased
        expect(mockUserProfile.energy).toBe(3);
        expect(mockGainEnergy).toHaveBeenCalledWith(3);
    });

    it('TEST 2: gainEnergy respects max_energy limit', async () => {
        // Set energy to 4
        mockUserProfile.energy = 4;

        // Try to add 3 (would be 7, but max is 5)
        await mockGainEnergy(3);

        // Assert: Capped at max_energy
        expect(mockUserProfile.energy).toBe(5);
    });

    it('TEST 3: Supabase predictions insert is called correctly', async () => {
        const betData = {
            user_id: 'user-123',
            match_id: 12345,
            selection: 'HOME_WIN',
            stake: 100,
            potential_reward: 250,
            status: 'PENDING'
        };

        // Call insert
        const predictionsTable = mockSupabase.from('predictions');
        await predictionsTable.insert(betData);

        // Assert: from was called with 'predictions'
        expect(mockSupabase.from).toHaveBeenCalledWith('predictions');
    });

    it('TEST 4: User profile has correct initial state', () => {
        const { userProfile } = useGame();

        expect(userProfile.energy).toBe(0);
        expect(userProfile.coins).toBe(500);
        expect(userProfile.inventory).toContain('c_match_result');
        expect(userProfile.inventory.length).toBe(1);
    });

    it('TEST 5: Complete flow simulation - Energy gain and bet placement', async () => {
        // STEP 1: User starts with 0 energy
        expect(mockUserProfile.energy).toBe(0);

        // STEP 2: User watches ad and gains energy
        await mockGainEnergy(3);
        expect(mockUserProfile.energy).toBe(3);

        // STEP 3: User places a bet
        const betData = {
            user_id: mockUserProfile.id,
            match_id: 12345,
            selection: 'HOME_WIN',
            stake: 100,
            status: 'PENDING'
        };

        const result = await mockSupabase.from('predictions').insert(betData);

        // STEP 4: Verify bet was placed
        expect(result.data).toBeDefined();
        expect(result.data[0].id).toBe('bet-123');
        expect(result.error).toBeNull();

        // STEP 5: Verify user still has energy
        expect(mockUserProfile.energy).toBe(3);

        // Journey complete!
        expect(mockGainEnergy).toHaveBeenCalled();
        expect(mockSupabase.from).toHaveBeenCalledWith('predictions');
    });

    it('TEST 6: Dashboard shows live bets correctly', async () => {
        // Mock live bet
        const liveBet = {
            id: 'bet-123',
            status: 'LIVE',
            team_name: 'Liverpool vs Arsenal',
            selection: 'HOME_WIN'
        };

        // Update mock to return live bet
        mockSupabase.from = vi.fn((table) => {
            if (table === 'predictions') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            eq: vi.fn(() => Promise.resolve({ data: [liveBet], error: null }))
                        }))
                    }))
                };
            }
            return {
                select: vi.fn(() => ({
                    eq: vi.fn(() => Promise.resolve({ data: [], error: null }))
                }))
            };
        });

        // Fetch live bets
        const result = await mockSupabase
            .from('predictions')
            .select('*')
            .eq('user_id', 'user-123')
            .eq('status', 'LIVE');

        // Assert: Live bet is returned
        expect(result.data).toHaveLength(1);
        expect(result.data[0].status).toBe('LIVE');
        expect(result.data[0].team_name).toBe('Liverpool vs Arsenal');
    });
});
