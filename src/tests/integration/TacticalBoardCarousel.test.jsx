import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TacticalBoardCarousel from '../../features/match-day/TacticalBoardCarousel';

// 1. MOCK DEPENDENCIES
const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
    ...vi.importActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));

// FIX: Mock CardBase to render LABEL (which contains Team Name)
vi.mock('../../shared/ui/CardBase', () => ({
    default: ({ label, selection }) => <div data-testid="mock-card">{label || selection}</div>
}));

describe('TacticalBoardCarousel', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockBets = [
        { id: 1, match_name: 'TEST VS MATCH', team_name: 'TEST FC', market: 'c_match_result', potential_return: 500 },
        { id: 2, match_name: 'GAME 2 VS GAME 3', team_name: 'AWAY FC', market: 'c_match_result', potential_return: 100 }
    ];

    it('renders the immersive background and board assets', () => {
        render(<TacticalBoardCarousel bets={mockBets} />);

        const bgImage = screen.getByAltText('Desk');
        expect(bgImage).toBeInTheDocument();
        expect(bgImage).toHaveAttribute('src', '/assets/bg-desk-dark.webp');

        const boardProps = screen.getAllByAltText('Tactical Board');
        expect(boardProps.length).toBeGreaterThan(0);
    });

    it('displays the correct bet data on the board', () => {
        render(<TacticalBoardCarousel bets={mockBets} />);

        // Check Match Name
        expect(screen.getByText('TEST VS MATCH')).toBeInTheDocument();
        // Check Pot Amount
        expect(screen.getByText(/500/)).toBeInTheDocument();
        // Check the Card Label (TEST FC)
        expect(screen.getByText('TEST FC')).toBeInTheDocument();
    });

    it('navigates back when the close button is clicked', () => {
        render(<TacticalBoardCarousel bets={mockBets} />);
        const closeButton = screen.getByTestId('close-button');
        fireEvent.click(closeButton);
        expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
});
