import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import { createMockGameContextValue } from '../__mocks__/GameContext';

// Mock the GameContext
const mockUseGame = vi.fn();
const mockUpdateInventory = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../context/GameContext', async () => {
  const actual = await vi.importActual('../context/GameContext');
  return {
    ...actual,
    useGame: () => mockUseGame(),
  };
});

// Mock react-router-dom hooks
const mockLocation = { pathname: '/dashboard', state: null };
const mockUseLocation = vi.fn(() => mockLocation);

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockUseLocation(),
  };
});

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.state = null;
    mockUseLocation.mockReturnValue({
      pathname: '/dashboard',
      state: null,
    });
    
    mockUseGame.mockReturnValue(createMockGameContextValue({
      userProfile: {
        id: 'test-id',
        email: 'test@example.com',
        club_name: 'Test FC',
        name: 'Test Manager',
        coins: 1000,
        energy: 5,
        max_energy: 5,
        inventory: ['c_match_result', 'c_total_goals'],
      },
      loading: false,
      updateInventory: mockUpdateInventory,
    }));
  });

  it('renders the user\'s club name', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test FC')).toBeInTheDocument();
    });
  });

  it('renders the user\'s coins', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('1000')).toBeInTheDocument();
    });
  });

  it('renders the user\'s energy', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('5/5')).toBeInTheDocument();
    });
  });

  it('shows bag opening overlay when location.state.firstLogin is true', async () => {
    // Update the mock location to include firstLogin
    mockLocation.state = { firstLogin: true };
    mockUseLocation.mockReturnValue({
      pathname: '/dashboard',
      state: { firstLogin: true },
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Kit Delivery')).toBeInTheDocument();
    });
  });

  it('opens bag and calls updateInventory when bag is clicked', async () => {
    mockLocation.state = { firstLogin: true };
    mockUseLocation.mockReturnValue({
      pathname: '/dashboard',
      state: { firstLogin: true },
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Kit Delivery')).toBeInTheDocument();
    });

    const bagButton = screen.getByRole('button', { name: /tap to equip/i });
    const user = userEvent.setup();
    await user.click(bagButton);

    await waitFor(() => {
      expect(mockUpdateInventory).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('hides overlay when "Enter Dressing Room" button is clicked', async () => {
    mockLocation.state = { firstLogin: true };
    mockUseLocation.mockReturnValue({
      pathname: '/dashboard',
      state: { firstLogin: true },
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Kit Delivery')).toBeInTheDocument();
    });

    // First open the bag
    const bagButton = screen.getByRole('button', { name: /tap to equip/i });
    const user = userEvent.setup();
    await user.click(bagButton);

    // Wait for rewards stage
    await waitFor(() => {
      expect(screen.getByText('Enter Dressing Room')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Click continue button
    const continueButton = screen.getByText('Enter Dressing Room');
    await user.click(continueButton);

    await waitFor(() => {
      expect(screen.queryByText('Kit Delivery')).not.toBeInTheDocument();
    });
  });

  it('shows loading state when loading is true', async () => {
    mockUseGame.mockReturnValue(createMockGameContextValue({
      userProfile: null,
      loading: true,
    }));

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Syncing Club Data/i)).toBeInTheDocument();
    });
  });
});
