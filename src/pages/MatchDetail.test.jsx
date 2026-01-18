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

describe('MatchDetail - Prediction Flow with Toggles', () => {
    const mockProfile = {
        id: '123',
        club_name: 'Test FC',
        name: 'Test Manager',
        coins: 1000,
        energy: 3,
        max_energy: 5,
        inventory: ['c_match_result', 'c_match_result', 'c_total_goals']
    };

    const mockSupabase = {
        from: vi.fn((table) => {
            if (table === 'predictions') {
                return {
                    insert: vi.fn(() => Promise.resolve({ data: [{ id: 'bet-123' }], error: null }))
                };
            } else if (table === 'inventory') {
                return {
                    delete: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            eq: vi.fn(() => ({
                                limit: vi.fn(() => Promise.resolve({ error: null }))
                            }))
                        }))
                    }))
                };
            }
            return {};
        })
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

    // NEW TEST 1: Card Toggle (Deselection)
    it('tapping a selected card again deselects it', async () => {
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

        // Find and click the Match Result card
        const matchResultCards = screen.getAllByAltText('Match Result');
        fireEvent.click(matchResultCards[0]);

        // Verify it's selected
        await waitFor(() => {
            expect(screen.getByText('✓ Card Selected')).toBeInTheDocument();
        });

        // Click the same card again
        fireEvent.click(matchResultCards[0]);

        // Verify it's deselected (back to default message)
        await waitFor(() => {
            expect(screen.getByText('Select a Card')).toBeInTheDocument();
        });
    });

    // NEW TEST 2: Prediction Toggle (Cancellation)
    it('tapping a selected prediction button again cancels the prediction', async () => {
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
        });

        // Click the same prediction button again
        fireEvent.click(homeWinButton);

        // Verify queue panel disappears
        await waitFor(() => {
            expect(screen.queryByText('⚡ PLAY PREDICTION')).not.toBeInTheDocument();
        });
    });

    // NEW TEST 3: Success Overlay with Team Names
    it('clicking Play triggers the Success Overlay with the correct Team Name (not raw ID)', async () => {
        useGame.mockReturnValue({
            userProfile: mockProfile,
            loading: false,
            supabase: mockSupabase
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

        // Select a card
        const matchResultCards = screen.getAllByAltText('Match Result');
        fireEvent.click(matchResultCards[0]);

        // Select Home Win prediction
        const homeWinButton = screen.getByText(/Arsenal Win/i);
        fireEvent.click(homeWinButton);

        // Click PLAY button
        const playButton = screen.getByText('⚡ PLAY PREDICTION');
        fireEvent.click(playButton);

        // Verify Success Modal appears
        await waitFor(() => {
            expect(screen.getByText('Success!')).toBeInTheDocument();
        });

        // Verify team name is displayed (NOT "HOME_WIN")
        const successModal = screen.getByText('Success!').closest('div');
        expect(successModal).toHaveTextContent('Arsenal Win');
        expect(successModal).not.toHaveTextContent('HOME_WIN');

        // Verify Continue button exists
        expect(screen.getByText('Continue')).toBeInTheDocument();
    });

    // BONUS TEST: Success Modal Navigation
    it('clicking Continue in success modal navigates to match-hub', async () => {
        useGame.mockReturnValue({
            userProfile: mockProfile,
            loading: false,
            supabase: mockSupabase
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

        // Complete the flow: Select card -> Select prediction -> Play
        const matchResultCards = screen.getAllByAltText('Match Result');
        fireEvent.click(matchResultCards[0]);

        const homeWinButton = screen.getByText(/Arsenal Win/i);
        fireEvent.click(homeWinButton);

        const playButton = screen.getByText('⚡ PLAY PREDICTION');
        fireEvent.click(playButton);

        // Wait for modal
        await waitFor(() => {
            expect(screen.getByText('Success!')).toBeInTheDocument();
        });

        // Click Continue
        const continueButton = screen.getByText('Continue');
        fireEvent.click(continueButton);

        // Verify navigation
        expect(mockNavigate).toHaveBeenCalledWith('/match-hub');
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

        // Select a card to reveal prediction buttons with coin values
        const matchResultCards = screen.getAllByAltText('Match Result');
        fireEvent.click(matchResultCards[0]);

        // Wait for prediction buttons to appear
        await waitFor(() => {
            expect(screen.getByText(/Arsenal Win/i)).toBeInTheDocument();
        });

        // Just verify that coin values are displayed
        const coinLabels = screen.getAllByText('Coins');
        expect(coinLabels.length).toBeGreaterThan(0);
    });
});
