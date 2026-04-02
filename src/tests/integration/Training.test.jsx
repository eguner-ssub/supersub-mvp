import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../shared/context/GameContext', () => ({ useGame: vi.fn() }));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// 10-question deterministic deck: 2 Hard + 8 Easy.
// All correctIndex=0 so playQuestions() can click 'Correct' predictably.
vi.mock('../../data/gameData.json', () => ({
  default: {
    trainingQuestions: [
      { difficulty: 'Hard',   category: 'Tactics', text: 'Q1',  options: ['Correct', 'Wrong A', 'Wrong B', 'Wrong C'], correctIndex: 0 },
      { difficulty: 'Hard',   category: 'Tactics', text: 'Q2',  options: ['Correct', 'Wrong A', 'Wrong B', 'Wrong C'], correctIndex: 0 },
      { difficulty: 'Easy',   category: 'History', text: 'Q3',  options: ['Correct', 'Wrong A', 'Wrong B', 'Wrong C'], correctIndex: 0 },
      { difficulty: 'Easy',   category: 'History', text: 'Q4',  options: ['Correct', 'Wrong A', 'Wrong B', 'Wrong C'], correctIndex: 0 },
      { difficulty: 'Easy',   category: 'History', text: 'Q5',  options: ['Correct', 'Wrong A', 'Wrong B', 'Wrong C'], correctIndex: 0 },
      { difficulty: 'Easy',   category: 'History', text: 'Q6',  options: ['Correct', 'Wrong A', 'Wrong B', 'Wrong C'], correctIndex: 0 },
      { difficulty: 'Medium', category: 'Rules',   text: 'Q7',  options: ['Correct', 'Wrong A', 'Wrong B', 'Wrong C'], correctIndex: 0 },
      { difficulty: 'Medium', category: 'Rules',   text: 'Q8',  options: ['Correct', 'Wrong A', 'Wrong B', 'Wrong C'], correctIndex: 0 },
      { difficulty: 'Medium', category: 'Rules',   text: 'Q9',  options: ['Correct', 'Wrong A', 'Wrong B', 'Wrong C'], correctIndex: 0 },
      { difficulty: 'Medium', category: 'Rules',   text: 'Q10', options: ['Correct', 'Wrong A', 'Wrong B', 'Wrong C'], correctIndex: 0 },
    ],
  },
}));

vi.mock('../../components/AdOverlay', () => ({
  default: ({ onReward, onClose }) => (
    <div data-testid="ad-overlay">
      <button data-testid="ad-reward-btn" onClick={async () => { await onReward?.(); onClose?.(); }}>ClaimReward</button>
      <button data-testid="ad-close-btn" onClick={onClose}>CloseAd</button>
    </div>
  ),
}));

vi.mock('../../shared/ui/MobileLayout', () => ({
  default: ({ children }) => <div data-testid="mobile-layout">{children}</div>,
}));

import { useGame } from '../../shared/context/GameContext';
import Training from '../../pages/Training';

// Default reward shape returned by completeTrainingSession
const defaultReward = { commonCount: 1, hasSupersub: false, hasDrink: false };

