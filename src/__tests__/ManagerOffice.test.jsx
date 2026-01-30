import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ManagerOffice from '../pages/ManagerOffice';

// ============================================================================
// MOCK DEPENDENCIES
// ============================================================================

const mockNavigate = vi.fn();

// Mock React Router
vi.mock('react-router-dom', () => ({
    ...vi.importActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));

// Mock the Game Context
const mockUseGame = vi.fn();
vi.mock('../context/GameContext', () => ({
    useGame: () => mockUseGame(),
}));

describe('ManagerOffice Simulation Drill', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ============================================================================
    // SCENARIO A: Standard State (No Live Matches)
    // ============================================================================
    it('renders the Quiet Office correctly', () => {
        // Setup Mock Data
        mockUseGame.mockReturnValue({
            userProfile: { energy: 3, max_energy: 5, coins: 100, club_name: 'Test FC' },
        });

        render(<ManagerOffice />);

        // Verify Background Image presence (using the alt text)
        const bgImage = screen.getByAltText('Manager Office');
        expect(bgImage).toBeInTheDocument();
        expect(bgImage).toHaveAttribute('src', '/assets/manager-room-empty.webp');

        // Verify "LIVE" badge is MISSING (Quiet State)
        const liveBadge = screen.queryByText(/LIVE/i);
        expect(liveBadge).not.toBeInTheDocument();
    });

    // ============================================================================
    // SCENARIO B: Navigation Tests (The Hitboxes)
    // ============================================================================
    it('navigates to Dashboard when Laptop (Workstation) is clicked', () => {
        mockUseGame.mockReturnValue({
            userProfile: { energy: 3, max_energy: 5, coins: 100 }
        });

        render(<ManagerOffice />);

        // Target the Laptop Hotspot via data-testid
        const laptopHotspot = screen.getByTestId('hotspot-laptop');
        fireEvent.click(laptopHotspot);

        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    it('navigates to View Pending when Tablet (Live Ops) is clicked', () => {
        mockUseGame.mockReturnValue({
            userProfile: { energy: 3, max_energy: 5, coins: 100 }
        });

        render(<ManagerOffice />);

        const tabletHotspot = screen.getByTestId('hotspot-tablet');
        fireEvent.click(tabletHotspot);

        expect(mockNavigate).toHaveBeenCalledWith('/view-pending');
    });

    it('navigates to Messages when Phone (Intel) is clicked', () => {
        mockUseGame.mockReturnValue({
            userProfile: { energy: 3, max_energy: 5, coins: 100 }
        });

        render(<ManagerOffice />);

        const phoneHotspot = screen.getByTestId('hotspot-phone');
        fireEvent.click(phoneHotspot);

        expect(mockNavigate).toHaveBeenCalledWith('/messages');
    });

    it('navigates to History when Bookcase (Archives) is clicked', () => {
        mockUseGame.mockReturnValue({
            userProfile: { energy: 3, max_energy: 5, coins: 100 }
        });

        render(<ManagerOffice />);

        const bookcaseHotspot = screen.getByTestId('hotspot-bookcase');
        fireEvent.click(bookcaseHotspot);

        expect(mockNavigate).toHaveBeenCalledWith('/history');
    });

    // ============================================================================
    // SCENARIO C: User Profile Display
    // ============================================================================
    it('displays user profile data correctly', () => {
        mockUseGame.mockReturnValue({
            userProfile: {
                energy: 2,
                max_energy: 5,
                coins: 1500,
                club_name: 'Arsenal FC'
            },
        });

        render(<ManagerOffice />);

        // Check Energy Display
        expect(screen.getByText('2/5')).toBeInTheDocument();

        // Check Coins Display
        expect(screen.getByText('1500')).toBeInTheDocument();

        // Check Club Name
        expect(screen.getByText('Arsenal FC')).toBeInTheDocument();
    });

    // ============================================================================
    // SCENARIO D: Live Match State Logic (Future Enhancement)
    // ============================================================================
    it('TODO: activates the "LIVE" UI when matches are detected', () => {
        // NOTE: Currently liveMatches is hardcoded as [] in the component
        // This test serves as a reminder to refactor the component to:
        // 1. Accept liveMatches from useGame() context
        // 2. Make the state testable

        // Future implementation:
        // mockUseGame.mockReturnValue({
        //   userProfile: {},
        //   liveMatches: [{ id: 1, team: 'Arsenal' }]
        // });

        // render(<ManagerOffice />);

        // const liveBadge = screen.getByText(/LIVE/i);
        // expect(liveBadge).toBeInTheDocument();

        // const bgImage = screen.getByAltText('Manager Office');
        // expect(bgImage).toHaveAttribute('src', '/assets/manager-room-packed.webp');

        expect(true).toBe(true); // Placeholder until refactored
    });

});
