import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Landing from './Landing';
import { useGame } from '../context/GameContext';

vi.mock('../context/GameContext', () => ({
  useGame: vi.fn(),
}));

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('Landing Page', () => {
  it('redirects to dashboard if user is already logged in', () => {
    useGame.mockReturnValue({
      userProfile: { club_name: 'Test FC' }
    });

    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    );

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it('shows login buttons if user is logged out', () => {
    useGame.mockReturnValue({ userProfile: null });

    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    );

    expect(screen.getByText(/JOIN THE SQUAD/i)).toBeInTheDocument();
    expect(screen.getByText(/LOGIN/i)).toBeInTheDocument();
  });
});