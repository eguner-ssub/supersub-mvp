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

// ─── Sportmonks v3 mock match payload ────────────────────────────────────────
// normalizeMatch() receives this as already-nested (has `fixture` key),
// so it passes through unchanged and all sub-fields are preserved.
//
// lineups:
//   type_id 11 → starter (starting eleven)
//   type_id 12 → bench / substitute
//
// events:
//   type_id 14 → goal   (player = scorer, assist = assister)
//   type_id 16 → sub    (player = off,    assist = on)
//   minute      → elapsed minute (top-level, mirrors time.elapsed)
const MOCK_SM_MATCH = {
    // normalizeMatch pass-through (already has `fixture`)
    fixture: { id: 123, date: '2026-02-01T15:00:00', status: { short: 'NS' } },
    teams: {
        home: { id: 1, name: 'Arsenal',   logo: '/arsenal.png'   },
        away: { id: 2, name: 'Tottenham', logo: '/tottenham.png' },
    },
    goals: { home: 1, away: 0 },

    // ── Lineups (single flat array across both teams) ────────────────────────
    lineups: [
        // Starters — type_id: 11 (Home)
        { type_id: 11, jersey_number: 1,  team_id: 1, player: { id: 201, name: 'Raya',    display_name: 'Raya'    } },
        { type_id: 11, jersey_number: 6,  team_id: 1, player: { id: 202, name: 'Gabriel', display_name: 'Gabriel' } },
        // Bench — type_id: 12 (Home)
        { type_id: 12, jersey_number: 13, team_id: 1, player: { id: 203, name: 'Jorginho', display_name: 'Jorginho' } },
        { type_id: 12, jersey_number: 23, team_id: 1, player: { id: 204, name: 'Nketiah',  display_name: 'Nketiah'  } },
        // Starters — type_id: 11 (Away)
        { type_id: 11, jersey_number: 1,  team_id: 2, player: { id: 301, name: 'Forster',  display_name: 'Forster'  } },
        { type_id: 11, jersey_number: 5,  team_id: 2, player: { id: 302, name: 'Romero',   display_name: 'Romero'   } },
        // Bench — type_id: 12 (Away)
        { type_id: 12, jersey_number: 18, team_id: 2, player: { id: 303, name: 'Bissouma', display_name: 'Bissouma' } },
    ],

    // ── Events ───────────────────────────────────────────────────────────────
    events: [
        {
            type_id: 14,
            minute: 32,
            player: { id: 202, name: 'Gabriel' },
            assist: { id: 206, name: 'Ødegaard' },
            detail: 'Header',
        },
        {
            type_id: 16,
            minute: 67,
            player: { id: 201, name: 'Raya' },
            assist: { id: 204, name: 'Nketiah' },
            detail: 'Substitution',
        },
    ],
};

describe('MatchDetail - Industrial Battle Arena', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch.mockImplementation((url) => {
            if (String(url).includes('/api/odds')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => MOCK_SPORTMONKS_ODDS,
                });
            }
            // Default: match API — return Sportmonks-shaped payload
            return Promise.resolve({
                ok: true,
                json: async () => ({ response: [MOCK_SM_MATCH] }),
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

        // 3. Verify Selection Panels appear with correct format (+210 not 2.10)
        await waitFor(() => expect(screen.getByTestId('panel-home')).toBeInTheDocument());
        expect(screen.getByTestId('panel-home')).toHaveTextContent(/210/);
    });

    // ===========================================
    // STAGING FLOW
    // ===========================================
    it('Staging Flow: displays correct staged prediction details', async () => {
        renderMatchDetail();

        await waitFor(() => expect(screen.getByTestId('card-shelf')).toBeInTheDocument());
        fireEvent.click(screen.getByTestId('card-c_match_result'));

        await waitFor(() => expect(screen.getByTestId('panel-away')).toBeInTheDocument());
        fireEvent.click(screen.getByTestId('panel-away'));

        await waitFor(() => {
            const stagingBar = screen.getByTestId('staging-bar');
            expect(stagingBar).toHaveTextContent(/Tottenham/i);
            expect(stagingBar).toHaveTextContent(/pts/i);
        });
    });

    // ===========================================
    // RESOLUTION FLOW
    // ===========================================
    it('Resolution Flow: calls placeBet and shows Success Modal', async () => {
        mockPlaceBet.mockResolvedValue({ success: true });

        renderMatchDetail();

        await waitFor(() => expect(screen.getByTestId('card-c_match_result')).toBeInTheDocument());
        fireEvent.click(screen.getByTestId('card-c_match_result'));

        await waitFor(() => expect(screen.getByTestId('panel-home')).toBeInTheDocument());
        fireEvent.click(screen.getByTestId('panel-home'));

        await waitFor(() => expect(screen.getByTestId('play-button')).toBeInTheDocument());
        fireEvent.click(screen.getByTestId('play-button'));

        await waitFor(() => {
            expect(mockPlaceBet).toHaveBeenCalled();
            expect(mockConsumeCard).toHaveBeenCalledWith('c_match_result');
        });

        expect(screen.getByText(/Locked In!/i)).toBeInTheDocument();
    });

    // ===========================================
    // LINEUPS — Sportmonks v3 schema
    // ===========================================
    it('Lineups: renders team names from Sportmonks participants', async () => {
        renderMatchDetail();
        await waitFor(() => expect(screen.getByText('Arsenal')).toBeInTheDocument());
        expect(screen.getByText('Tottenham')).toBeInTheDocument();
    });

    // ===========================================
    // SUBS TAB — type_id filtering
    // ===========================================
    it('Subs Tab: renders bench players filtered by type_id === 12', async () => {
        renderMatchDetail();

        // Wait for match to load
        await waitFor(() => expect(screen.getByText('Arsenal')).toBeInTheDocument());

        // Navigate to SUBS tab
        const subsTab = screen.getByText('SUBS');
        fireEvent.click(subsTab);

        // Bench players (type_id 12): Jorginho, Nketiah, Bissouma
        await waitFor(() => {
            expect(screen.getByText('Jorginho')).toBeInTheDocument();
            expect(screen.getByText('Nketiah')).toBeInTheDocument();
            expect(screen.getByText('Bissouma')).toBeInTheDocument();
        });

        // Starters (type_id 11) should NOT appear in bench list
        // (Gabriel and Romero are starters)
        expect(screen.queryByTestId('sub-player-202')).not.toBeInTheDocument();
        expect(screen.queryByTestId('sub-player-302')).not.toBeInTheDocument();
    });

    // ===========================================
    // EVENTS TAB — Sportmonks v3 schema
    // ===========================================
    it('Events Tab: renders goal scorer and assist from Sportmonks event shape', async () => {
        renderMatchDetail();

        await waitFor(() => expect(screen.getByText('Arsenal')).toBeInTheDocument());

        const eventsTab = screen.getByText('EVENTS');
        fireEvent.click(eventsTab);

        await waitFor(() => {
            // Goal event — player.name = 'Gabriel'
            expect(screen.getByText('Gabriel')).toBeInTheDocument();
            // Substitution player off — player.name = 'Raya'
            expect(screen.getByText('Raya')).toBeInTheDocument();
        });
    });

});
