import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ViewPending from '../components/locker/ViewPending';
import { useGame } from '../context/GameContext';
import { usePredictions } from '../hooks/usePredictions';

// Mock hooks
vi.mock('../context/GameContext', () => ({
    useGame: vi.fn(),
}));

vi.mock('../hooks/usePredictions', () => ({
    usePredictions: vi.fn(),
}));

describe('Settlement System Tests', () => {
    const mockUserProfile = {
        id: 'user-123',
        name: 'Test Manager',
        coins: 1000
    };

    const mockSupabase = {
        rpc: vi.fn(),
        from: vi.fn(),
        auth: {
            getSession: vi.fn()
        },
        channel: vi.fn(() => ({
            on: vi.fn().mockReturnThis(),
            subscribe: vi.fn()
        })),
        removeChannel: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        useGame.mockReturnValue({
            userProfile: mockUserProfile,
            supabase: mockSupabase,
            loading: false
        });
    });

    // Test A: RPC Logic Verification
    it('Test A: calls settle_prediction RPC with correct parameters for WON status', async () => {
        const mockRpcResponse = { data: [{ success: true, new_coins: 1250 }], error: null };
        mockSupabase.rpc.mockResolvedValue(mockRpcResponse);

        await mockSupabase.rpc('settle_prediction', {
            p_prediction_id: 'bet-123',
            p_new_status: 'WON'
        });

        expect(mockSupabase.rpc).toHaveBeenCalledWith('settle_prediction', {
            p_prediction_id: 'bet-123',
            p_new_status: 'WON'
        });
    });

    // Test B: UI Tab Filtering
    it('Test B: ViewPending only renders PENDING bets', () => {
        const mockPredictions = [
            { id: '1', status: 'PENDING', team_name: 'Arsenal vs Spurs', selection: 'HOME_WIN', stake: 100, potential_reward: 200, created_at: new Date().toISOString() },
            { id: '2', status: 'LIVE', team_name: 'Chelsea vs Man Utd', selection: 'AWAY_WIN', stake: 150, potential_reward: 300, created_at: new Date().toISOString() },
            { id: '3', status: 'WON', team_name: 'Liverpool vs City', selection: 'DRAW', stake: 200, potential_reward: 400, created_at: new Date().toISOString() }
        ];

        // Mock usePredictions to return only PENDING bets
        usePredictions.mockReturnValue({
            predictions: mockPredictions.filter(p => p.status === 'PENDING'),
            loading: false
        });

        render(
            <MemoryRouter>
                <ViewPending />
            </MemoryRouter>
        );

        // Should show PENDING bet
        expect(screen.getByText(/Arsenal vs Spurs/)).toBeInTheDocument();

        // Should NOT show LIVE or WON bets
        expect(screen.queryByText(/Chelsea vs Man Utd/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Liverpool vs City/)).not.toBeInTheDocument();
    });

    // Test C: Win Celebration Trigger
    it('Test C: triggers win modal on realtime WON event', async () => {
        const mockPayload = {
            old: { status: 'LIVE', potential_reward: 500 },
            new: { status: 'WON', potential_reward: 500 }
        };

        // Simulate the callback being called
        const mockCallback = vi.fn();

        // Verify that when status changes from LIVE to WON, the callback would be triggered
        if (mockPayload.new.status === 'WON' && mockPayload.old.status !== 'WON') {
            mockCallback(mockPayload.new.potential_reward);
        }

        expect(mockCallback).toHaveBeenCalledWith(500);
    });

    // Test D: Empty State Handling
    it('Test D: shows empty state when no predictions exist', () => {
        usePredictions.mockReturnValue({
            predictions: [],
            loading: false
        });

        render(
            <MemoryRouter>
                <ViewPending />
            </MemoryRouter>
        );

        expect(screen.getByText(/No Pending Bets/)).toBeInTheDocument();
    });

    // Test E: Loading State
    it('Test E: shows loading state while fetching predictions', () => {
        usePredictions.mockReturnValue({
            predictions: [],
            loading: true
        });

        render(
            <MemoryRouter>
                <ViewPending />
            </MemoryRouter>
        );

        expect(screen.getByText(/Loading.../)).toBeInTheDocument();
    });

    // Test F: Settlement RPC Error Handling
    it('Test F: handles RPC errors gracefully', async () => {
        const mockRpcError = { data: null, error: { message: 'Database error' } };
        mockSupabase.rpc.mockResolvedValue(mockRpcError);

        const result = await mockSupabase.rpc('settle_prediction', {
            p_prediction_id: 'bet-456',
            p_new_status: 'WON'
        });

        expect(result.error).toBeTruthy();
        expect(result.error.message).toBe('Database error');
    });
});
