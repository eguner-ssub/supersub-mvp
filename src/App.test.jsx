import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from './App'; // IMPORT THE NAMED EXPORT
import { useGame } from './context/GameContext';

// Mock the GameContext
vi.mock('./context/GameContext', () => ({
  GameProvider: ({ children }) => <div>{children}</div>,
  useGame: vi.fn(),
}));

// Mock the Page Components to simplify testing
vi.mock('./pages/Login', () => ({ default: () => <div>Login Page</div> }));
vi.mock('./pages/Onboarding', () => ({ default: () => <div>Onboarding Page</div> }));
vi.mock('./pages/Dashboard', () => ({ default: () => <div>Dashboard Page</div> }));

describe('App Routing (The Bouncer)', () => {
  it('redirects unauthenticated users to /login', () => {
    useGame.mockReturnValue({
      userProfile: null,
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('redirects users without a club name to /onboarding', () => {
    useGame.mockReturnValue({
      userProfile: { id: '123', email: 'test@test.com', club_name: null },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(screen.getByText('Onboarding Page')).toBeInTheDocument();
  });

  it('allows full users to access /dashboard', () => {
    useGame.mockReturnValue({
      userProfile: { id: '123', club_name: 'Test FC' },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });
});