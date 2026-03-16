import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../../App';
import { useGame } from '../../shared/context/GameContext';

// Mock Context
vi.mock('../../shared/context/GameContext', () => ({
  GameProvider: ({ children }) => <div>{children}</div>,
  useGame: vi.fn(),
}));

// MOCK ONLY THE AUXILIARY PAGES
// We let the Feature Components (ManagerOffice, LockerRoom) render for real
vi.mock('../../pages/Login', () => ({ default: () => <div>Login Page</div> }));
vi.mock('../../pages/Onboarding', () => ({ default: () => <div>Onboarding Page</div> }));
vi.mock('../../pages/Account', () => ({ default: () => <div>Account Page</div> }));

describe('App Routing (The Bouncer)', () => {

  it('redirects unauthenticated users to /login', async () => {
    useGame.mockReturnValue({
      userProfile: null,
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/manager-office']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByText('Login Page')).toBeInTheDocument();
  });

  it('redirects users without a club name to /onboarding', async () => {
    useGame.mockReturnValue({
      userProfile: { id: '123', email: 'test@test.com', club_name: null },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/manager-office']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByText('Onboarding Page')).toBeInTheDocument();
  });

  it('allows full users to access /manager-office', async () => {
    useGame.mockReturnValue({
      userProfile: { id: '123', club_name: 'Test FC', energy: 5, max_energy: 5, points: 100 },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/manager-office']}>
        <AppRoutes />
      </MemoryRouter>
    );

    // Manager Office has the LAPTOP
    expect(await screen.findByTestId('hotspot-laptop')).toBeInTheDocument();
  });

  it('redirects root / to default view for full users', async () => {
    useGame.mockReturnValue({
      userProfile: { id: '123', club_name: 'Test FC', energy: 5, max_energy: 5, points: 100 },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    );

    // CHANGE: The app redirects to Locker Room, so we look for the WHITEBOARD
    expect(await screen.findByTestId('hotspot-whiteboard')).toBeInTheDocument();
  });

  it('allows full users to access /account', async () => {
    useGame.mockReturnValue({
      userProfile: { id: '123', club_name: 'Test FC' },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/account']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByText('Account Page')).toBeInTheDocument();
  });
});