import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdOverlay from './AdOverlay';

describe('AdOverlay Component', () => {
    let onRewardMock;
    let onCloseMock;

    beforeEach(() => {
        onRewardMock = vi.fn();
        onCloseMock = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders with initial countdown of 5 seconds', () => {
        render(<AdOverlay onReward={onRewardMock} onClose={onCloseMock} />);

        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText(/Reward in 5s.../i)).toBeInTheDocument();
        expect(screen.getByText('Sponsored Ad')).toBeInTheDocument();
    });

    it('does NOT call onReward immediately', () => {
        render(<AdOverlay onReward={onRewardMock} onClose={onCloseMock} />);

        expect(onRewardMock).not.toHaveBeenCalled();
    });

    it('displays non-closable message during countdown', () => {
        render(<AdOverlay onReward={onRewardMock} onClose={onCloseMock} />);

        expect(screen.getByText('Please wait for the ad to complete')).toBeInTheDocument();
    });

    it('shows initial progress bar at 0%', () => {
        const { container } = render(<AdOverlay onReward={onRewardMock} onClose={onCloseMock} />);

        const progressBar = container.querySelector('.bg-gradient-to-r');
        expect(progressBar).toHaveStyle({ width: '0%' });
    });

    it('shows Play icon during countdown', () => {
        const { container } = render(<AdOverlay onReward={onRewardMock} onClose={onCloseMock} />);

        const playIcon = container.querySelector('.lucide-play');
        expect(playIcon).toBeInTheDocument();
    });

    it('renders with purple gradient background', () => {
        const { container } = render(<AdOverlay onReward={onCloseMock} onClose={onCloseMock} />);

        const adCard = container.querySelector('.bg-gradient-to-br');
        expect(adCard).toHaveClass('from-purple-900', 'to-blue-900');
    });

    it('has full-screen overlay with high z-index', () => {
        const { container } = render(<AdOverlay onReward={onRewardMock} onClose={onCloseMock} />);

        const overlay = container.querySelector('.fixed.inset-0');
        expect(overlay).toHaveClass('z-[70]');
    });
});
