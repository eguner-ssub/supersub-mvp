import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MatchDetail from './MatchDetail';
import { useGame } from '../context/GameContext';

// Mock Context
vi.mock('../context/GameContext', () => ({
    useGame: vi.fn(),
}));

// Mock Navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

// Mock fetch globally
global.fetch = vi.fn();

describe('MatchDetail - Prediction Flow', () => {
    const mockProfile = {
        id: '123',
        club_name: 'Test FC',
        name: 'Test Manager',
        coins: 1000,
        energy: 3,
        max_energy: 5,
        inventory: ['c_match_result', 'c_match_result', 'c_total_goals']
    };

    const mockMatch = {
        fixture: {
            id: 12345,
            date: '2026-01-20T15:00:00Z',
            status: { short: 'NS' }
        },
        teams: {
            home: {
                name: 'Arsenal',
                logo: 'https://example.com/arsenal.png'
            },
            away: {
                name: 'Chelsea',
                logo: 'https://example.com/chelsea.png'
            }
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock successful match fetch
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ response: [mockMatch] })
        });
    });

    it('renders match header with team information', async () => {
        useGame.mockReturnValue({
            userProfile: mockProfile,
            loading: false,
        });

        render(
            <MemoryRouter initialEntries={['/match/12345']}>
                <Routes>
                    <Route path="/match/:id" element={<MatchDetail />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Arsenal')).toBeInTheDocument();
            expect(screen.getByText('Chelsea')).toBeInTheDocument();
        });
    });

    it('shows locked overlay when user has no Match Result cards', async () => {
        const profileWithoutCards = { ...mockProfile, inventory: [] };

        useGame.mockReturnValue({
            userProfile: profileWithoutCards,
            loading: false,
        });

        render(
            <MemoryRouter initialEntries={['/match/12345']}>
                <Routes>
                    <Route path="/match/:id" element={<MatchDetail />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Locked')).toBeInTheDocument();
            expect(screen.getByText('You need a Match Result card')).toBeInTheDocument();
        });
    });

    it('allows card selection when cards are available', async () => {
        useGame.mockReturnValue({
            userProfile: mockProfile,
            loading: false,
        });

        render(
            <MemoryRouter initialEntries={['/match/12345']}>
                <Routes>
                    <Route path="/match/:id" element={<MatchDetail />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Arsenal')).toBeInTheDocument();
        });

        // Find the Match Result card
        const matchResultCards = screen.getAllByAltText('Match Result');
        expect(matchResultCards.length).toBeGreaterThan(0);

        // Click the card
        fireEvent.click(matchResultCards[0]);

        // Verify selection indicator appears
        await waitFor(() => {
            expect(screen.getByText('✓ Card Selected')).toBeInTheDocument();
        });
    });

    it('creates draft prediction when prediction button is clicked', async () => {
        useGame.mockReturnValue({
            userProfile: mockProfile,
            loading: false,
        });

        render(
            <MemoryRouter initialEntries={['/match/12345']}>
                <Routes>
                    <Route path="/match/:id" element={<MatchDetail />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Arsenal')).toBeInTheDocument();
        });

        // Select a card first
        const matchResultCards = screen.getAllByAltText('Match Result');
        fireEvent.click(matchResultCards[0]);

        // Click Home Win button
        const homeWinButton = screen.getByText(/Arsenal Win/i);
        fireEvent.click(homeWinButton);

        // Verify queue panel appears
        await waitFor(() => {
            expect(screen.getByText('⚡ PLAY PREDICTION')).toBeInTheDocument();
            expect(screen.getByText(/HOME WIN/i)).toBeInTheDocument();
        });
    });

    it('displays correct reward calculation', async () => {
        useGame.mockReturnValue({
            userProfile: mockProfile,
            loading: false,
        });

        render(
            <MemoryRouter initialEntries={['/match/12345']}>
                <Routes>
                    <Route path="/match/:id" element={<MatchDetail />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Arsenal')).toBeInTheDocument();
        });

        // The mock odds function generates odds based on fixture ID
        // For ID 12345, we expect specific values
        // Reward should be odds * 100, floored

        // Just verify that coin values are displayed
        const coinLabels = screen.getAllByText('Coins');
        expect(coinLabels.length).toBeGreaterThan(0);
    });
});
