import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GameHeader from '../../shared/ui/GameHeader';

// ============================================================================
// MOCK DEPENDENCIES
// ============================================================================

const mockSignOut = vi.fn().mockResolvedValue({});
const mockUseGame = vi.fn();

vi.mock('../../shared/context/GameContext', () => ({
  useGame: () => mockUseGame(),
}));

const defaultProfile = {
  email: 'test@erentest.com',
  club_name: "Eren's FC",
  energy: 3,
  max_energy: 5,
  points: 1000,
};

const defaultGame = {
  userProfile: defaultProfile,
  supabase: { auth: { signOut: mockSignOut } },
};

// GameHeader uses absolute positioning — needs a relative container
const renderInContainer = (ui) =>
  render(<div style={{ position: 'relative' }}>{ui}</div>);

// ============================================================================
// TESTS
// ============================================================================

describe('GameHeader', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGame.mockReturnValue(defaultGame);
  });

  // --------------------------------------------------------------------------
  // HUD
  // --------------------------------------------------------------------------

  it('renders energy as energy/max format', () => {
    renderInContainer(<GameHeader />);
    expect(screen.getByText('3/5')).toBeInTheDocument();
  });

  it('renders points', () => {
    renderInContainer(<GameHeader />);
    expect(screen.getByText('1000')).toBeInTheDocument();
  });

  it('renders club name from userProfile.club_name', () => {
    renderInContainer(<GameHeader />);
    expect(screen.getByText("Eren's FC")).toBeInTheDocument();
  });

  it('falls back to "Manager" when club_name and name are absent', () => {
    mockUseGame.mockReturnValue({
      ...defaultGame,
      userProfile: { ...defaultProfile, club_name: null, name: null },
    });
    renderInContainer(<GameHeader />);
    expect(screen.getByText('Manager')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // SETTINGS SHEET
  // --------------------------------------------------------------------------

  it('tapping club name opens the settings sheet', () => {
    renderInContainer(<GameHeader />);
    fireEvent.click(screen.getByRole('button', { name: "Eren's FC" }));
    expect(screen.getByText('Manager Profile')).toBeInTheDocument();
    expect(screen.getAllByText('test@erentest.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('tapping the backdrop closes the settings sheet', () => {
    renderInContainer(<GameHeader />);
    fireEvent.click(screen.getByRole('button', { name: "Eren's FC" }));
    expect(screen.getByText('Manager Profile')).toBeInTheDocument();
    fireEvent.click(document.querySelector('.fixed.inset-0'));
    expect(screen.queryByText('Manager Profile')).not.toBeInTheDocument();
  });

  it('Log Out button calls supabase.auth.signOut', async () => {
    renderInContainer(<GameHeader />);
    fireEvent.click(screen.getByRole('button', { name: "Eren's FC" }));
    fireEvent.click(screen.getByText('Log Out'));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  });

  it('falls back to "Unknown" for email when absent', () => {
    mockUseGame.mockReturnValue({
      ...defaultGame,
      userProfile: { ...defaultProfile, email: null },
    });
    renderInContainer(<GameHeader />);
    fireEvent.click(screen.getByRole('button', { name: "Eren's FC" }));
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});
