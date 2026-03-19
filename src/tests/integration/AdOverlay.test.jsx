import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import AdOverlay from '../../components/AdOverlay';

describe('AdOverlay Component', () => {
  let onReward;
  let onClose;

  beforeEach(() => {
    onReward = vi.fn();
    onClose = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ─── Initial render ───────────────────────────────────────────────────────

  describe('Initial render (no timers advanced)', () => {
    it('shows the countdown starting at 5', () => {
      render(<AdOverlay onReward={onReward} onClose={onClose} />);
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('does NOT call onReward immediately', () => {
      render(<AdOverlay onReward={onReward} onClose={onClose} />);
      expect(onReward).not.toHaveBeenCalled();
    });

    it('shows the "Please wait for the ad to complete" message', () => {
      render(<AdOverlay onReward={onReward} onClose={onClose} />);
      expect(screen.getByText('Please wait for the ad to complete')).toBeInTheDocument();
    });

    it('shows the "Sponsored Ad" heading', () => {
      render(<AdOverlay onReward={onReward} onClose={onClose} />);
      expect(screen.getByText('Sponsored Ad')).toBeInTheDocument();
    });

    it('renders the progress bar at 0% width initially', () => {
      const { container } = render(<AdOverlay onReward={onReward} onClose={onClose} />);
      // Progress bar width: ((5 - countdown) / 5) * 100 → at countdown=5, width=0%
      const progressBar = container.querySelector('.bg-gradient-to-r.from-purple-500');
      expect(progressBar).toHaveStyle({ width: '0%' });
    });

    it('does not show the "Continue" close button before countdown completes', () => {
      render(<AdOverlay onReward={onReward} onClose={onClose} />);
      expect(screen.queryByText('Continue')).not.toBeInTheDocument();
    });

    it('does not show the "Reward Earned!" heading before completion', () => {
      render(<AdOverlay onReward={onReward} onClose={onClose} />);
      expect(screen.queryByText('Reward Earned!')).not.toBeInTheDocument();
    });
  });

  // ─── Countdown progression ────────────────────────────────────────────────

  describe('Countdown progression (one tick at a time)', () => {
    it('shows 4 after 1 second', () => {
      render(<AdOverlay onReward={onReward} onClose={onClose} />);
      act(() => { vi.advanceTimersByTime(1000); });
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('shows 2 after 3 seconds', () => {
      render(<AdOverlay onReward={onReward} onClose={onClose} />);
      act(() => { vi.advanceTimersByTime(1000); });
      act(() => { vi.advanceTimersByTime(1000); });
      act(() => { vi.advanceTimersByTime(1000); });
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('progress bar reaches 20% after 1 second', () => {
      const { container } = render(<AdOverlay onReward={onReward} onClose={onClose} />);
      act(() => { vi.advanceTimersByTime(1000); });
      const progressBar = container.querySelector('.bg-gradient-to-r.from-purple-500');
      expect(progressBar).toHaveStyle({ width: '20%' });
    });

    it('progress bar reaches 60% after 3 seconds', () => {
      const { container } = render(<AdOverlay onReward={onReward} onClose={onClose} />);
      act(() => { vi.advanceTimersByTime(1000); });
      act(() => { vi.advanceTimersByTime(1000); });
      act(() => { vi.advanceTimersByTime(1000); });
      const progressBar = container.querySelector('.bg-gradient-to-r.from-purple-500');
      expect(progressBar).toHaveStyle({ width: '60%' });
    });
  });

  // ─── Countdown completion ─────────────────────────────────────────────────

  describe('Countdown completion (all 5 seconds elapsed)', () => {
    const completeCountdown = () => {
      for (let i = 0; i < 5; i++) {
        act(() => { vi.advanceTimersByTime(1000); });
      }
    };

    it('calls onReward exactly once when countdown reaches 0', () => {
      render(<AdOverlay onReward={onReward} onClose={onClose} />);
      completeCountdown();
      expect(onReward).toHaveBeenCalledTimes(1);
    });

    it('shows "Reward Earned!" heading after countdown completes', () => {
      render(<AdOverlay onReward={onReward} onClose={onClose} />);
      completeCountdown();
      expect(screen.getByText('Reward Earned!')).toBeInTheDocument();
    });

    it('shows the "Continue" close button after countdown completes', () => {
      render(<AdOverlay onReward={onReward} onClose={onClose} />);
      completeCountdown();
      expect(screen.getByText('Continue')).toBeInTheDocument();
    });

    it('hides the "Sponsored Ad" heading after completion', () => {
      render(<AdOverlay onReward={onReward} onClose={onClose} />);
      completeCountdown();
      expect(screen.queryByText('Sponsored Ad')).not.toBeInTheDocument();
    });

    it('hides the "Please wait" message after completion', () => {
      render(<AdOverlay onReward={onReward} onClose={onClose} />);
      completeCountdown();
      expect(screen.queryByText('Please wait for the ad to complete')).not.toBeInTheDocument();
    });
  });

  // ─── Close button ─────────────────────────────────────────────────────────

  describe('Close button', () => {
    it('calls onClose when "Continue" is clicked after countdown is done', () => {
      render(<AdOverlay onReward={onReward} onClose={onClose} />);
      for (let i = 0; i < 5; i++) {
        act(() => { vi.advanceTimersByTime(1000); });
      }
      fireEvent.click(screen.getByText('Continue'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose if countdown has not finished (no Continue button yet)', () => {
      render(<AdOverlay onReward={onReward} onClose={onClose} />);
      // Only 2 seconds elapsed — countdown still running
      act(() => { vi.advanceTimersByTime(2000); });
      expect(screen.queryByText('Continue')).not.toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
