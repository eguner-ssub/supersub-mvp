import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ManagerOffice from '../../features/office/ManagerOffice';

// Mock GameContext
vi.mock('../../shared/context/GameContext', () => ({
    GameProvider: ({ children }) => <div>{children}</div>,
    useGame: () => ({
        userProfile: {
            id: 'test-user',
            club_name: 'Test FC',
            points: 1000,
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

                {/* TARGET ROUTES — match actual navigate() calls in ManagerOffice */}
                <Route path="/scouting" element={<div>Season Stats</div>} />
                <Route path="/inbox" element={<div>Manager Inbox</div>} />
                <Route path="/leaderboard" element={<div>Global Rankings</div>} />
                <Route path="/history" element={<div>History Archive</div>} />
                <Route path="/match-hub" element={<div>Match Hub</div>} />
                <Route path="/dashboard" element={<div>Dashboard</div>} />
            </Routes>
        </MemoryRouter>
    );
};

describe('Navigation & Inventory Flow', () => {

    beforeEach(() => {
        // Suppress "Invalid URL" from fetch('/api/matches') in jsdom
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ response: [] }),
        });
    });

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
        // Component uses data-testid="hotspot-tablet-office" for the tablet hotspot
        fireEvent.click(screen.getByTestId('hotspot-tablet-office'));
        await waitFor(() => expect(screen.getByText('Global Rankings')).toBeInTheDocument());
    });

    it('Manager Office: "Bookcase" takes user to History', async () => {
        renderWithRouter(null, ['/manager-office']);
        fireEvent.click(screen.getByTestId('hotspot-bookcase'));
        await waitFor(() => {
            expect(screen.getByText('History Archive')).toBeInTheDocument();
        });
    });
});
