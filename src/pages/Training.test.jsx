import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Training from './Training';
import { useGame } from '../context/GameContext';

// Mock GameContext
vi.mock('../context/GameContext', () => ({
  useGame: vi.fn(),
}));

// Mock AdOverlay - simpler version
vi.mock('../components/AdOverlay', () => ({
  default: () => <div data-testid="ad-overlay">Mock Ad Overlay</div>,
}));

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('Training Page - Watch Ad Feature', () => {
  const mockSupabase = {
    rpc: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Test A: shows START SESSION button when user has energy', () => {
    useGame.mockReturnValue({
      userProfile: { id: '123', energy: 1, max_energy: 5 },
      loading: false,
      spendEnergy: vi.fn(),
      updateInventory: vi.fn(),
      supabase: mockSupabase,
    });

    render(
      <MemoryRouter>
        <Training />
      </MemoryRouter>
    );

    expect(screen.getByText('START SESSION')).toBeInTheDocument();
    expect(screen.queryByText(/Watch Ad/i)).not.toBeInTheDocument();
  });

  it('Test B: shows Watch Ad button when user has 0 energy', () => {
    useGame.mockReturnValue({
      userProfile: { id: '123', energy: 0, max_energy: 5 },
      loading: false,
      spendEnergy: vi.fn(),
      updateInventory: vi.fn(),
      supabase: mockSupabase,
    });

    render(
      <MemoryRouter>
        <Training />
      </MemoryRouter>
    );

    expect(screen.queryByText('START SESSION')).not.toBeInTheDocument();
    expect(screen.getByText(/Watch Ad \(\+3 Energy\)/i)).toBeInTheDocument();
  });

  it('Test C: clicking Watch Ad triggers the overlay to appear', () => {
    useGame.mockReturnValue({
      userProfile: { id: '123', energy: 0, max_energy: 5 },
      loading: false,
      spendEnergy: vi.fn(),
      updateInventory: vi.fn(),
      supabase: mockSupabase,
    });

    render(
      <MemoryRouter>
        <Training />
      </MemoryRouter>
    );

    const watchAdButton = screen.getByText(/Watch Ad \(\+3 Energy\)/i);
    fireEvent.click(watchAdButton);

    // Check if overlay appears
    expect(screen.getByTestId('ad-overlay')).toBeInTheDocument();
  });
});