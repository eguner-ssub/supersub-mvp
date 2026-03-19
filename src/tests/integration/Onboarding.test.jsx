import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../shared/context/GameContext', () => ({ useGame: vi.fn() }));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// Prevent MobileLayout from requiring browser APIs not in jsdom
vi.mock('../../shared/ui/MobileLayout', () => ({
  default: ({ children }) => <div data-testid="mobile-layout">{children}</div>,
}));

import { useGame } from '../../shared/context/GameContext';
import Onboarding from '../../pages/Onboarding';

const renderOnboarding = () =>
  render(<MemoryRouter><Onboarding /></MemoryRouter>);

describe('Onboarding Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Loading state ────────────────────────────────────────────────────────

  describe('Loading state', () => {
    it('renders nothing (returns null) while loading is true', () => {
      useGame.mockReturnValue({
        userProfile: null,
        loading: true,
        createProfile: vi.fn(),
      });
      const { container } = renderOnboarding();
      // Onboarding returns null while loading
      expect(container.firstChild).toBeNull();
    });
  });

  // ─── Contract phase (no club_name) ───────────────────────────────────────

  describe('Contract phase — club_name is falsy', () => {
    let mockCreateProfile;

    beforeEach(() => {
      mockCreateProfile = vi.fn();
      useGame.mockReturnValue({
        userProfile: null,
        loading: false,
        createProfile: mockCreateProfile,
      });
    });

    it('renders the "Managerial Contract" heading', () => {
      renderOnboarding();
      expect(screen.getByText('Managerial Contract')).toBeInTheDocument();
    });

    it('renders the "SIGN CONTRACT" button', () => {
      renderOnboarding();
      expect(screen.getByText('SIGN CONTRACT')).toBeInTheDocument();
    });

    it('"SIGN CONTRACT" button is disabled when the name input is empty', () => {
      renderOnboarding();
      expect(screen.getByText('SIGN CONTRACT').closest('button')).toBeDisabled();
    });

    it('"SIGN CONTRACT" button is enabled after typing a manager name', () => {
      renderOnboarding();
      fireEvent.change(screen.getByPlaceholderText('ENTER SURNAME'), {
        target: { value: 'Ferguson' },
      });
      expect(screen.getByText('SIGN CONTRACT').closest('button')).not.toBeDisabled();
    });

    it('calls createProfile with the trimmed manager name when "SIGN CONTRACT" is clicked', async () => {
      renderOnboarding();
      fireEvent.change(screen.getByPlaceholderText('ENTER SURNAME'), {
        target: { value: '  Guardiola  ' },
      });
      fireEvent.click(screen.getByText('SIGN CONTRACT'));
      await waitFor(() =>
        expect(mockCreateProfile).toHaveBeenCalledWith('Guardiola')
      );
    });

    it('calls createProfile when Enter is pressed in the name input', async () => {
      renderOnboarding();
      const input = screen.getByPlaceholderText('ENTER SURNAME');
      fireEvent.change(input, { target: { value: 'Klopp' } });
      fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });
      await waitFor(() =>
        expect(mockCreateProfile).toHaveBeenCalledWith('Klopp')
      );
    });

    it('does not call createProfile when name is only whitespace', async () => {
      renderOnboarding();
      fireEvent.change(screen.getByPlaceholderText('ENTER SURNAME'), {
        target: { value: '   ' },
      });
      // Button should still be disabled for whitespace-only input
      expect(screen.getByText('SIGN CONTRACT').closest('button')).toBeDisabled();
      fireEvent.click(screen.getByText('SIGN CONTRACT'));
      expect(mockCreateProfile).not.toHaveBeenCalled();
    });
  });

  // ─── Welcome bonus phase (club_name exists) ───────────────────────────────

  describe('Welcome bonus phase — club_name is set', () => {
    beforeEach(() => {
      useGame.mockReturnValue({
        userProfile: { id: 'u1', club_name: 'FC Test', energy: 3, points: 500 },
        loading: false,
        createProfile: vi.fn(),
      });
    });

    it('renders the "Welcome Aboard" heading', () => {
      renderOnboarding();
      expect(screen.getByText('Welcome Aboard')).toBeInTheDocument();
    });

    it('shows the "+500" coins signing bonus', () => {
      renderOnboarding();
      expect(screen.getByText('+500')).toBeInTheDocument();
    });

    it('shows two "+3" signing bonuses (energy and scouts)', () => {
      renderOnboarding();
      // Both the energy bonus (+3) and scouts bonus (+3) display the same text.
      expect(screen.getAllByText('+3')).toHaveLength(2);
    });

    it('renders the "GET TO WORK" button', () => {
      renderOnboarding();
      expect(screen.getByText('GET TO WORK')).toBeInTheDocument();
    });

    it('navigates to /dashboard with state { firstLogin: true } when "GET TO WORK" is clicked', () => {
      renderOnboarding();
      fireEvent.click(screen.getByText('GET TO WORK'));
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', {
        state: { firstLogin: true },
      });
    });

    it('does not render the contract form on the bonus screen', () => {
      renderOnboarding();
      expect(screen.queryByText('Managerial Contract')).not.toBeInTheDocument();
    });
  });
});
