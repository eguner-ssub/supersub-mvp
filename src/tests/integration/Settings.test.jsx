import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Settings from '../../pages/Settings';

// ============================================================================
// MOCK DEPENDENCIES
// ============================================================================

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const mockSignOut = vi.fn().mockResolvedValue({});
const mockUseGame = vi.fn();

vi.mock('../../shared/context/GameContext', () => ({
  useGame: () => mockUseGame(),
}));

vi.mock('../../shared/ui/MobileLayout', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

const defaultProfile = {
  id: 'user-1',
  email: 'test@erentest.com',
  club_name: "Eren's FC",
};

// ============================================================================
// TESTS
// ============================================================================

describe('Settings', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGame.mockReturnValue({
      userProfile: defaultProfile,
      supabase: { auth: { signOut: mockSignOut } },
    });
  });

  // --------------------------------------------------------------------------
  // RENDERING
  // --------------------------------------------------------------------------

  it('renders the Settings heading', () => {
    render(<Settings />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('displays user email in the profile card', () => {
    render(<Settings />);
    // Email appears in both profile card and account section
    const emails = screen.getAllByText('test@erentest.com');
    expect(emails.length).toBeGreaterThanOrEqual(1);
  });

  it('displays "Manager Profile" label', () => {
    render(<Settings />);
    expect(screen.getByText('Manager Profile')).toBeInTheDocument();
  });

  it('shows Active status badge', () => {
    render(<Settings />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('falls back gracefully when email is missing', () => {
    mockUseGame.mockReturnValue({
      userProfile: { ...defaultProfile, email: null },
      supabase: { auth: { signOut: mockSignOut } },
    });
    render(<Settings />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // NAVIGATION
  // --------------------------------------------------------------------------

  it('back button navigates to /dashboard', () => {
    render(<Settings />);
    const backBtn = screen.getByRole('button', { name: '' }); // ArrowLeft icon
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  // --------------------------------------------------------------------------
  // LOGOUT
  // --------------------------------------------------------------------------

  it('Log Out button calls supabase.auth.signOut', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Log Out'));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  });

  it('handles signOut errors without crashing', async () => {
    mockSignOut.mockRejectedValueOnce(new Error('Network error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<Settings />);
    fireEvent.click(screen.getByText('Log Out'));

    await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
    consoleSpy.mockRestore();
  });
});
