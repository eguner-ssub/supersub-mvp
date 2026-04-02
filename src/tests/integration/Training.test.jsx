import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../shared/context/GameContext', () => ({ useGame: vi.fn() }));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// Inject a deterministic question set inline inside the factory so vi.mock hoisting
// doesn't cause a "cannot access before initialization" error. All questions have
// correctIndex=0. The first entry is Hard to satisfy the balancing engine.
vi.mock('../../data/gameData.json', () => ({
  default: {
    trainingQuestions: [
      { difficulty: 'Hard',   category: 'Tactics', text: 'Q1', options: ['Correct', 'Wrong A', 'Wrong B', 'Wrong C'], correctIndex: 0 },
      { difficulty: 'Easy',   category: 'History', text: 'Q2', options: ['Correct', 'Wrong A', 'Wrong B', 'Wrong C'], correctIndex: 0 },
      { difficulty: 'Easy',   category: 'History', text: 'Q3', options: ['Correct', 'Wrong A', 'Wrong B', 'Wrong C'], correctIndex: 0 },
      { difficulty: 'Easy',   category: 'History', text: 'Q4', options: ['Correct', 'Wrong A', 'Wrong B', 'Wrong C'], correctIndex: 0 },
      { difficulty: 'Medium', category: 'Rules',   text: 'Q5', options: ['Correct', 'Wrong A', 'Wrong B', 'Wrong C'], correctIndex: 0 },
    ],
  },
}));

// Replace AdOverlay with a stub that exposes onReward as a clickable button.
// The stub calls onClose after onReward resolves — mirroring the real SDK contract.
vi.mock('../../components/AdOverlay', () => ({
  default: ({ onReward, onClose }) => (
    <div data-testid="ad-overlay">
      <button data-testid="ad-reward-btn" onClick={async () => { await onReward?.(); onClose?.(); }}>ClaimReward</button>
      <button data-testid="ad-close-btn" onClick={onClose}>CloseAd</button>
    </div>
  ),
}));

// Suppress background images / CSS the layout component uses
vi.mock('../../shared/ui/MobileLayout', () => ({
  default: ({ children }) => <div data-testid="mobile-layout">{children}</div>,
}));

import { useGame } from '../../shared/context/GameContext';
import Training from '../../pages/Training';

// Default context — user has energy
const makeCtx = (overrides = {}) => ({
  userProfile: { id: 'u1', energy: 3, max_energy: 5 },
  loading: false,
  spendEnergy: vi.fn(),
  gainEnergy: vi.fn().mockResolvedValue(undefined),
  claimAdReward: vi.fn().mockResolvedValue(undefined),
  grantEnergyDrink: vi.fn().mockResolvedValue(undefined),
  updateInventory: vi.fn(),
  ...overrides,
});

