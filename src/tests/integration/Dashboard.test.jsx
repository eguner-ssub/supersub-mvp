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

  // --------------------------------------------------------------------------
  // HUD
  // --------------------------------------------------------------------------

  it('renders energy and points in the HUD', () => {
    render(<Dashboard />);
    expect(screen.getByText('3/5')).toBeInTheDocument();
    expect(screen.getByText('1000')).toBeInTheDocument();
  });

  it('renders club name from userProfile.club_name', () => {
    render(<Dashboard />);
    expect(screen.getByText("Eren's FC")).toBeInTheDocument();
  });

  it('falls back to "Manager" when club_name is absent', () => {
    mockUseGame.mockReturnValue({
      ...defaultGame,
      userProfile: { ...defaultProfile, club_name: null, name: null },
    });
    render(<Dashboard />);
    expect(screen.getByText('Manager')).toBeInTheDocument();
  });

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

  // --------------------------------------------------------------------------
  // SETTINGS SHEET
  // --------------------------------------------------------------------------

  it('tapping club name opens the settings sheet', () => {
    render(<Dashboard />);
    fireEvent.click(screen.getByRole('button', { name: "Eren's FC" }));
    // Text is "Manager Profile" — Tailwind uppercase is visual only, not in DOM
    expect(screen.getByText('Manager Profile')).toBeInTheDocument();
    // Email appears in both the profile card and account row
    expect(screen.getAllByText('test@erentest.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('tapping the backdrop closes the settings sheet', () => {
    render(<Dashboard />);
    fireEvent.click(screen.getByRole('button', { name: "Eren's FC" }));
    expect(screen.getByText('Manager Profile')).toBeInTheDocument();
    // Click the backdrop (the outermost fixed overlay div, not the sheet)
    const backdrop = document.querySelector('.fixed.inset-0');
    fireEvent.click(backdrop);
    expect(screen.queryByText('Manager Profile')).not.toBeInTheDocument();
  });

  it('Log Out button calls supabase.auth.signOut', async () => {
    render(<Dashboard />);
    fireEvent.click(screen.getByRole('button', { name: "Eren's FC" }));
    fireEvent.click(screen.getByText('Log Out'));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  });

  // --------------------------------------------------------------------------
  // LOADING STATE
  // --------------------------------------------------------------------------

  it('shows a loading spinner when loading is true', () => {
    mockUseGame.mockReturnValue({ ...defaultGame, loading: true });
    render(<Dashboard />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });
});
