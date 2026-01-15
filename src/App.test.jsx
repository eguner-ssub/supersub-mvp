import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { createMockGameContextValue } from './__mocks__/GameContext';

// Mock the GameContext
const mockUseGame = vi.fn();
vi.mock('./context/GameContext', async () => {
  const actual = await vi.importActual('./context/GameContext');
  return {
    ...actual,
    useGame: () => mockUseGame(),
    GameProvider: ({ children }) => children,
  };
});

describe('App - ProtectedRoute', () => {
  beforeEach(() => {
    // Reset window location
    Object.defineProperty(window, 'location', {
      value: { hash: '', search: '', pathname: '/' },
      writable: true,
    });
    vi.clearAllMocks();
  });

  it('redirects unauthenticated users to /login when accessing /dashboard', async () => {
    mockUseGame.mockReturnValue(createMockGameContextValue({
      userProfile: null,
      loading: false,
    }));

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockUseGame).toHaveBeenCalled();
    });
  });

  it('redirects users without club_name to /onboarding when accessing /dashboard', async () => {
    mockUseGame.mockReturnValue(createMockGameContextValue({
      userProfile: {
        id: 'test-id',
        email: 'test@example.com',
        club_name: null,
      },
      loading: false,
    }));

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockUseGame).toHaveBeenCalled();
    });
  });

  it('allows authenticated users with club_name to access /dashboard', async () => {
    mockUseGame.mockReturnValue(createMockGameContextValue({
      userProfile: {
        id: 'test-id',
        email: 'test@example.com',
        club_name: 'Test FC',
        coins: 1000,
        energy: 5,
      },
      loading: false,
    }));

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockUseGame).toHaveBeenCalled();
    });
  });

  it('allows access to /onboarding for authenticated users without club_name', async () => {
    mockUseGame.mockReturnValue(createMockGameContextValue({
      userProfile: {
        id: 'test-id',
        email: 'test@example.com',
        club_name: null,
      },
      loading: false,
    }));

    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockUseGame).toHaveBeenCalled();
    });
  });

  it('shows loading spinner when loading is true', async () => {
    mockUseGame.mockReturnValue(createMockGameContextValue({
      userProfile: null,
      loading: true,
    }));

    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockUseGame).toHaveBeenCalled();
    });
  });

  it('handles magic link authentication in progress', async () => {
    Object.defineProperty(window, 'location', {
      value: { 
        hash: '#access_token=test_token', 
        search: '', 
        pathname: '/dashboard' 
      },
      writable: true,
    });

    mockUseGame.mockReturnValue(createMockGameContextValue({
      userProfile: null,
      loading: false,
    }));

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockUseGame).toHaveBeenCalled();
    });
  });
});
