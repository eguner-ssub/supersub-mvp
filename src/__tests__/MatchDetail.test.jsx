import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MatchDetail from '../pages/MatchDetail';

// --- MOCKS ---

const mockSupabase = {
    from: vi.fn(() => ({
        update: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null })
    }))
};

vi.mock('../context/GameContext', () => ({
    useGame: () => ({
        userProfile: {
            id: 'test-user',
            energy: 50,
            max_energy: 100,
            inventory: ['c_match_result', 'c_match_result', 'c_total_goals']
        },
        loading: false,
        supabase: mockSupabase
    })
}));

vi.mock('../utils/cardConfig', () => ({
    getCardConfig: () => ({ rarity: 'common', role: 'tactical' })
}));

vi.mock('../components/CardBase', () => ({
    default: ({ type, className }) => (
        <div data-testid={`card-base-${type}`} className={className}>
            {type}
        </div>
    )
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useParams: () => ({ id: '12345' }),
        useNavigate: () => mockNavigate
    };
});

global.fetch = vi.fn((url) => {
    if (url.includes('/api/matches')) {
        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                response: [{
                    fixture: {
                        id: 12345,
                        date: '2024-02-01T15:00:00Z',
                        status: { short: 'NS' }
                    },
                    teams: {
                        home: { name: 'Arsenal', logo: '/arsenal.png' },
                        away: { name: 'Tottenham', logo: '/tottenham.png' }
                    },
                    goals: { home: 0, away: 0 }
                }]
            })
        });
    }

    if (url.includes('/api/odds')) {
        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                odds: { home: 2.5, draw: 3.2, away: 2.8 }
            })
        });
    }

    return Promise.reject(new Error('Unknown URL'));
});

const renderMatchDetail = () => {
    return render(
        <BrowserRouter>
            <MatchDetail />
        </BrowserRouter>
    );
};

