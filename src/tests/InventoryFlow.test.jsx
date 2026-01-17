import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import LockerRoom from '../pages/LockerRoom';
import { useGame } from '../context/GameContext';

// Mock GameContext
vi.mock('../context/GameContext', () => ({
    useGame: vi.fn(),
}));

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return { ...actual, useNavigate: () => mockNavigate };
});

describe('Locker Room Flow Tests', () => {
    const mockUserProfile = {
        id: '123',
        name: 'Test Manager',
        club_name: 'Test FC',
        email: 'test@example.com',
        energy: 3,
        max_energy: 5,
        coins: 1000,
        inventory: ['c_match_result', 'c_match_result', 'c_total_goals']
    };

    const mockSupabase = {
        from: vi.fn((table) => {
            if (table === 'predictions') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            eq: vi.fn((field, value) => {
                                // Return LIVE bets for test 2 & 3
                                if (value === 'LIVE') {
                                    return Promise.resolve({
                                        data: [{
                                            id: 'bet-1',
                                            status: 'LIVE',
                                            team_name: 'Arsenal vs Chelsea',
                                            selection: 'HOME_WIN'
                                        }],
                                        error: null
                                    });
                                }
                                // Return empty for PENDING
                                return Promise.resolve({ data: [], error: null });
                            })
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
        channel: vi.fn(() => ({
            on: vi.fn().mockReturnThis(),
            subscribe: vi.fn()
        })),
        removeChannel: vi.fn(),
        auth: {
            getSession: vi.fn().mockResolvedValue({ data: { session: null } })
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        useGame.mockReturnValue({
            userProfile: mockUserProfile,
            loading: false,
            updateInventory: vi.fn(),
            spendEnergy: vi.fn(),
            supabase: mockSupabase,
            checkActiveBets: vi.fn(),
            loadProfile: vi.fn()
        });
    });

    it('Test 1: Dashboard shows Inventory button instead of Shop', () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );

        expect(screen.getByText('Inventory')).toBeInTheDocument();
        expect(screen.queryByText('Shop')).not.toBeInTheDocument();
    });

    it('Test 2: Live Action or Pending Bets banner appears above the deck', async () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );

        // Wait for async data to load
        await waitFor(() => {
            const hasLiveBanner = screen.queryByText(/Live Match/i);
            const hasPendingBanner = screen.queryByText(/Pending Bet/i);
            expect(hasLiveBanner || hasPendingBanner).toBeTruthy();
        }, { timeout: 3000 });
    });

    it('Test 3: Clicking Watch Now/View All navigates correctly', async () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );

        // Wait for banner to appear
        const button = await waitFor(() => {
            const watchNowButton = screen.queryByText(/Watch Now/i);
            const viewAllButton = screen.queryByText(/View All/i);
            const foundButton = watchNowButton || viewAllButton;
            expect(foundButton).toBeInTheDocument();
            return foundButton;
        }, { timeout: 3000 });

        fireEvent.click(button);
        expect(mockNavigate).toHaveBeenCalled();
    });

    it('Test 4: Inventory button navigates to /inventory', () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );

        const inventoryButton = screen.getByText('Inventory');
        fireEvent.click(inventoryButton);

        expect(mockNavigate).toHaveBeenCalledWith('/inventory');
    });

    it('Test 5: LockerRoom displays hotspot navigation', () => {
        render(
            <MemoryRouter>
                <LockerRoom />
            </MemoryRouter>
        );

        // Verify all hotspot labels are present
        expect(screen.getByText('Whiteboard')).toBeInTheDocument();
        expect(screen.getByText('Tablet')).toBeInTheDocument();
        expect(screen.getByText('Kit Bag')).toBeInTheDocument();
        expect(screen.getByText('Ledger')).toBeInTheDocument();
        expect(screen.getByText('Fridge')).toBeInTheDocument();
    });

    it('Test 6: LockerRoom tab navigation works', () => {
        render(
            <MemoryRouter>
                <LockerRoom />
            </MemoryRouter>
        );

        // Click on Tablet tab
        const tabletButton = screen.getByText('Tablet');
        fireEvent.click(tabletButton);

        // Verify navigation was called with query param
        expect(mockNavigate).toHaveBeenCalledWith('/inventory?tab=live', { replace: true });
    });
});
