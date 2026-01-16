import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Training from './Training';
import { useGame } from '../context/GameContext';

// Mock GameContext
vi.mock('../context/GameContext', () => ({
  useGame: vi.fn(),
}));

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('Training Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows START SESSION button when user has energy', () => {
    useGame.mockReturnValue({
      userProfile: { id: '123', energy: 3, max_energy: 5 },
      loading: false,
      spendEnergy: vi.fn(),
      updateInventory: vi.fn(),
    });

    render(
      <MemoryRouter>
        <Training />
      </MemoryRouter>
    );

    expect(screen.getByText('START SESSION')).toBeInTheDocument();
  });

  it('shows Low Energy message when user has 0 energy', () => {
    useGame.mockReturnValue({
      userProfile: { id: '123', energy: 0, max_energy: 5 },
      loading: false,
      spendEnergy: vi.fn(),
      updateInventory: vi.fn(),
    });

    render(
      <MemoryRouter>
        <Training />
      </MemoryRouter>
    );

    expect(screen.queryByText('START SESSION')).not.toBeInTheDocument();
    expect(screen.getByText('Low Energy')).toBeInTheDocument();
    expect(screen.getByText('Wait for recharge or buy energy.')).toBeInTheDocument();
  });
});