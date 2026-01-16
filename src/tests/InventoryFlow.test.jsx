import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import Inventory from '../pages/Inventory';
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

describe('Inventory Flow Tests', () => {
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

    beforeEach(() => {
        vi.clearAllMocks();
        useGame.mockReturnValue({
            userProfile: mockUserProfile,
            loading: false,
            updateInventory: vi.fn(),
            spendEnergy: vi.fn(),
            supabase: { auth: { signOut: vi.fn() } }
        });
    });

    it('Test 1: Dashboard shows Inventory button instead of Shop', () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );

        // Verify Inventory button exists
        expect(screen.getByText('Inventory')).toBeInTheDocument();

        // Verify Shop button does NOT exist
        expect(screen.queryByText('Shop')).not.toBeInTheDocument();
    });

    it('Test 2: Cards in Play text appears above the deck', () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );

        // Verify "Cards in Play" status bar is visible
        expect(screen.getByText(/Cards in Play/i)).toBeInTheDocument();

        // Verify "View All" link is present
        expect(screen.getByText(/View All/i)).toBeInTheDocument();
    });

    it('Test 3: Clicking View All navigates to Cards In Play page', () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );

        const viewAllButton = screen.getByText(/View All/i);
        fireEvent.click(viewAllButton);

        // Verify navigation was called with correct route
        expect(mockNavigate).toHaveBeenCalledWith('/inventory/active');
    });

    it('Test 4: Clicking Energy Drink opens popup and Drink button fires action', () => {
        const consoleSpy = vi.spyOn(console, 'log');

        render(
            <MemoryRouter>
                <Inventory />
            </MemoryRouter>
        );

        // Find and click Energy Drink card
        const energyDrinkCard = screen.getByText('Energy Drink');
        fireEvent.click(energyDrinkCard);

        // Verify popup appears
        expect(screen.getByText('Restore 3 Energy?')).toBeInTheDocument();
        expect(screen.getByText('DRINK')).toBeInTheDocument();

        // Click DRINK button
        const drinkButton = screen.getByText('DRINK');
        fireEvent.click(drinkButton);

        // Verify action was fired
        expect(consoleSpy).toHaveBeenCalledWith('✅ Energy Drink consumed!');

        // Verify toast appears
        expect(screen.getByText('⚡ Energy Restored!')).toBeInTheDocument();

        consoleSpy.mockRestore();
    });

    it('Test 5: Inventory button navigates to /inventory', () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );

        const inventoryButton = screen.getByText('Inventory');
        fireEvent.click(inventoryButton);

        expect(mockNavigate).toHaveBeenCalledWith('/inventory');
    });

    it('Test 6: Inventory page displays consumables and deck sections', () => {
        render(
            <MemoryRouter>
                <Inventory />
            </MemoryRouter>
        );

        // Verify sections are present
        expect(screen.getByText('Consumables')).toBeInTheDocument();
        expect(screen.getByText('My Deck')).toBeInTheDocument();

        // Verify Energy Drink is displayed
        expect(screen.getByText('Energy Drink')).toBeInTheDocument();
        expect(screen.getByText('x3')).toBeInTheDocument();
    });
});