describe('MatchDetail - Industrial Battle Arena', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ============================================
    // PHASE 1: TRAPEZOID HUD
    // ============================================

    describe('Trapezoid HUD', () => {

        it('renders the trapezoid HUD with team names', async () => {
            renderMatchDetail();

            await waitFor(() => {
                expect(screen.getByTestId('trapezoid-hud')).toBeInTheDocument();
            });

            expect(screen.getByText(/Arsenal/i)).toBeInTheDocument();
            expect(screen.getByText(/Tottenham/i)).toBeInTheDocument();
        });

        it('displays kickoff time in the gold trapezoid center', async () => {
            renderMatchDetail();

            await waitFor(() => {
                const hud = screen.getByTestId('trapezoid-hud');
                // Should show time since status is 'NS' (not started)
                expect(hud.textContent).toMatch(/\d{2}:\d{2}/);
            });
        });

        it('shows team logos in the silver wings', async () => {
            renderMatchDetail();

            await waitFor(() => {
                const images = screen.getAllByRole('img');
                const teamLogos = images.filter(img =>
                    img.alt === 'Home' || img.alt === 'Away'
                );
                expect(teamLogos).toHaveLength(2);
            });
        });
    });

    // ============================================
    // PHASE 2: CARD SHELF (NO OVERLAP)
    // ============================================

    describe('Card Shelf', () => {

        it('renders the card shelf with all 4 card types', async () => {
            renderMatchDetail();

            await waitFor(() => {
                expect(screen.getByTestId('card-shelf')).toBeInTheDocument();
            });

            expect(screen.getByTestId('card-c_match_result')).toBeInTheDocument();
            expect(screen.getByTestId('card-c_total_goals')).toBeInTheDocument();
            expect(screen.getByTestId('card-c_player_score')).toBeInTheDocument();
            expect(screen.getByTestId('card-c_supersub')).toBeInTheDocument();
        });

        it('displays "Your Card Deck" label', async () => {
            renderMatchDetail();

            await waitFor(() => {
                expect(screen.getByText(/Your Card Deck/i)).toBeInTheDocument();
            });
        });

        it('shows quantity badges for owned cards', async () => {
            renderMatchDetail();

            await waitFor(() => {
                const matchResultCard = screen.getByTestId('card-c_match_result');
                // Should show x2 (2 in inventory)
                expect(matchResultCard.parentElement.textContent).toContain('x2');
            });
        });

        it('disables cards not in inventory', async () => {
            renderMatchDetail();

            await waitFor(() => {
                const playerScoreCard = screen.getByTestId('card-c_player_score');
                const superSubCard = screen.getByTestId('card-c_supersub');

                // These should be disabled (opacity-30, grayscale)
                expect(playerScoreCard.parentElement).toHaveClass('opacity-30');
                expect(superSubCard.parentElement).toHaveClass('opacity-30');
            });
        });

        it('cards are properly spaced without overlap', async () => {
            renderMatchDetail();

            await waitFor(() => {
                const shelf = screen.getByTestId('card-shelf');
                const cardContainer = shelf.querySelector('.flex');

                // Should have gap-4 class for proper spacing
                expect(cardContainer).toHaveClass('gap-4');
                expect(cardContainer).toHaveClass('justify-center');
            });
        });
    });

    // ============================================
    // PHASE 3: INTERACTION FLOW
    // ============================================

    describe('Selection Flow (idle → selecting)', () => {

        it('shows neon panels when Match Result card is clicked', async () => {
            renderMatchDetail();

            await waitFor(() => {
                expect(screen.getByTestId('card-c_match_result')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('card-c_match_result'));

            await waitFor(() => {
                expect(screen.getByTestId('panel-home')).toBeInTheDocument();
                expect(screen.getByTestId('panel-draw')).toBeInTheDocument();
                expect(screen.getByTestId('panel-away')).toBeInTheDocument();
            });
        });

        it('displays correct team names in neon panels', async () => {
            renderMatchDetail();

            await waitFor(() => {
                expect(screen.getByTestId('card-c_match_result')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('card-c_match_result'));

            await waitFor(() => {
                const homePanel = screen.getByTestId('panel-home');
                const awayPanel = screen.getByTestId('panel-away');

                expect(homePanel).toHaveTextContent('Arsenal');
                expect(awayPanel).toHaveTextContent('Tottenham');
            });
        });

        it('shows correct odds and rewards in panels', async () => {
            renderMatchDetail();

            await waitFor(() => {
                expect(screen.getByTestId('card-c_match_result')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('card-c_match_result'));

            await waitFor(() => {
                const homePanel = screen.getByTestId('panel-home');
                const drawPanel = screen.getByTestId('panel-draw');
                const awayPanel = screen.getByTestId('panel-away');

                // Home: 2.5 odds = 250 points
                expect(homePanel).toHaveTextContent('2.50');
                expect(homePanel).toHaveTextContent('250');

                // Draw: 3.2 odds = 320 points
                expect(drawPanel).toHaveTextContent('3.20');
                expect(drawPanel).toHaveTextContent('320');

                // Away: 2.8 odds = 280 points
                expect(awayPanel).toHaveTextContent('2.80');
                expect(awayPanel).toHaveTextContent('280');
            });
        });

        it('does not show panels when clicking disabled card', async () => {
            renderMatchDetail();

            await waitFor(() => {
                expect(screen.getByTestId('card-c_player_score')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('card-c_player_score'));

            // Panels should NOT appear
            await new Promise(resolve => setTimeout(resolve, 500));
            expect(screen.queryByTestId('panel-home')).not.toBeInTheDocument();
        });
    });

    describe('Staging Flow (selecting → staged)', () => {

        it('shows green staging bar when Home panel is clicked', async () => {
            renderMatchDetail();

            await waitFor(() => {
                expect(screen.getByTestId('card-c_match_result')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('card-c_match_result'));

            await waitFor(() => {
                expect(screen.getByTestId('panel-home')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('panel-home'));

            await waitFor(() => {
                expect(screen.getByTestId('staging-bar')).toBeInTheDocument();
            });
        });

        it('hides neon panels when staging bar appears', async () => {
            renderMatchDetail();

            await waitFor(() => {
                expect(screen.getByTestId('card-c_match_result')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('card-c_match_result'));

            await waitFor(() => {
                expect(screen.getByTestId('panel-draw')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('panel-draw'));

            await waitFor(() => {
                expect(screen.queryByTestId('panel-home')).not.toBeInTheDocument();
                expect(screen.queryByTestId('panel-draw')).not.toBeInTheDocument();
                expect(screen.queryByTestId('panel-away')).not.toBeInTheDocument();
            });
        });

        it('displays correct staged prediction details', async () => {
            renderMatchDetail();

            await waitFor(() => {
                expect(screen.getByTestId('card-c_match_result')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('card-c_match_result'));

            await waitFor(() => {
                expect(screen.getByTestId('panel-away')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('panel-away'));

            await waitFor(() => {
                const stagingBar = screen.getByTestId('staging-bar');
                expect(stagingBar).toHaveTextContent('Cards to be Played');
                expect(stagingBar).toHaveTextContent('AWAY');
                expect(stagingBar).toHaveTextContent('280 Points'); // 2.8 * 100
            });
        });

        it('shows PLAY button in staging bar', async () => {
            renderMatchDetail();

            await waitFor(() => {
                expect(screen.getByTestId('card-c_match_result')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('card-c_match_result'));

            await waitFor(() => {
                expect(screen.getByTestId('panel-home')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('panel-home'));

            await waitFor(() => {
                expect(screen.getByTestId('play-button')).toBeInTheDocument();
                expect(screen.getByTestId('play-button')).toHaveTextContent('PLAY');
            });
        });

        it('allows canceling staged prediction', async () => {
            renderMatchDetail();

            await waitFor(() => {
                expect(screen.getByTestId('card-c_match_result')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('card-c_match_result'));

            await waitFor(() => {
                expect(screen.getByTestId('panel-draw')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('panel-draw'));

            await waitFor(() => {
                expect(screen.getByTestId('staging-bar')).toBeInTheDocument();
            });

            const cancelButton = screen.getByRole('button', { name: /Cancel/i });
            fireEvent.click(cancelButton);

            await waitFor(() => {
                expect(screen.queryByTestId('staging-bar')).not.toBeInTheDocument();
            });
        });
    });

    describe('Resolution Flow (staged → resolved)', () => {

        it('calls supabase.update to consume card when PLAY is clicked', async () => {
            renderMatchDetail();

            await waitFor(() => {
                expect(screen.getByTestId('card-c_match_result')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('card-c_match_result'));

            await waitFor(() => {
                expect(screen.getByTestId('panel-home')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('panel-home'));

            await waitFor(() => {
                expect(screen.getByTestId('play-button')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('play-button'));

            await waitFor(() => {
                expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
            });
        });

        it('calls supabase.insert to create prediction when PLAY is clicked', async () => {
            renderMatchDetail();

            await waitFor(() => {
                expect(screen.getByTestId('card-c_match_result')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('card-c_match_result'));

            await waitFor(() => {
                expect(screen.getByTestId('panel-away')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('panel-away'));

            await waitFor(() => {
                expect(screen.getByTestId('play-button')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('play-button'));

            await waitFor(() => {
                expect(mockSupabase.from).toHaveBeenCalledWith('predictions');
            });
        });

        it('shows success modal after successful transaction', async () => {
            renderMatchDetail();

            await waitFor(() => {
                expect(screen.getByTestId('card-c_match_result')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('card-c_match_result'));

            await waitFor(() => {
                expect(screen.getByTestId('panel-draw')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('panel-draw'));

            await waitFor(() => {
                expect(screen.getByTestId('play-button')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('play-button'));

            await waitFor(() => {
                expect(screen.getByText(/Success!/i)).toBeInTheDocument();
                expect(screen.getByText(/Your prediction has been placed/i)).toBeInTheDocument();
            });
        });
    });

    // ============================================
    // EDGE CASES
    // ============================================

    describe('Edge Cases', () => {

        it('maintains correct z-index layering', async () => {
            renderMatchDetail();

            await waitFor(() => {
                expect(screen.getByTestId('trapezoid-hud')).toBeInTheDocument();
            });

            const hud = screen.getByTestId('trapezoid-hud');
            const shelf = screen.getByTestId('card-shelf');

            // HUD should be z-50
            expect(hud).toHaveClass('z-50');

            // Shelf should be z-50
            expect(shelf).toHaveClass('z-50');
        });
    });
});
