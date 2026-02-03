import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MatchDetail from '../../features/match-day/MatchDetail';
import { useGame } from '../../shared/context/GameContext';

// Mock GameContext
vi.mock('../../shared/context/GameContext', () => ({
    useGame: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return { ...actual, useNavigate: () => mockNavigate };
});

global.fetch = vi.fn();

describe('E2E Betting Flow - Complete Integration Test', () => {
    const mockUserProfile = {
        id: 'user-123',
        name: 'Test Manager',
        coins: 500,
        energy: 3,
        max_energy: 100,
        inventory: ['c_match_result', 'c_match_result']
    };

    const mockMatchResponse = {
        response: [{
            fixture: { id: 12345, date: '2026-01-20T15:00:00Z', status: { short: 'NS' } },
            teams: {
                home: { id: 1, name: 'Arsenal', logo: '/arsenal.png' },
                away: { id: 2, name: 'Chelsea', logo: '/chelsea.png' }
            },
            goals: { home: 0, away: 0 }
        }]
    };

    const mockPlaceBet = vi.fn();
    const mockConsumeCard = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => mockMatchResponse
        });
    });

    it('E2E Test 1: Complete Bet Placement Flow', async () => {
        useGame.mockReturnValue({
            userProfile: mockUserProfile,
            loading: false,
            placeBet: mockPlaceBet.mockResolvedValue({ success: true }),
            consumeCard: mockConsumeCard,
            loadProfile: vi.fn(),
            supabase: { auth: { getSession: vi.fn(() => ({ data: { session: {} } })) } }
        });

        render(
            <MemoryRouter initialEntries={['/match/12345']}>
                <Routes>
                    <Route path="/match/:id" element={<MatchDetail />} />
                </Routes>
            </MemoryRouter>
        );

        // 1. Wait for load
        await waitFor(() => expect(screen.getByText('Arsenal')).toBeInTheDocument());

        // 2. Select Card (Updated Selector)
        const cardBtn = screen.getByTestId('card-c_match_result');
        expect(cardBtn).toBeInTheDocument();
        fireEvent.click(cardBtn);

        // 3. Select Home Win
        const homePanel = screen.getByTestId('panel-home');
        expect(homePanel).toBeInTheDocument();
        fireEvent.click(homePanel);

        // 4. Confirm
        const playBtn = screen.getByTestId('play-button');
        expect(playBtn).toBeInTheDocument();
        fireEvent.click(playBtn);

        // 5. Success
        await waitFor(() => {
            expect(mockPlaceBet).toHaveBeenCalled();
            expect(screen.getByText(/Locked In!/i)).toBeInTheDocument();
        });
    });
});
