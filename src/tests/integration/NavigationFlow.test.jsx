import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ManagerOffice from '../../features/office/ManagerOffice';
import LockerRoom from '../../features/locker-room/LockerRoom';

// Mock GameContext
vi.mock('../../shared/context/GameContext', () => ({
    GameProvider: ({ children }) => <div>{children}</div>,
    useGame: () => ({
        userProfile: {
            id: 'test-user',
            club_name: 'Test FC',
            coins: 1000,
            energy: 3,
            max_energy: 3,
            inventory: ['c_match_result']
        },
        loading: false
    })
}));

// Mock Assets to simplify DOM
vi.mock('../../shared/ui/MobileLayout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../../shared/ui/NavigationShell', () => ({ default: ({ children }) => <div>{children}</div> }));

// Helper to render with all necessary routes defined
const renderWithRouter = (ui, initialEntries = ['/']) => {
    return render(
        <MemoryRouter initialEntries={initialEntries}>
            <Routes>
                <Route path="/manager-office" element={<ManagerOffice />} />
                <Route path="/inventory" element={<LockerRoom />} />

                {/* TARGET ROUTES - Critical for Navigation Tests */}
                <Route path="/dashboard" element={<div>Season Stats</div>} />
                <Route path="/messages" element={<div>Manager Inbox</div>} />
                <Route path="/view-pending" element={<div>Global Rankings</div>} />
                <Route path="/match-hub" element={<div>Match Hub</div>} />
            </Routes>
        </MemoryRouter>
    );
};

describe('Navigation & Inventory Flow', () => {

    it('Manager Office: "Laptop" takes user to Stats', async () => {
        renderWithRouter(null, ['/manager-office']);
        const hotspot = screen.getByTestId('hotspot-laptop');
        fireEvent.click(hotspot);
        await waitFor(() => expect(screen.getByText('Season Stats')).toBeInTheDocument());
    });

    it('Manager Office: "Phone" takes user to Inbox', async () => {
        renderWithRouter(null, ['/manager-office']);
        fireEvent.click(screen.getByTestId('hotspot-phone'));
        await waitFor(() => expect(screen.getByText('Manager Inbox')).toBeInTheDocument());
    });

    it('Manager Office: "Tablet" takes user to Leaderboard', async () => {
        renderWithRouter(null, ['/manager-office']);
        fireEvent.click(screen.getByTestId('hotspot-tablet'));
        await waitFor(() => expect(screen.getByText('Global Rankings')).toBeInTheDocument());
    });

    it('Manager Office: "Bookcase" takes user to Inventory', async () => {
        renderWithRouter(null, ['/manager-office']);
        // The LockerRoom component should load. 
        // Since we didn't mock ViewLedger here, we just check for a known element in LockerRoom
        fireEvent.click(screen.getByTestId('hotspot-bookcase'));
        await waitFor(() => {
            // Check for the navigation tabs in LockerRoom
            expect(screen.getByText(/Ledger/i)).toBeInTheDocument();
        });
    });
});
