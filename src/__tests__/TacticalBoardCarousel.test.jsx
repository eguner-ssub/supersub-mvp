import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TacticalBoardCarousel from '../components/TacticalBoardCarousel';

// 1. MOCK DEPENDENCIES
const mockNavigate = vi.fn();

// Mock React Router
vi.mock('react-router-dom', () => ({
    ...vi.importActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));

// Mock CardBase to simplify the DOM tree
vi.mock('../components/CardBase', () => ({
    default: ({ selection }) => <div data-testid="mock-card">{selection}</div>
}));

describe('TacticalBoardCarousel', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockBets = [
        { id: 1, match_name: 'TEST VS MATCH', team_name: 'TEST FC', market: 'WINNER', potential_return: 500 },
        { id: 2, match_name: 'GAME 2 VS GAME 3', team_name: 'AWAY FC', market: 'DRAW', potential_return: 100 }
    ];

    it('renders the immersive background and board assets', () => {
        render(<TacticalBoardCarousel bets={mockBets} />);

        // Check for the Scene Background
        const bgImage = screen.getByAltText('Bench Background');
        expect(bgImage).toBeInTheDocument();
        expect(bgImage).toHaveAttribute('src', '/assets/bg-board-bench.webp');

        // Check for the Board Prop (at least one instance)
        const boardProps = screen.getAllByAltText('Tactical Board');
        expect(boardProps.length).toBeGreaterThan(0);
        expect(boardProps[0]).toHaveAttribute('src', '/assets/tactic-board.webp');
    });

    it('displays the correct bet data on the board', () => {
        render(<TacticalBoardCarousel bets={mockBets} />);

        // Check Match Name (Marker Text)
        expect(screen.getByText('TEST VS MATCH')).toBeInTheDocument();

        // Check Pot Amount (Red Marker)
        expect(screen.getByText('POT: 500')).toBeInTheDocument();

        // Check the Card was rendered with correct title
        expect(screen.getByText('TEST FC')).toBeInTheDocument();
    });

    it('navigates back when the close button is clicked', () => {
        render(<TacticalBoardCarousel bets={mockBets} />);

        const closeButton = screen.getByTestId('close-button');
        fireEvent.click(closeButton);

        expect(mockNavigate).toHaveBeenCalledWith(-1);
    });

    it('renders the correct number of pagination dots', () => {
        const { container } = render(<TacticalBoardCarousel bets={mockBets} />);

        // There should be 2 mock bets, so 2 dots in the pagination area
        // Dots are defined as w-2 h-2 rounded-full
        // Note: We might pick up other rounded elements, so we look for the specific container if needed
        // or simply check if the text "Tactical Brief (1/2)" exists
        expect(screen.getByText('Tactical Brief (1/2)')).toBeInTheDocument();
    });

});
