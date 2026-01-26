import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ManagerOffice from '../pages/ManagerOffice';
import { useGame } from '../context/GameContext';

// Mock Dependencies
vi.mock('../context/GameContext', () => ({
    useGame: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

describe('ManagerOffice', () => {
    const mockProfile = {
        energy: 5,
        max_energy: 5,
        coins: 1000,
        club_name: 'Antigravity FC'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        useGame.mockReturnValue({ userProfile: mockProfile });
    });

    it('renders the office background and HUD', () => {
        render(
            <MemoryRouter>
                <ManagerOffice />
            </MemoryRouter>
        );

        // Check for HUD elements
        expect(screen.getByText('Antigravity FC')).toBeInTheDocument();
        // Energy is displayed as "5/5" format
        expect(screen.getByText(/5.*5/)).toBeInTheDocument();
        expect(screen.getByText('1000')).toBeInTheDocument(); // Coins

        // Check for Background Image (by alt text)
        expect(screen.getByAltText('Manager Office')).toBeInTheDocument();
    });

    it('navigates to Match Hub when Window is clicked', () => {
        render(
            <MemoryRouter>
                <ManagerOffice />
            </MemoryRouter>
        );

        const windowHotspot = screen.getByTestId('hotspot-window');
        fireEvent.click(windowHotspot);

        expect(mockNavigate).toHaveBeenCalledWith('/match-hub');
    });

    it('navigates to Scouting when Laptop is clicked', () => {
        render(
            <MemoryRouter>
                <ManagerOffice />
            </MemoryRouter>
        );

        const laptopHotspot = screen.getByTestId('hotspot-laptop');
        fireEvent.click(laptopHotspot);

        expect(mockNavigate).toHaveBeenCalledWith('/scouting');
    });

    it('navigates to Leaderboard when Tablet is clicked', () => {
        render(
            <MemoryRouter>
                <ManagerOffice />
            </MemoryRouter>
        );

        const tabletHotspot = screen.getByTestId('hotspot-tablet-office');
        fireEvent.click(tabletHotspot);

        expect(mockNavigate).toHaveBeenCalledWith('/leaderboard');
    });

    it('navigates to Inbox when Phone is clicked', () => {
        render(
            <MemoryRouter>
                <ManagerOffice />
            </MemoryRouter>
        );

        const phoneHotspot = screen.getByTestId('hotspot-phone');
        fireEvent.click(phoneHotspot);

        expect(mockNavigate).toHaveBeenCalledWith('/inbox');
    });

    it('navigates to History when Bookcase is clicked', () => {
        render(
            <MemoryRouter>
                <ManagerOffice />
            </MemoryRouter>
        );

        const bookcaseHotspot = screen.getByTestId('hotspot-bookcase');
        fireEvent.click(bookcaseHotspot);

        expect(mockNavigate).toHaveBeenCalledWith('/history');
    });

    it('navigates back to Dashboard when back button is clicked', () => {
        render(
            <MemoryRouter>
                <ManagerOffice />
            </MemoryRouter>
        );

        const backButton = screen.getByTestId('nav-dressing-room');
        fireEvent.click(backButton);

        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    it('displays progressive loading states', () => {
        render(
            <MemoryRouter>
                <ManagerOffice />
            </MemoryRouter>
        );

        const image = screen.getByAltText('Manager Office');

        // Image should have opacity classes for progressive loading
        expect(image.className).toContain('transition-opacity');
        expect(image.className).toContain('duration-700');
    });

    it('renders with minimal user profile data', () => {
        useGame.mockReturnValue({
            userProfile: {
                energy: 2,
                coins: 50,
                name: 'Test Manager'
            }
        });

        render(
            <MemoryRouter>
                <ManagerOffice />
            </MemoryRouter>
        );

        // Should fall back to name if club_name is missing
        expect(screen.getByText('Test Manager')).toBeInTheDocument();
        // Energy is displayed as "2/3" format (max_energy defaults to 3)
        expect(screen.getByText(/2.*3/)).toBeInTheDocument();
        expect(screen.getByText('50')).toBeInTheDocument();
    });

    it('applies tactile feedback classes to all hitboxes', () => {
        render(
            <MemoryRouter>
                <ManagerOffice />
            </MemoryRouter>
        );

        const hitboxes = [
            screen.getByTestId('hotspot-window'),
            screen.getByTestId('hotspot-laptop'),
            screen.getByTestId('hotspot-tablet-office'),
            screen.getByTestId('hotspot-phone'),
            screen.getByTestId('hotspot-bookcase'),
        ];

        hitboxes.forEach(hitbox => {
            expect(hitbox.className).toContain('cursor-pointer');
            expect(hitbox.className).toContain('transition-all');
            expect(hitbox.className).toContain('duration-100');
        });
    });
});
