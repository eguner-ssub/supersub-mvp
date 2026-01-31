import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// CRITICAL: Mock GameContext BEFORE importing components that use it
vi.mock('../context/GameContext', () => ({
    GameProvider: ({ children }) => <div>{children}</div>,
    useGame: () => ({
        userProfile: {
            id: 'test-user',
            club_name: 'Test FC',
            coins: 1000,
            energy: 3,
            max_energy: 3,
            inventory: ['c_match_result', 'c_total_goals', 'c_match_result']
        },
        checkActiveBets: vi.fn(),
        loading: false
    })
}));

// Mock heavy dependencies
vi.mock('../components/MobileLayout', () => ({
    default: ({ children }) => <div data-testid="mobile-layout">{children}</div>
}));

vi.mock('../components/NavigationShell', () => ({
    default: ({ children }) => <div data-testid="navigation-shell">{children}</div>
}));

vi.mock('../components/locker/ViewPendingCarousel', () => ({
    default: () => <div data-testid="tactical-carousel">CAROUSEL LOADED</div>
}));

vi.mock('../components/locker/ViewLive', () => ({
    default: () => <div data-testid="view-live">LIVE VIEW</div>
}));

vi.mock('../components/locker/ViewLedger', () => ({
    default: () => <div data-testid="view-ledger">NO SETTLED BETS</div>
}));

vi.mock('../components/locker/ViewFridge', () => ({
    default: () => <div data-testid="view-fridge">FRIDGE VIEW</div>
}));

vi.mock('../components/CardBase', () => ({
    default: ({ label }) => <div data-testid="card-base">{label}</div>
}));

// NOW import components after mocks are set up
import ManagerOffice from '../pages/ManagerOffice';
import LockerRoom from '../pages/LockerRoom';
import ComingSoon from '../pages/ComingSoon';

// Helper: Render with Router
const renderWithRouter = (ui, initialEntries = ['/']) => {
    return render(
        <MemoryRouter initialEntries={initialEntries}>
            <Routes>
                <Route path="/" element={<ManagerOffice />} />
                <Route path="/manager-office" element={<ManagerOffice />} />
                <Route path="/inventory" element={<LockerRoom />} />
                <Route path="/stats" element={<ComingSoon title="Season Stats" message="Advanced player analytics coming in v1.1" />} />
                <Route path="/inbox" element={<ComingSoon title="Manager Inbox" message="Social features are currently locked." />} />
                <Route path="/leaderboard" element={<ComingSoon title="Global Rankings" message="Competition season hasn't started yet." />} />
                <Route path="/match-hub" element={<div data-testid="match-hub">MATCH HUB</div>} />
            </Routes>
        </MemoryRouter>
    );
};

