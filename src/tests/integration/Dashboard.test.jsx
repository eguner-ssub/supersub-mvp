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
const mockMarkPredictionsSeen = vi.fn().mockResolvedValue(undefined);
const mockUseGame = vi.fn();

vi.mock('../../shared/context/GameContext', () => ({
  useGame: () => mockUseGame(),
}));

vi.mock('../../components/WinModal', () => ({ default: () => <div>Win Modal</div> }));
vi.mock('../../shared/ui/CardBase', () => ({ default: ({ card }) => <div>{card?.name}</div> }));
vi.mock('../../shared/ui/WinCelebrationModal', () => ({
  default: ({ prediction, onDismiss }) => (
    <div data-testid="win-celebration-modal">
      <span>{prediction?.match_title}</span>
      <button onClick={onDismiss}>dismiss-modal</button>
    </div>
  ),
}));

const defaultProfile = {
  id: 'user-1',
  email: 'test@erentest.com',
  club_name: "Eren's FC",
  energy: 3,
  max_energy: 5,
  points: 1000,
  is_age_verified: false,
};

const defaultGame = {
  userProfile: defaultProfile,
  loading: false,
  updateInventory: vi.fn(),
  gainEnergy: vi.fn(),
  unseenSettlements: [],
  markPredictionsSeen: mockMarkPredictionsSeen,
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
    const closeBtn = screen.getByRole('button', { name: '' });
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

  // --------------------------------------------------------------------------
  // WIN CELEBRATION MODAL — settlement gate
  // --------------------------------------------------------------------------

  describe('WinCelebrationModal gate', () => {
    const wonPrediction = {
      id: 'pred-1',
      settled_status: 'WON',
      match_title: 'Arsenal vs Chelsea',
      potential_reward: 300,
    };

    const lostPrediction = {
      id: 'pred-2',
      settled_status: 'LOST',
      match_title: 'Man City vs Liverpool',
    };

    it('does not render WinCelebrationModal when unseenSettlements is empty', () => {
      render(<Dashboard />);
      expect(screen.queryByTestId('win-celebration-modal')).not.toBeInTheDocument();
    });

    it('does not render WinCelebrationModal when user is not age-verified', () => {
      // is_age_verified is false in defaultProfile
      mockUseGame.mockReturnValue({
        ...defaultGame,
        unseenSettlements: [wonPrediction],
      });
      render(<Dashboard />);
      expect(screen.queryByTestId('win-celebration-modal')).not.toBeInTheDocument();
    });

    it('renders WinCelebrationModal for a WON prediction when age-verified', () => {
      mockUseGame.mockReturnValue({
        ...defaultGame,
        userProfile: { ...defaultProfile, is_age_verified: true },
        unseenSettlements: [wonPrediction],
      });
      render(<Dashboard />);
      expect(screen.getByTestId('win-celebration-modal')).toBeInTheDocument();
      expect(screen.getByText('Arsenal vs Chelsea')).toBeInTheDocument();
    });

    it('does not render WinCelebrationModal for LOST predictions', () => {
      mockUseGame.mockReturnValue({
        ...defaultGame,
        userProfile: { ...defaultProfile, is_age_verified: true },
        unseenSettlements: [lostPrediction],
      });
      render(<Dashboard />);
      expect(screen.queryByTestId('win-celebration-modal')).not.toBeInTheDocument();
    });

    it('calls markPredictionsSeen for LOST predictions automatically', async () => {
      mockUseGame.mockReturnValue({
        ...defaultGame,
        unseenSettlements: [lostPrediction],
      });
      render(<Dashboard />);
      await waitFor(() =>
        expect(mockMarkPredictionsSeen).toHaveBeenCalledWith(['pred-2'])
      );
    });

    it('does not call markPredictionsSeen when unseenSettlements is empty', () => {
      render(<Dashboard />);
      // useEffect fires but lostIds will be [] → markPredictionsSeen should not be called
      expect(mockMarkPredictionsSeen).not.toHaveBeenCalled();
    });

    it('calls markPredictionsSeen with the WON prediction id when modal is dismissed', async () => {
      mockUseGame.mockReturnValue({
        ...defaultGame,
        userProfile: { ...defaultProfile, is_age_verified: true },
        unseenSettlements: [wonPrediction],
      });
      render(<Dashboard />);
      fireEvent.click(screen.getByText('dismiss-modal'));
      await waitFor(() =>
        expect(mockMarkPredictionsSeen).toHaveBeenCalledWith(['pred-1'])
      );
    });

    it('shows the first WON prediction when both WON and LOST are unseen', () => {
      mockUseGame.mockReturnValue({
        ...defaultGame,
        userProfile: { ...defaultProfile, is_age_verified: true },
        // LOST first in the array — WON should still be found and shown
        unseenSettlements: [lostPrediction, wonPrediction],
      });
      render(<Dashboard />);
      expect(screen.getByTestId('win-celebration-modal')).toBeInTheDocument();
      expect(screen.getByText('Arsenal vs Chelsea')).toBeInTheDocument();
    });
  });
});
