import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Training from './Training';
import { useGame } from '../context/GameContext';

// Mock Dependencies
vi.mock('../context/GameContext', () => ({
  useGame: vi.fn(),
}));

// Mock Data strictly aligned with Training.jsx logic
vi.mock('../data/gameData.json', () => ({
  default: {
    trainingQuestions: [
      { qId: 101, difficulty: "Hard", category: "Test", text: "Hard Q", options: ["A", "B"], correctIndex: 0 },
      { qId: 102, difficulty: "Medium", category: "Test", text: "Medium Q1", options: ["A", "B"], correctIndex: 0 },
      { qId: 103, difficulty: "Medium", category: "Test", text: "Medium Q2", options: ["A", "B"], correctIndex: 0 },
      { qId: 104, difficulty: "Medium", category: "Test", text: "Medium Q3", options: ["A", "B"], correctIndex: 0 },
      { qId: 105, difficulty: "Medium", category: "Test", text: "Medium Q4", options: ["A", "B"], correctIndex: 0 },
    ]
  }
}));

// Mock MobileLayout to avoid layout noise
vi.mock('../components/MobileLayout', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

describe('Training Session', () => {
  beforeEach(() => {
    vi.useFakeTimers(); // CONTROL TIME
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('completes the full session loop and awards rewards', async () => {
    const mockUpdateInventory = vi.fn();
    const mockSpendEnergy = vi.fn();

    useGame.mockReturnValue({
      userProfile: { energy: 3, id: '123' },
      loading: false,
      updateInventory: mockUpdateInventory,
      spendEnergy: mockSpendEnergy
    });

    render(
      <MemoryRouter>
        <Training />
      </MemoryRouter>
    );

    // 1. Start Session
    fireEvent.click(screen.getByText(/START SESSION/i));

    // 2. Answer 5 Questions
    // In our mock, index 0 is always correct ("A")
    for (let i = 0; i < 5; i++) {
        // Find the "A" button. 
        // Note: screen.getAllByRole('button') might pick up the X close button too.
        // We look for the button containing "A".
        const optionA = screen.getByText("A").closest('button');
        fireEvent.click(optionA);

        // Fast-forward the 1.5s delay inside handleOptionClick
        act(() => {
            vi.advanceTimersByTime(1600);
        });
    }

    // 3. Check for Completion
    expect(screen.getByText(/SESSION CLEAR/i)).toBeInTheDocument();

    // 4. Click Continue
    const continueBtn = screen.getByText(/CONTINUE/i);
    fireEvent.click(continueBtn);

    // 5. Verify Logic
    expect(mockUpdateInventory).toHaveBeenCalledWith(['c_match_result']);
    expect(mockSpendEnergy).toHaveBeenCalledWith(1);
  });

  it('shows failed screen if score is low', async () => {
    useGame.mockReturnValue({
      userProfile: { energy: 3, id: '123' },
      loading: false,
      updateInventory: vi.fn(),
      spendEnergy: vi.fn()
    });

    render(
      <MemoryRouter>
        <Training />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText(/START SESSION/i));

    // Answer incorrectly (Option B, index 1)
    for (let i = 0; i < 5; i++) {
        const optionB = screen.getByText("B").closest('button');
        fireEvent.click(optionB);
        act(() => { vi.advanceTimersByTime(1600); });
    }

    expect(screen.getByText(/SESSION FAILED/i)).toBeInTheDocument();
  });
});