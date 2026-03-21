import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Dashboard from '../../pages/Dashboard';

// ============================================================================
// MOCK DEPENDENCIES
// ============================================================================

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null, pathname: '/dashboard' }),
}));

const mockSignOut = vi.fn().mockResolvedValue({});
const mockUseGame = vi.fn();

vi.mock('../../shared/context/GameContext', () => ({
  useGame: () => mockUseGame(),
}));

vi.mock('../../components/WinModal', () => ({ default: () => <div>Win Modal</div> }));
vi.mock('../../shared/ui/CardBase', () => ({ default: ({ card }) => <div>{card?.name}</div> }));

const defaultProfile = {
  id: 'user-1',
  email: 'test@erentest.com',
  club_name: 'Eren\'s FC',
  energy: 3,
  max_energy: 5,
  points: 1000,
};

const defaultGame = {
  userProfile: defaultProfile,
  loading: false,
  updateInventory: vi.fn(),
  gainEnergy: vi.fn(),
  supabase: { auth: { signOut: mockSignOut } },
};

// ============================================================================
// TESTS
// ============================================================================

describe('Dashboard', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGame.mockReturnValue(defaultGame);
  });

  // NOTE: HUD (energy, points, club name) and settings sheet tests
  // live in GameHeader.test.jsx — GameHeader is mounted by NavigationShell,
  // not directly by Dashboard.

  // --------------------------------------------------------------------------
  // HOTSPOT NAVIGATION
  // --------------------------------------------------------------------------

  it('whiteboard hotspot navigates to /inventory?tab=pending', () => {
    render(<Dashboard />);
    fireEvent.click(screen.getByTestId('hotspot-whiteboard'));
    expect(mockNavigate).toHaveBeenCalledWith('/inventory?tab=pending');
  });

  it('tablet hotspot navigates to /leaderboard', () => {
    render(<Dashboard />);
    fireEvent.click(screen.getByTestId('hotspot-tablet'));
    expect(mockNavigate).toHaveBeenCalledWith('/leaderboard');
  });

  it('inventory hotspot navigates to /inventory?tab=deck when no daily reward', () => {
    render(<Dashboard />);
    fireEvent.click(screen.getByTestId('hotspot-inventory'));
    expect(mockNavigate).toHaveBeenCalledWith('/inventory?tab=deck');
  });

  it('training hotspot navigates to /training', () => {
    render(<Dashboard />);
    fireEvent.click(screen.getByTestId('hotspot-training'));
    expect(mockNavigate).toHaveBeenCalledWith('/training');
  });

  // --------------------------------------------------------------------------
  // ENERGY MODAL
  // --------------------------------------------------------------------------

  it('drinks hotspot opens the energy modal', () => {
    render(<Dashboard />);
    fireEvent.click(screen.getByTestId('hotspot-drinks'));
    expect(screen.getByText('Hydration Station')).toBeInTheDocument();
  });

  it('energy modal close button dismisses it', () => {
    render(<Dashboard />);
    fireEvent.click(screen.getByTestId('hotspot-drinks'));
    expect(screen.getByText('Hydration Station')).toBeInTheDocument();
    // The X button is inside the modal
    const closeBtn = screen.getByRole('button', { name: '' }); // X icon button
    fireEvent.click(closeBtn);
    expect(screen.queryByText('Hydration Station')).not.toBeInTheDocument();
  });

  it('Drink button calls gainEnergy when energy is below max', async () => {
    render(<Dashboard />);
    fireEvent.click(screen.getByTestId('hotspot-drinks'));
    fireEvent.click(screen.getByText('Drink (Restore)'));
    await waitFor(() => expect(defaultGame.gainEnergy).toHaveBeenCalledWith(1));
  });

  it('Drink button is disabled when energy is at max', () => {
    mockUseGame.mockReturnValue({
      ...defaultGame,
      userProfile: { ...defaultProfile, energy: 5, max_energy: 5 },
    });
    render(<Dashboard />);
    fireEvent.click(screen.getByTestId('hotspot-drinks'));
    expect(screen.getByText('Max Energy Full')).toBeDisabled();
  });

  // NOTE: Settings sheet tests live in GameHeader.test.jsx

  // --------------------------------------------------------------------------
  // LOADING STATE
  // --------------------------------------------------------------------------

  it('shows a loading spinner when loading is true', () => {
    mockUseGame.mockReturnValue({ ...defaultGame, loading: true });
    render(<Dashboard />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });
});
