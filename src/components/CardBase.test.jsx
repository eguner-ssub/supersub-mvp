import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CardBase from '../components/CardBase';
import { CARD_TYPES, CARD_STATES } from '../utils/cardConfig';

describe('CardBase Component', () => {
    const defaultProps = {
        type: CARD_TYPES.MATCH_RESULT,
        state: CARD_STATES.DEFAULT,
        backgroundImage: '/test-image.jpg',
        label: 'Match Result',
        subLabel: 'Home Win',
        onClick: vi.fn()
    };

    // ============================================================================
    // Test 1: Rendering - Verify label and subLabel are visible
    // ============================================================================
    describe('Rendering', () => {
        it('should render label and subLabel correctly', () => {
            render(<CardBase {...defaultProps} />);

            expect(screen.getByText('Match Result')).toBeInTheDocument();
            expect(screen.getByText('Home Win')).toBeInTheDocument();
        });

        it('should render without subLabel when not provided', () => {
            const propsWithoutSubLabel = { ...defaultProps, subLabel: undefined };
            render(<CardBase {...propsWithoutSubLabel} />);

            expect(screen.getByText('Match Result')).toBeInTheDocument();
            expect(screen.queryByText('Home Win')).not.toBeInTheDocument();
        });

        it('should render background image with correct src', () => {
            const { container } = render(<CardBase {...defaultProps} />);
            const img = container.querySelector('img');

            expect(img).toBeInTheDocument();
            expect(img).toHaveAttribute('src', '/test-image.jpg');
        });
    });

    // ============================================================================
    // Test 2: Logic - Verify correct icon renders based on type prop
    // ============================================================================
    describe('Icon Logic', () => {
        it('should render Target icon for MATCH_RESULT type', () => {
            const { container } = render(
                <CardBase {...defaultProps} type={CARD_TYPES.MATCH_RESULT} />
            );

            // Lucide icons render as SVG elements
            const svg = container.querySelector('svg');
            expect(svg).toBeInTheDocument();
        });

        it('should render Trophy icon for TOTAL_GOALS type', () => {
            const { container } = render(
                <CardBase {...defaultProps} type={CARD_TYPES.TOTAL_GOALS} />
            );

            const svg = container.querySelector('svg');
            expect(svg).toBeInTheDocument();
        });

        it('should render User icon for PLAYER_SCORE type', () => {
            const { container } = render(
                <CardBase {...defaultProps} type={CARD_TYPES.PLAYER_SCORE} />
            );

            const svg = container.querySelector('svg');
            expect(svg).toBeInTheDocument();
        });

        it('should render Zap icon for SUPERSUB type', () => {
            const { container } = render(
                <CardBase {...defaultProps} type={CARD_TYPES.SUPERSUB} />
            );

            const svg = container.querySelector('svg');
            expect(svg).toBeInTheDocument();
        });
    });

    // ============================================================================
    // Test 3: State Visuals - Verify CSS classes change based on state prop
    // ============================================================================
    describe('State Visual Changes', () => {
        it('should apply DEFAULT state classes', () => {
            const { container } = render(
                <CardBase {...defaultProps} state={CARD_STATES.DEFAULT} />
            );

            const wrapper = container.firstChild;
            expect(wrapper).toHaveClass('border-gray-600');
            expect(wrapper).toHaveClass('ring-0');
        });

        it('should apply SELECTED state classes', () => {
            const { container } = render(
                <CardBase {...defaultProps} state={CARD_STATES.SELECTED} />
            );

            const wrapper = container.firstChild;
            expect(wrapper).toHaveClass('border-blue-500');
            expect(wrapper).toHaveClass('ring-2');
            expect(wrapper).toHaveClass('ring-blue-400/50');
        });

        it('should apply PENDING state classes', () => {
            const { container } = render(
                <CardBase {...defaultProps} state={CARD_STATES.PENDING} />
            );

            const wrapper = container.firstChild;
            expect(wrapper).toHaveClass('border-yellow-500');
            expect(wrapper).toHaveClass('ring-2');
            expect(wrapper).toHaveClass('ring-yellow-400/50');
        });

        it('should apply WON state classes with green border', () => {
            const { container } = render(
                <CardBase {...defaultProps} state={CARD_STATES.WON} />
            );

            const wrapper = container.firstChild;
            expect(wrapper).toHaveClass('border-green-500');
            expect(wrapper).toHaveClass('ring-4');
            expect(wrapper).toHaveClass('ring-green-400/60');
        });

        it('should apply LOST state classes with red border', () => {
            const { container } = render(
                <CardBase {...defaultProps} state={CARD_STATES.LOST} />
            );

            const wrapper = container.firstChild;
            expect(wrapper).toHaveClass('border-red-500');
            expect(wrapper).toHaveClass('ring-2');
            expect(wrapper).toHaveClass('ring-red-400/50');
        });

        it('should apply icon glow classes for WON state', () => {
            const { container } = render(
                <CardBase {...defaultProps} state={CARD_STATES.WON} />
            );

            const icon = container.querySelector('svg');
            expect(icon).toHaveClass('text-green-400');
        });

        it('should apply pulse animation for PENDING state', () => {
            const { container } = render(
                <CardBase {...defaultProps} state={CARD_STATES.PENDING} />
            );

            const icon = container.querySelector('svg');
            expect(icon).toHaveClass('animate-pulse');
        });
    });

    // ============================================================================
    // Test 4: Interaction - Verify onClick is called when clicked
    // ============================================================================
    describe('User Interaction', () => {
        it('should call onClick handler when card is clicked', async () => {
            const user = userEvent.setup();
            const handleClick = vi.fn();

            render(<CardBase {...defaultProps} onClick={handleClick} />);

            const card = screen.getByRole('button');
            await user.click(card);

            expect(handleClick).toHaveBeenCalledTimes(1);
        });

        it('should have proper accessibility attributes', () => {
            render(<CardBase {...defaultProps} />);

            const card = screen.getByRole('button');
            expect(card).toHaveAttribute('tabIndex', '0');
            expect(card).toHaveAttribute('aria-label', 'Match Result - Home Win card');
        });

        it('should handle multiple clicks', async () => {
            const user = userEvent.setup();
            const handleClick = vi.fn();

            render(<CardBase {...defaultProps} onClick={handleClick} />);

            const card = screen.getByRole('button');
            await user.click(card);
            await user.click(card);
            await user.click(card);

            expect(handleClick).toHaveBeenCalledTimes(3);
        });
    });

    // ============================================================================
    // Test 5: DOM Stability - Verify no conditional rendering
    // ============================================================================
    describe('DOM Stability', () => {
        it('should maintain consistent DOM structure across state changes', () => {
            const { container, rerender } = render(
                <CardBase {...defaultProps} state={CARD_STATES.DEFAULT} />
            );

            const initialStructure = container.innerHTML;
            const initialElementCount = container.querySelectorAll('*').length;

            // Change state to PENDING
            rerender(<CardBase {...defaultProps} state={CARD_STATES.PENDING} />);
            const pendingElementCount = container.querySelectorAll('*').length;

            // Change state to WON
            rerender(<CardBase {...defaultProps} state={CARD_STATES.WON} />);
            const wonElementCount = container.querySelectorAll('*').length;

            // Element count should remain the same (no conditional rendering)
            expect(pendingElementCount).toBe(initialElementCount);
            expect(wonElementCount).toBe(initialElementCount);
        });

        it('should always render all layers (image, overlay, content)', () => {
            const { container } = render(<CardBase {...defaultProps} />);

            // Layer 0: Background image
            expect(container.querySelector('img')).toBeInTheDocument();

            // Layer 1: Overlay (should always be present)
            const overlays = container.querySelectorAll('.absolute.inset-0');
            expect(overlays.length).toBeGreaterThan(0);

            // Layer 2: Content container
            expect(container.querySelector('.relative.z-10')).toBeInTheDocument();
        });
    });
});