describe('🛑 CRASH TEST: Navigation & Inventory Flow', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // --- SCENARIO 1: MANAGER OFFICE HOTSPOTS ---
    it('Manager Office: "Window" takes user to Match Hub', async () => {
        renderWithRouter(<ManagerOffice />, ['/manager-office']);

        // Find and click Window Hotspot
        const windowHotspot = screen.getByTestId('hotspot-window');
        fireEvent.click(windowHotspot);

        // Assert we moved paths
        await waitFor(() => {
            expect(screen.getByTestId('match-hub')).toBeInTheDocument();
        });
    });

    it('Manager Office: "Laptop" takes user to Coming Soon (Stats)', async () => {
        renderWithRouter(<ManagerOffice />, ['/manager-office']);

        const laptopHotspot = screen.getByTestId('hotspot-laptop');
        fireEvent.click(laptopHotspot);

        await waitFor(() => {
            expect(screen.getByText('Season Stats')).toBeInTheDocument();
            expect(screen.getByText(/Advanced player analytics/i)).toBeInTheDocument();
            expect(screen.getByText(/Return to HQ/i)).toBeInTheDocument();
        });
    });

    it('Manager Office: "Phone" takes user to Coming Soon (Inbox)', async () => {
        renderWithRouter(<ManagerOffice />, ['/manager-office']);

        const phoneHotspot = screen.getByTestId('hotspot-phone');
        fireEvent.click(phoneHotspot);

        await waitFor(() => {
            expect(screen.getByText('Manager Inbox')).toBeInTheDocument();
            expect(screen.getByText(/Social features are currently locked/i)).toBeInTheDocument();
        });
    });

    it('Manager Office: "Tablet" takes user to Coming Soon (Leaderboard)', async () => {
        renderWithRouter(<ManagerOffice />, ['/manager-office']);

        const tabletHotspot = screen.getByTestId('hotspot-tablet');
        fireEvent.click(tabletHotspot);

        await waitFor(() => {
            expect(screen.getByText('Global Rankings')).toBeInTheDocument();
            expect(screen.getByText(/Competition season hasn't started yet/i)).toBeInTheDocument();
        });
    });

    it('Manager Office: "Bookcase" takes user to Inventory Ledger tab', async () => {
        renderWithRouter(<ManagerOffice />, ['/manager-office']);

        const bookcaseHotspot = screen.getByTestId('hotspot-bookcase');
        fireEvent.click(bookcaseHotspot);

        await waitFor(() => {
            expect(screen.getByText('Locker Room')).toBeInTheDocument();
            // The ledger tab should be active based on URL param
            expect(screen.getByTestId('view-ledger')).toBeInTheDocument();
        });
    });

    // --- SCENARIO 2: INVENTORY/LOCKER ROOM TABS ---
    it('Inventory: Default view is "Pending" (Whiteboard)', async () => {
        renderWithRouter(<LockerRoom />, ['/inventory']);

        // Check for Locker Room header
        expect(screen.getByText('Locker Room')).toBeInTheDocument();

        // Default tab should be 'pending' (Whiteboard)
        await waitFor(() => {
            expect(screen.getByTestId('tactical-carousel')).toBeInTheDocument();
        });
    });

    it('Inventory: Switching to "Kit Bag" (Deck) shows cards', async () => {
        renderWithRouter(<LockerRoom />, ['/inventory']);

        // Find the Tab button for 'Kit Bag' (deck)
        const deckTab = screen.getByText('Kit Bag');
        fireEvent.click(deckTab);

        // Expect cards to appear (we mocked CardBase)
        await waitFor(() => {
            expect(screen.getByText(/Available Cards/i)).toBeInTheDocument();
            expect(screen.getAllByTestId('card-base').length).toBeGreaterThan(0);
        });
    });

    it('Inventory: Switching to "Ledger" shows ledger view', async () => {
        renderWithRouter(<LockerRoom />, ['/inventory']);

        const ledgerTab = screen.getByText('Ledger');
        fireEvent.click(ledgerTab);

        // Expect ledger view
        await waitFor(() => {
            expect(screen.getByTestId('view-ledger')).toBeInTheDocument();
        });
    });

    it('Inventory: Direct navigation to Ledger tab via URL param', async () => {
        renderWithRouter(<LockerRoom />, ['/inventory?tab=ledger']);

        // Should load directly to ledger tab
        await waitFor(() => {
            expect(screen.getByTestId('view-ledger')).toBeInTheDocument();
        });
    });

    // --- SCENARIO 3: COMING SOON BACK BUTTON ---
    it('ComingSoon: Back button exists and is clickable', async () => {
        renderWithRouter(<ComingSoon title="Test Page" message="Test message" />, ['/stats']);

        const backButton = screen.getByText(/Return to HQ/i);
        expect(backButton).toBeInTheDocument();
        expect(backButton).toHaveClass('transition-colors');
    });

    // --- SCENARIO 4: INTEGRATION TEST ---
    it('Full Flow: Manager Office → Stats → Verify Navigation', async () => {
        renderWithRouter(<ManagerOffice />, ['/manager-office']);

        // Step 1: Click laptop to go to stats
        const laptopHotspot = screen.getByTestId('hotspot-laptop');
        fireEvent.click(laptopHotspot);

        // Step 2: Verify we're on stats page
        await waitFor(() => {
            expect(screen.getByText('Season Stats')).toBeInTheDocument();
        });

        // Step 3: Verify back button exists
        const backButton = screen.getByText(/Return to HQ/i);
        expect(backButton).toBeInTheDocument();
    });

});
