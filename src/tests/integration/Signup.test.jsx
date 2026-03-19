import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Signup from '../../pages/Signup';

// Auto-picks up src/__mocks__/supabaseClient.js
vi.mock('../../supabaseClient');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// Import the mocked supabase AFTER vi.mock so we get the mock instance
import { supabase } from '../../supabaseClient';

const renderSignup = () =>
  render(<MemoryRouter><Signup /></MemoryRouter>);

describe('Signup Page', () => {
  // NOTE: fake timers are only activated inside the one test that needs the
  // 500ms navigation delay. All other tests use real timers so that waitFor
  // can poll normally.
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Form rendering ───────────────────────────────────────────────────────

  describe('Form rendering', () => {
    it('renders the email input', () => {
      renderSignup();
      expect(screen.getByPlaceholderText('USER@STADIUM.MOBI')).toBeInTheDocument();
    });

    it('renders the password input', () => {
      renderSignup();
      const inputs = screen.getAllByPlaceholderText('••••••••');
      expect(inputs.length).toBeGreaterThan(0);
    });

    it('renders the CREATE ACCOUNT submit button', () => {
      renderSignup();
      expect(screen.getByText('CREATE ACCOUNT')).toBeInTheDocument();
    });

    it('renders the Back link', () => {
      renderSignup();
      expect(screen.getByText('Back')).toBeInTheDocument();
    });
  });

  // ─── Successful signup (session returned → navigate to /onboarding) ───────

  describe('Successful signup', () => {
    beforeEach(() => {
      supabase.auth.signUp.mockResolvedValue({
        data: { user: { id: 'u1' }, session: { access_token: 'tok' } },
        error: null,
      });
    });

    it('calls supabase.auth.signUp with the entered email and password', async () => {
      renderSignup();
      fireEvent.change(screen.getByPlaceholderText('USER@STADIUM.MOBI'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getAllByPlaceholderText('••••••••')[0], {
        target: { value: 'password123' },
      });
      fireEvent.submit(screen.getByRole('button', { name: /CREATE ACCOUNT/i }).closest('form'));
      await waitFor(() => expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      }));
    });

    it('navigates to /onboarding after the 500ms delay on success', async () => {
      vi.useFakeTimers();
      try {
        renderSignup();
        fireEvent.change(screen.getByPlaceholderText('USER@STADIUM.MOBI'), {
          target: { value: 'test@example.com' },
        });
        fireEvent.change(screen.getAllByPlaceholderText('••••••••')[0], {
          target: { value: 'password123' },
        });
        fireEvent.submit(screen.getByText('CREATE ACCOUNT').closest('form'));
        // Flush the async signUp promise
        await act(async () => {});
        // Advance past the 500ms navigation timeout
        act(() => { vi.advanceTimersByTime(500); });
        expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
      } finally {
        vi.useRealTimers();
      }
    });

    it('does NOT show the email confirmation screen on immediate-session signup', async () => {
      renderSignup();
      fireEvent.submit(screen.getByText('CREATE ACCOUNT').closest('form'));
      // Wait for the signUp promise to resolve
      await waitFor(() => expect(supabase.auth.signUp).toHaveBeenCalled());
      expect(screen.queryByText('Verify Access')).not.toBeInTheDocument();
    });
  });

  // ─── Email confirmation required (session is null) ─────────────────────

  describe('Email confirmation required', () => {
    beforeEach(() => {
      supabase.auth.signUp.mockResolvedValue({
        data: { user: { id: 'u1' }, session: null },
        error: null,
      });
    });

    it('shows the "Verify Access" confirmation screen', async () => {
      renderSignup();
      fireEvent.change(screen.getByPlaceholderText('USER@STADIUM.MOBI'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.submit(screen.getByText('CREATE ACCOUNT').closest('form'));
      await waitFor(() => expect(screen.getByText('Verify Access')).toBeInTheDocument());
    });

    it('displays the submitted email in the confirmation message', async () => {
      renderSignup();
      fireEvent.change(screen.getByPlaceholderText('USER@STADIUM.MOBI'), {
        target: { value: 'manager@club.com' },
      });
      fireEvent.submit(screen.getByText('CREATE ACCOUNT').closest('form'));
      await waitFor(() => expect(screen.getByText('manager@club.com')).toBeInTheDocument());
    });

    it('does not navigate when email confirmation is required', async () => {
      renderSignup();
      fireEvent.submit(screen.getByText('CREATE ACCOUNT').closest('form'));
      await waitFor(() => expect(supabase.auth.signUp).toHaveBeenCalled());
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('shows the "Return to Gate" link on the confirmation screen', async () => {
      renderSignup();
      fireEvent.submit(screen.getByText('CREATE ACCOUNT').closest('form'));
      await waitFor(() => expect(screen.getByText('Return to Gate')).toBeInTheDocument());
    });
  });

  // ─── Error handling ───────────────────────────────────────────────────────

  describe('Error handling', () => {
    it('displays the error message when signUp returns an error', async () => {
      supabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Email already registered' },
      });
      renderSignup();
      fireEvent.submit(screen.getByText('CREATE ACCOUNT').closest('form'));
      await waitFor(() =>
        expect(screen.getByText(/Email already registered/i)).toBeInTheDocument()
      );
    });

    it('does not navigate on a signup error', async () => {
      supabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Email already registered' },
      });
      renderSignup();
      fireEvent.submit(screen.getByText('CREATE ACCOUNT').closest('form'));
      await waitFor(() => expect(supabase.auth.signUp).toHaveBeenCalled());
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  // ─── Password visibility toggle ───────────────────────────────────────────

  describe('Password visibility toggle', () => {
    it('toggles the password field type between "password" and "text"', () => {
      renderSignup();
      const passwordInput = screen.getAllByPlaceholderText('••••••••')[0];
      expect(passwordInput).toHaveAttribute('type', 'password');
      // Click the eye-icon toggle button (type="button" inside the password wrapper)
      const toggleBtn = passwordInput.parentElement.querySelector('button[type="button"]');
      fireEvent.click(toggleBtn);
      expect(passwordInput).toHaveAttribute('type', 'text');
      fireEvent.click(toggleBtn);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });
});