const renderTraining = (ctx = makeCtx()) => {
  useGame.mockReturnValue(ctx);
  return render(<MemoryRouter><Training /></MemoryRouter>);
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Advance past the 1500ms answer-feedback delay to trigger question advance. */
const advanceQuestion = () => act(() => { vi.advanceTimersByTime(1500); });

/** Click START SESSION to move from briefing → quiz. */
const startSession = () => fireEvent.click(screen.getByText('START SESSION'));

/**
 * Play through `count` questions, clicking 'Correct' for the first
 * `correctCount` and 'Wrong A' for the rest.
 */
const playQuestions = async (count, correctCount) => {
  for (let i = 0; i < count; i++) {
    // Options re-render between questions so query fresh each time
    const optionText = i < correctCount ? 'Correct' : 'Wrong A';
    fireEvent.click(screen.getAllByText(optionText)[0]);
    await advanceQuestion();
  }
};

// ─────────────────────────────────────────────────────────────────────────────

describe('Training Page', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Briefing phase ───────────────────────────────────────────────────────

  describe('Briefing phase (initial render)', () => {
    it('renders the "Training Camp" heading', () => {
      renderTraining();
      expect(screen.getByText('Training Camp')).toBeInTheDocument();
    });

    it('shows "START SESSION" when user has energy > 0', () => {
      renderTraining();
      expect(screen.getByText('START SESSION')).toBeInTheDocument();
    });

    it('shows "Watch Ad (+3 Energy)" when user has energy === 0', () => {
      renderTraining(makeCtx({ userProfile: { id: 'u1', energy: 0, max_energy: 5 } }));
      expect(screen.getByText(/Watch Ad/i)).toBeInTheDocument();
    });

    it('does not render quiz option buttons initially', () => {
      renderTraining();
      expect(screen.queryByText('Correct')).not.toBeInTheDocument();
    });
  });

  // ─── Briefing → Quiz transition ───────────────────────────────────────────

  describe('Briefing → Quiz transition', () => {
    it('renders a question text after clicking START SESSION', () => {
      renderTraining();
      startSession();
      // Any of Q1–Q5 may appear first (shuffled), so check for one of the patterns
      const questionEl = screen.queryByText(/^Q[1-5]$/);
      expect(questionEl).toBeInTheDocument();
    });

    it('renders all 4 answer option buttons', () => {
      renderTraining();
      startSession();
      expect(screen.getAllByText('Correct').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Wrong A').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Wrong B').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Wrong C').length).toBeGreaterThan(0);
    });

    it('shows "Training Camp" heading is no longer visible in quiz phase', () => {
      renderTraining();
      startSession();
      expect(screen.queryByText('Training Camp')).not.toBeInTheDocument();
    });
  });

  // ─── Answer selection — correct ───────────────────────────────────────────

  describe('Correct answer selection', () => {
    it('disables all option buttons after an answer is selected', () => {
      renderTraining();
      startSession();
      fireEvent.click(screen.getAllByText('Correct')[0]);
      // All buttons should now be disabled (isAnswered=true)
      const optionButtons = screen.getAllByRole('button').filter(
        btn => ['Correct', 'Wrong A', 'Wrong B', 'Wrong C'].includes(btn.textContent?.trim())
      );
      optionButtons.forEach(btn => expect(btn).toBeDisabled());
    });

    it('advances to the next question after 1500ms', async () => {
      renderTraining();
      startSession();
      const firstQuestion = screen.getByText(/^Q[1-5]$/).textContent;
      fireEvent.click(screen.getAllByText('Correct')[0]);
      await advanceQuestion();
      // After advancing, buttons are re-enabled (isAnswered reset)
      const optionButtons = screen.getAllByRole('button').filter(
        btn => ['Correct', 'Wrong A', 'Wrong B', 'Wrong C'].includes(btn.textContent?.trim())
      );
      optionButtons.forEach(btn => expect(btn).not.toBeDisabled());
    });
  });

  // ─── Answer selection — wrong ─────────────────────────────────────────────

  describe('Wrong answer selection', () => {
    it('disables all option buttons after a wrong answer', () => {
      renderTraining();
      startSession();
      fireEvent.click(screen.getAllByText('Wrong A')[0]);
      const optionButtons = screen.getAllByRole('button').filter(
        btn => ['Correct', 'Wrong A', 'Wrong B', 'Wrong C'].includes(btn.textContent?.trim())
      );
      optionButtons.forEach(btn => expect(btn).toBeDisabled());
    });

    it('advances past a wrong answer after 1500ms', async () => {
      renderTraining();
      startSession();
      fireEvent.click(screen.getAllByText('Wrong A')[0]);
      await advanceQuestion();
      // Buttons re-enabled means we moved to the next question
      const optionButtons = screen.getAllByRole('button').filter(
        btn => ['Correct', 'Wrong A', 'Wrong B', 'Wrong C'].includes(btn.textContent?.trim())
      );
      optionButtons.forEach(btn => expect(btn).not.toBeDisabled());
    });
  });

  // ─── Quiz → Complete transition ───────────────────────────────────────────

  describe('Quiz → Complete transition', () => {
    it('shows "SESSION CLEAR!" after answering all 5 correctly (score = 5 ≥ 3)', async () => {
      renderTraining();
      startSession();
      await playQuestions(5, 5);
      expect(screen.getByText('SESSION CLEAR!')).toBeInTheDocument();
    });

    it('shows "SESSION FAILED" when fewer than 3 correct (score = 2 < 3)', async () => {
      renderTraining();
      startSession();
      await playQuestions(5, 2);
      expect(screen.getByText('SESSION FAILED')).toBeInTheDocument();
    });

    it('shows the score on the complete screen', async () => {
      renderTraining();
      startSession();
      await playQuestions(5, 3); // score = 3
      // Score is shown as "3" with "/5" in a child span — check "3" appears
      expect(screen.getByText('3/5')).toBeInTheDocument();
    });
  });

  // ─── handleFinish (CONTINUE button) ──────────────────────────────────────

  describe('handleFinish — CONTINUE button', () => {
    it('calls updateInventory(["c_match_result"]) when score >= 3', async () => {
      const ctx = makeCtx();
      renderTraining(ctx);
      startSession();
      await playQuestions(5, 3);
      fireEvent.click(screen.getByText('CONTINUE'));
      expect(ctx.updateInventory).toHaveBeenCalledWith(['c_match_result']);
    });

    it('does NOT call updateInventory when score < 3', async () => {
      const ctx = makeCtx();
      renderTraining(ctx);
      startSession();
      await playQuestions(5, 2);
      fireEvent.click(screen.getByText('CONTINUE'));
      expect(ctx.updateInventory).not.toHaveBeenCalled();
    });

    it('always calls spendEnergy(1) regardless of score', async () => {
      const ctx = makeCtx();
      renderTraining(ctx);
      startSession();
      await playQuestions(5, 0); // all wrong
      fireEvent.click(screen.getByText('CONTINUE'));
      expect(ctx.spendEnergy).toHaveBeenCalledWith(1);
    });

    it('navigates to /dashboard after CONTINUE is clicked', async () => {
      renderTraining();
      startSession();
      await playQuestions(5, 5);
      fireEvent.click(screen.getByText('CONTINUE'));
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  // ─── Watch ad reward flow ─────────────────────────────────────────────────

  describe('Watch ad reward flow', () => {
    it('clicking "Watch Ad" button shows the AdOverlay', () => {
      renderTraining(makeCtx({ userProfile: { id: 'u1', energy: 0, max_energy: 5 } }));
      fireEvent.click(screen.getByText(/Watch Ad/i));
      expect(screen.getByTestId('ad-overlay')).toBeInTheDocument();
    });

    it('calls claimAdReward() when the ad reward button is clicked', async () => {
      const ctx = makeCtx({ userProfile: { id: 'u1', energy: 0, max_energy: 5 } });
      renderTraining(ctx);
      fireEvent.click(screen.getByText(/Watch Ad/i));
      fireEvent.click(screen.getByTestId('ad-reward-btn'));
      await act(async () => {});
      expect(ctx.claimAdReward).toHaveBeenCalledTimes(1);
    });

    it('closes the AdOverlay after the reward is granted', async () => {
      renderTraining(makeCtx({ userProfile: { id: 'u1', energy: 0, max_energy: 5 } }));
      fireEvent.click(screen.getByText(/Watch Ad/i));
      expect(screen.getByTestId('ad-overlay')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('ad-reward-btn'));
      await act(async () => {});
      expect(screen.queryByTestId('ad-overlay')).not.toBeInTheDocument();
    });

    it('does not call claimAdReward when the ad is closed without claiming reward', async () => {
      const ctx = makeCtx({ userProfile: { id: 'u1', energy: 0, max_energy: 5 } });
      renderTraining(ctx);
      fireEvent.click(screen.getByText(/Watch Ad/i));
      fireEvent.click(screen.getByTestId('ad-close-btn'));
      await act(async () => {});
      expect(ctx.claimAdReward).not.toHaveBeenCalled();
    });
  });

  // ─── Guard: missing profile ───────────────────────────────────────────────

  describe('Guard: missing profile', () => {
    it('navigates to /dashboard when userProfile is null and loading is false', () => {
      // render() wraps in act() which flushes effects synchronously — no waitFor needed
      renderTraining(makeCtx({ userProfile: null, loading: false }));
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });
});