const makeCtx = (overrides = {}) => ({
  userProfile:             { id: 'u1', energy: 3, max_energy: 5 },
  loading:                 false,
  claimAdReward:           vi.fn().mockResolvedValue(undefined),
  grantEnergyDrink:        vi.fn().mockResolvedValue(undefined),
  trainingSessionsToday:   0,
  startTrainingSession:    vi.fn().mockResolvedValue({ success: true }),
  completeTrainingSession: vi.fn().mockResolvedValue(defaultReward),
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
const startSession = () => fireEvent.click(screen.getByText('Start Session'));

/**
 * Play through `count` questions, clicking 'Correct' for the first
 * `correctCount` and 'Wrong A' for the rest.
 */
const playQuestions = async (count, correctCount) => {
  for (let i = 0; i < count; i++) {
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

    it('shows "Start Session" when user has energy > 0 and cap not reached', () => {
      renderTraining();
      expect(screen.getByText('Start Session')).toBeInTheDocument();
    });

    it('shows "Watch Ad" button when user has energy === 0', () => {
      renderTraining(makeCtx({ userProfile: { id: 'u1', energy: 0, max_energy: 5 } }));
      expect(screen.getByText(/Watch Ad/i)).toBeInTheDocument();
    });

    it('shows session cap message when trainingSessionsToday >= 2', () => {
      renderTraining(makeCtx({ trainingSessionsToday: 2 }));
      expect(screen.getByText(/maxed out training/i)).toBeInTheDocument();
      expect(screen.queryByText('Start Session')).not.toBeInTheDocument();
    });

    it('shows "0/2" sessions in the stats row when no sessions used', () => {
      renderTraining();
      expect(screen.getByText('0/2')).toBeInTheDocument();
    });

    it('shows "1/2" sessions after one session has been used', () => {
      renderTraining(makeCtx({ trainingSessionsToday: 1 }));
      expect(screen.getByText('1/2')).toBeInTheDocument();
    });

    it('does not render quiz option buttons initially', () => {
      renderTraining();
      expect(screen.queryByText('Correct')).not.toBeInTheDocument();
    });
  });

  // ─── Session start ─────────────────────────────────────────────────────────

  describe('Session start via startTrainingSession()', () => {
    it('calls startTrainingSession() when Start Session is clicked', async () => {
      const ctx = makeCtx();
      renderTraining(ctx);
      await act(async () => { startSession(); });
      expect(ctx.startTrainingSession).toHaveBeenCalledTimes(1);
    });

    it('does NOT directly call spendEnergy (that is handled inside startTrainingSession)', async () => {
      // Provide a spendEnergy mock in the context — if Training.jsx were calling it
      // directly it would show up here.
      const ctx = makeCtx({ spendEnergy: vi.fn() });
      renderTraining(ctx);
      await act(async () => { startSession(); });
      expect(ctx.spendEnergy).not.toHaveBeenCalled();
    });

    it('shows cap message when startTrainingSession returns reason=cap', async () => {
      const ctx = makeCtx({
        startTrainingSession: vi.fn().mockResolvedValue({ success: false, reason: 'cap' }),
      });
      renderTraining(ctx);
      await act(async () => { startSession(); });
      expect(screen.getByText(/maxed out training/i)).toBeInTheDocument();
    });

    it('transitions to quiz phase when startTrainingSession succeeds', async () => {
      renderTraining();
      await act(async () => { startSession(); });
      expect(screen.queryByText('Training Camp')).not.toBeInTheDocument();
      // A question should be visible
      expect(screen.queryByText(/^Q\d+$/)).toBeInTheDocument();
    });
  });

  // ─── Briefing → Quiz transition ───────────────────────────────────────────

  describe('Briefing → Quiz transition', () => {
    it('renders a question text after clicking Start Session', async () => {
      renderTraining();
      await act(async () => { startSession(); });
      expect(screen.queryByText(/^Q\d+$/)).toBeInTheDocument();
    });

    it('renders all 4 answer option buttons', async () => {
      renderTraining();
      await act(async () => { startSession(); });
      expect(screen.getAllByText('Correct').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Wrong A').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Wrong B').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Wrong C').length).toBeGreaterThan(0);
    });

    it('shows question counter as 1/10', async () => {
      renderTraining();
      await act(async () => { startSession(); });
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('/10')).toBeInTheDocument();
    });
  });

  // ─── Answer selection ─────────────────────────────────────────────────────

  describe('Correct answer selection', () => {
    it('disables all option buttons after an answer is selected', async () => {
      renderTraining();
      await act(async () => { startSession(); });
      fireEvent.click(screen.getAllByText('Correct')[0]);
      const optionButtons = screen.getAllByRole('button').filter(
        btn => ['Correct', 'Wrong A', 'Wrong B', 'Wrong C'].includes(btn.textContent?.trim())
      );
      optionButtons.forEach(btn => expect(btn).toBeDisabled());
    });

    it('advances to the next question after 1500ms', async () => {
      renderTraining();
      await act(async () => { startSession(); });
      fireEvent.click(screen.getAllByText('Correct')[0]);
      await advanceQuestion();
      const optionButtons = screen.getAllByRole('button').filter(
        btn => ['Correct', 'Wrong A', 'Wrong B', 'Wrong C'].includes(btn.textContent?.trim())
      );
      optionButtons.forEach(btn => expect(btn).not.toBeDisabled());
    });
  });

  describe('Wrong answer selection', () => {
    it('disables all option buttons after a wrong answer', async () => {
      renderTraining();
      await act(async () => { startSession(); });
      fireEvent.click(screen.getAllByText('Wrong A')[0]);
      const optionButtons = screen.getAllByRole('button').filter(
        btn => ['Correct', 'Wrong A', 'Wrong B', 'Wrong C'].includes(btn.textContent?.trim())
      );
      optionButtons.forEach(btn => expect(btn).toBeDisabled());
    });

    it('advances past a wrong answer after 1500ms', async () => {
      renderTraining();
      await act(async () => { startSession(); });
      fireEvent.click(screen.getAllByText('Wrong A')[0]);
      await advanceQuestion();
      const optionButtons = screen.getAllByRole('button').filter(
        btn => ['Correct', 'Wrong A', 'Wrong B', 'Wrong C'].includes(btn.textContent?.trim())
      );
      optionButtons.forEach(btn => expect(btn).not.toBeDisabled());
    });
  });

  // ─── Quiz → Complete transition ───────────────────────────────────────────

  describe('Quiz → Complete transition', () => {
    it('shows "Session Clear!" after answering all 10 questions', async () => {
      renderTraining();
      await act(async () => { startSession(); });
      await playQuestions(10, 10);
      expect(screen.getByText('Session Clear!')).toBeInTheDocument();
    });

    it('shows the score "/10" on the complete screen', async () => {
      renderTraining();
      await act(async () => { startSession(); });
      await playQuestions(10, 3);
      expect(screen.getByText('/10')).toBeInTheDocument();
    });

    it('calls completeTrainingSession with the correct score', async () => {
      const ctx = makeCtx();
      renderTraining(ctx);
      await act(async () => { startSession(); });
      await playQuestions(10, 7); // 7 correct
      expect(ctx.completeTrainingSession).toHaveBeenCalledWith(7);
    });

    it('shows reward badges returned by completeTrainingSession', async () => {
      const ctx = makeCtx({
        completeTrainingSession: vi.fn().mockResolvedValue({
          commonCount: 3, hasSupersub: false, hasDrink: false,
        }),
      });
      renderTraining(ctx);
      await act(async () => { startSession(); });
      await playQuestions(10, 7);
      // Flush the async handleNext (awaits completeTrainingSession promise)
      await act(async () => {});
      expect(screen.getByText('Match Result ×3')).toBeInTheDocument();
    });

    it('shows Supersub and drink badges on perfect score (completeTrainingSession mock)', async () => {
      const ctx = makeCtx({
        completeTrainingSession: vi.fn().mockResolvedValue({
          commonCount: 5, hasSupersub: true, hasDrink: true,
        }),
      });
      renderTraining(ctx);
      await act(async () => { startSession(); });
      await playQuestions(10, 10);
      // Flush the async handleNext (awaits completeTrainingSession promise)
      await act(async () => {});
      expect(screen.getByText('Match Result ×5')).toBeInTheDocument();
      expect(screen.getByText('Super Sub ×1')).toBeInTheDocument();
      expect(screen.getByText('Energy Drink ×1')).toBeInTheDocument();
    });
  });

  // ─── handleFinish (CONTINUE button) ──────────────────────────────────────

  describe('handleFinish — CONTINUE button', () => {
    it('navigates to /dashboard after CONTINUE is clicked', async () => {
      renderTraining();
      await act(async () => { startSession(); });
      await playQuestions(10, 5);
      fireEvent.click(screen.getByText('Continue'));
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    it('does NOT call updateInventory directly (handled by completeTrainingSession)', async () => {
      // Provide updateInventory in ctx — if Training.jsx called it directly it would show.
      const ctx = makeCtx({ updateInventory: vi.fn() });
      renderTraining(ctx);
      await act(async () => { startSession(); });
      await playQuestions(10, 5);
      await act(async () => {});
      fireEvent.click(screen.getByText('Continue'));
      expect(ctx.updateInventory).not.toHaveBeenCalled();
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

    it('does not call claimAdReward when the ad is closed without claiming', async () => {
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
      renderTraining(makeCtx({ userProfile: null, loading: false }));
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });
});
