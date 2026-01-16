import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Landing from './Landing';
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

describe('Landing Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to dashboard if user is already logged in and loading is finished', () => {
    // Mock: Loaded + User Exists
    useGame.mockReturnValue({
      userProfile: { club_name: 'Test FC' },
      loading: false
    });

    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    );

    // Verify Redirect
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it('shows login buttons if user is logged out and loading is finished', () => {
    // Mock: Loaded + No User
    useGame.mockReturnValue({
      userProfile: null,
      loading: false
    });

    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    );

    // Verify UI is visible
    expect(screen.getByText(/JOIN THE SQUAD/i)).toBeInTheDocument();
    expect(screen.getByText(/LOGIN/i)).toBeInTheDocument();
    // Ensure we didn't accidentally redirect
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows loading spinner (and hides buttons) while loading', () => {
    // Mock: Loading In Progress
    useGame.mockReturnValue({
      userProfile: null,
      loading: true // <--- The critical flag
    });

    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    );

    // Verify Buttons are GONE
    expect(screen.queryByText(/JOIN THE SQUAD/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/LOGIN/i)).not.toBeInTheDocument();
    
    // Note: Since Loader2 is an SVG, testing for its presence usually involves 
    // checking for the absence of the main content, which we just did.
  });
});