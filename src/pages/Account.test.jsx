import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Account from './Account';
import { useGame } from '../context/GameContext';

// Mock mocks
vi.mock('../context/GameContext', () => ({
  useGame: vi.fn(),
}));

// Mock MobileLayout
vi.mock('../components/MobileLayout', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

describe('Account Page', () => {
  const mockSignOut = vi.fn();
  
  const mockProfile = {
    id: '123',
    name: 'Jose Mourinho',
    club_name: 'Special FC',
    email: 'jose@chelsea.com'
  };

  it('renders user details correctly', () => {
    useGame.mockReturnValue({
      userProfile: mockProfile,
      supabase: { auth: { signOut: mockSignOut } }
    });

    render(
      <MemoryRouter>
        <Account />
      </MemoryRouter>
    );

    expect(screen.getByText('Jose Mourinho')).toBeInTheDocument();
    expect(screen.getByText('Special FC')).toBeInTheDocument();
    expect(screen.getByText('jose@chelsea.com')).toBeInTheDocument();
  });

  it('calls sign out when button is clicked', () => {
    useGame.mockReturnValue({
      userProfile: mockProfile,
      supabase: { auth: { signOut: mockSignOut } }
    });

    render(
      <MemoryRouter>
        <Account />
      </MemoryRouter>
    );

    const logoutBtn = screen.getByText(/Sign Out/i);
    fireEvent.click(logoutBtn);

    expect(mockSignOut).toHaveBeenCalled();
  });
});