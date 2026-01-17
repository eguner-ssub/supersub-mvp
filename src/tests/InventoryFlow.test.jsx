import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

    it('Test 2: Live Action or Pending Bets banner appears above the deck', () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );

        // Should show either "Live" or "Pending" banner based on mock data
        const hasLiveBanner = screen.queryByText(/Live/i);
        const hasPendingBanner = screen.queryByText(/Pending/i);

        expect(hasLiveBanner || hasPendingBanner).toBeTruthy();
    });

    it('Test 3: Clicking Watch Now/View All navigates correctly', () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );

        // Try to find either "Watch Now" or "View All" button
        const watchNowButton = screen.queryByText(/Watch Now/i);
        const viewAllButton = screen.queryByText(/View All/i);

        const button = watchNowButton || viewAllButton;
        expect(button).toBeInTheDocument();

        if (button) {
            fireEvent.click(button);
            expect(mockNavigate).toHaveBeenCalled();
        }
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
