import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MatchDetail from '../../features/match-day/MatchDetail';

// --- MOCKS ---
const mockPlaceBet = vi.fn();
const mockConsumeCard = vi.fn();

vi.mock('../../shared/context/GameContext', () => ({
    useGame: () => ({
        userProfile: {
            id: 'test-user',
            energy: 50,
            max_energy: 100,
            inventory: ['c_match_result', 'c_match_result', 'c_total_goals'],
            inventoryMap: { c_match_result: 2, c_total_goals: 1 }
        },
        loading: false,
        placeBet: mockPlaceBet,
        consumeCard: mockConsumeCard,
        loadProfile: vi.fn(),
        supabase: { auth: { getSession: vi.fn(() => ({ data: { session: {} } })) } }
    })
}));

vi.mock('../../shared/ui/CardBase', () => ({
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
        useNavigate: () => mockNavigate,
        useParams: () => ({ id: '123' })
    };
});

// Mock Global Fetch
global.fetch = vi.fn();

// Sportmonks odds mock response
const MOCK_SPORTMONKS_ODDS = {
    source: 'Sportmonks',
    fixture_id: 123,
    match_result: { home: 2.10, draw: 3.20, away: 2.80 },
    total_goals: { over_2_5: 1.85, under_2_5: 1.95 },
    first_goalscorer: [
        { player_id: 101, player_name: 'Home Star', odds: 1.90 },
        { player_id: 102, player_name: 'Away Star', odds: 2.20 },
    ]
};

describe('MatchDetail - Industrial Battle Arena', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        // Route fetch calls to the correct mock based on URL
        global.fetch.mockImplementation((url) => {
            if (String(url).includes('/api/odds/sportmonks')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => MOCK_SPORTMONKS_ODDS,
                });
            }
            // Default: match API
            return Promise.resolve({
                ok: true,
                json: async () => ({
                    response: [{
                        fixture: { id: 123, date: '2026-02-01T15:00:00', status: { short: 'NS' } },
                        teams: {
                            home: { id: 1, name: 'Arsenal', logo: '/arsenal.png' },
                            away: { id: 2, name: 'Tottenham', logo: '/tottenham.png' }
                        },
                        goals: { home: 0, away: 0 }
                    }]
                }),
            });
        });
    });

    const renderMatchDetail = () => {
        render(
            <BrowserRouter>
                <MatchDetail />
            </BrowserRouter>
        );
    };

    // ===========================================
    // SELECTION FLOW
    // ===========================================
    it('Selection Flow: shows correct odds and rewards in panels', async () => {
        renderMatchDetail();

        // 1. Wait for Card Shelf
        await waitFor(() => expect(screen.getByTestId('card-shelf')).toBeInTheDocument());

        // 2. Click "Match Result" Card
        const cardBtn = screen.getByTestId('card-c_match_result');
        fireEvent.click(cardBtn);

        // 3. Verify Selection Panels appear with correct format (+250 not 2.50)
        await waitFor(() => expect(screen.getByTestId('panel-home')).toBeInTheDocument());

        // Note: The UI format is "+210" (Int), not "2.10" (Float)
        // Simulation odds for home is 2.10 -> 210 points
        expect(screen.getByTestId('panel-home')).toHaveTextContent(/210/); // Checks for 210 in "+210"
    });

    // ===========================================
    // STAGING FLOW
    // ===========================================
    it('Staging Flow: displays correct staged prediction details', async () => {
        renderMatchDetail();

        await waitFor(() => expect(screen.getByTestId('card-shelf')).toBeInTheDocument());
        fireEvent.click(screen.getByTestId('card-c_match_result'));

        await waitFor(() => expect(screen.getByTestId('panel-away')).toBeInTheDocument());
        fireEvent.click(screen.getByTestId('panel-away')); // Away odds ~2.90 -> 290 pts

        // Wait for Staging Bar
        await waitFor(() => {
            const stagingBar = screen.getByTestId('staging-bar');
            // displayLabel is set to the team name, e.g. 'Tottenham' for away click
            expect(stagingBar).toHaveTextContent(/Tottenham/i);
            // Reward is rendered as "{reward} pts"
            expect(stagingBar).toHaveTextContent(/pts/i);
        });
    });

    // ===========================================
    // RESOLUTION FLOW
    // ===========================================
    it('Resolution Flow: calls placeBet and shows Success Modal', async () => {
        // Setup successful bet
        mockPlaceBet.mockResolvedValue({ success: true });

        renderMatchDetail();

        // Flow: Click Card -> Click Home -> Click Confirm
        await waitFor(() => expect(screen.getByTestId('card-c_match_result')).toBeInTheDocument());
        fireEvent.click(screen.getByTestId('card-c_match_result'));

        await waitFor(() => expect(screen.getByTestId('panel-home')).toBeInTheDocument());
        fireEvent.click(screen.getByTestId('panel-home'));

        await waitFor(() => expect(screen.getByTestId('play-button')).toBeInTheDocument());
        fireEvent.click(screen.getByTestId('play-button'));

        // ASSERT: Context Method called
        await waitFor(() => {
            expect(mockPlaceBet).toHaveBeenCalled();
            expect(mockConsumeCard).toHaveBeenCalledWith('c_match_result');
        });

        // ASSERT: Success Modal (Locked In!)
        expect(screen.getByText(/Locked In!/i)).toBeInTheDocument();
    });

});
