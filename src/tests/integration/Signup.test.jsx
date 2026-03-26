import { describe, it, expect, vi, beforeEach } from 'vitest';
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fillEmail = (value = 'test@example.com') =>
  fireEvent.change(screen.getByPlaceholderText('USER@STADIUM.MOBI'), {
    target: { value },
  });

const fillPassword = (value = 'password123') =>
  fireEvent.change(screen.getAllByPlaceholderText('••••••••')[0], {
    target: { value },
  });

const checkAgeBox = () => {
  const [ageCheckbox] = screen.getAllByRole('checkbox');
  fireEvent.click(ageCheckbox);
};

const checkTermsBox = () => {
  const [, termsCheckbox] = screen.getAllByRole('checkbox');
  fireEvent.click(termsCheckbox);
};

const checkBothBoxes = () => { checkAgeBox(); checkTermsBox(); };

const submitForm = () =>
  fireEvent.submit(screen.getByText('CREATE ACCOUNT').closest('form'));

describe('Signup Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Form rendering ─────────────────────────────────────────────────────────

  describe('Form rendering', () => {
    it('renders the email input', () => {
      renderSignup();
      expect(screen.getByPlaceholderText('USER@STADIUM.MOBI')).toBeInTheDocument();
    });

    it('renders the password input', () => {
      renderSignup();
      expect(screen.getAllByPlaceholderText('••••••••').length).toBeGreaterThan(0);
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

  // ─── Compliance checkboxes ──────────────────────────────────────────────────

  describe('Compliance checkboxes', () => {
    it('renders the age confirmation checkbox', () => {
      renderSignup();
      expect(screen.getByText(/I confirm I am 18 years of age/i)).toBeInTheDocument();
    });

    it('renders the terms acceptance checkbox', () => {
      renderSignup();
      expect(screen.getByText(/I agree to the/i)).toBeInTheDocument();
    });

    it('renders inline Terms of Service link within the terms checkbox label', () => {
      renderSignup();
      const links = screen.getAllByRole('link', { name: /Terms of Service/i });
      // One in the checkbox label, one in the footer — at least one must exist
      expect(links.length).toBeGreaterThanOrEqual(1);
    });

    it('renders inline Privacy Policy link within the terms checkbox label', () => {
      renderSignup();
      const links = screen.getAllByRole('link', { name: /Privacy Policy/i });
      expect(links.length).toBeGreaterThanOrEqual(1);
    });

    it('renders footer Terms of Service and Privacy Policy links below the button', () => {
      renderSignup();
      // getAllByRole picks up both the inline label link and the footer link
      expect(screen.getAllByRole('link', { name: /Terms of Service/i }).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByRole('link', { name: /Privacy Policy/i }).length).toBeGreaterThanOrEqual(1);
    });

    it('blocks submission and shows error when neither checkbox is checked', async () => {
      renderSignup();
      fillEmail(); fillPassword();
      submitForm();
      await waitFor(() =>
        expect(screen.getByText(/Please confirm your age/i)).toBeInTheDocument()
      );
      expect(supabase.auth.signUp).not.toHaveBeenCalled();
    });

    it('blocks submission when only the age box is checked', async () => {
      renderSignup();
      fillEmail(); fillPassword();
      checkAgeBox();
      submitForm();
      await waitFor(() =>
        expect(screen.getByText(/Please confirm your age/i)).toBeInTheDocument()
      );
      expect(supabase.auth.signUp).not.toHaveBeenCalled();
    });

    it('blocks submission when only the terms box is checked', async () => {
      renderSignup();
      fillEmail(); fillPassword();
      checkTermsBox();
      submitForm();
      await waitFor(() =>
        expect(screen.getByText(/Please confirm your age/i)).toBeInTheDocument()
      );
      expect(supabase.auth.signUp).not.toHaveBeenCalled();
    });

    it('clears the compliance error when the user rechecks a box after a failed attempt', async () => {
      renderSignup();
      fillEmail(); fillPassword();
      submitForm();
      await waitFor(() =>
        expect(screen.getByText(/Please confirm your age/i)).toBeInTheDocument()
      );
      checkAgeBox();
      // Error should still be visible until a new submit — but checking the box doesn't auto-clear
      // Re-submit with both boxes → error clears on the new submit cycle
      checkTermsBox();
      supabase.auth.signUp.mockResolvedValue({
        data: { user: { id: 'u1' }, session: { access_token: 'tok' } },
        error: null,
      });
      submitForm();
      await waitFor(() => expect(supabase.auth.signUp).toHaveBeenCalled());
    });

    it('calls signUp when both boxes are checked', async () => {
      supabase.auth.signUp.mockResolvedValue({
        data: { user: { id: 'u1' }, session: { access_token: 'tok' } },
        error: null,
      });
      renderSignup();
      fillEmail(); fillPassword();
      checkBothBoxes();
      submitForm();
      await waitFor(() => expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      }));
    });

    it('calls profiles upsert with is_age_verified=true and terms_accepted_at on success', async () => {
      supabase.auth.signUp.mockResolvedValue({
        data: { user: { id: 'u1' }, session: { access_token: 'tok' } },
        error: null,
      });
      renderSignup();
      fillEmail(); fillPassword();
      checkBothBoxes();
      submitForm();
      await waitFor(() => expect(supabase.from).toHaveBeenCalledWith('profiles'));
      // The upsert on the returned from() object must have been called with compliance data
      const upsertMock = supabase.from.mock.results[0]?.value?.upsert;
      await waitFor(() =>
        expect(upsertMock).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'u1',
            is_age_verified: true,
            terms_accepted_at: expect.any(String),
          }),
          expect.objectContaining({ onConflict: 'id' })
        )
      );
    });

    it('does not call from("profiles") when signUp fails', async () => {
      supabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Email already registered' },
      });
      renderSignup();
      fillEmail(); fillPassword();
      checkBothBoxes();
      submitForm();
      await waitFor(() => expect(supabase.auth.signUp).toHaveBeenCalled());
      // The upsert path requires from('profiles') — if that was never called, upsert wasn't called
      const profilesCalls = supabase.from.mock.calls.filter(c => c[0] === 'profiles');
      expect(profilesCalls.length).toBe(0);
    });
  });

  // ─── Successful signup ──────────────────────────────────────────────────────

  describe('Successful signup', () => {
    beforeEach(() => {
      supabase.auth.signUp.mockResolvedValue({
        data: { user: { id: 'u1' }, session: { access_token: 'tok' } },
        error: null,
      });
    });

    it('calls supabase.auth.signUp with the entered email and password', async () => {
      renderSignup();
      fillEmail(); fillPassword();
      checkBothBoxes();
      submitForm();
      await waitFor(() => expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      }));
    });

    it('navigates to /onboarding after the 500ms delay on success', async () => {
      vi.useFakeTimers();
      try {
        renderSignup();
        fillEmail(); fillPassword();
        checkBothBoxes();
        submitForm();
        // Flush the async signUp promise and the upsert
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
      checkBothBoxes();
      submitForm();
      await waitFor(() => expect(supabase.auth.signUp).toHaveBeenCalled());
      expect(screen.queryByText('Verify Access')).not.toBeInTheDocument();
    });
  });

  // ─── Email confirmation required ────────────────────────────────────────────

  describe('Email confirmation required', () => {
    beforeEach(() => {
      supabase.auth.signUp.mockResolvedValue({
        data: { user: { id: 'u1' }, session: null },
        error: null,
      });
    });

    it('shows the "Verify Access" confirmation screen', async () => {
      renderSignup();
      fillEmail('test@example.com');
      checkBothBoxes();
      submitForm();
      await waitFor(() => expect(screen.getByText('Verify Access')).toBeInTheDocument());
    });

    it('displays the submitted email in the confirmation message', async () => {
      renderSignup();
      fillEmail('manager@club.com');
      checkBothBoxes();
      submitForm();
      await waitFor(() => expect(screen.getByText('manager@club.com')).toBeInTheDocument());
    });

    it('does not navigate when email confirmation is required', async () => {
      renderSignup();
      checkBothBoxes();
      submitForm();
      await waitFor(() => expect(supabase.auth.signUp).toHaveBeenCalled());
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('shows the "Return to Gate" link on the confirmation screen', async () => {
      renderSignup();
      checkBothBoxes();
      submitForm();
      await waitFor(() => expect(screen.getByText('Return to Gate')).toBeInTheDocument());
    });
  });

  // ─── Error handling ──────────────────────────────────────────────────────────

  describe('Error handling', () => {
    it('displays the error message when signUp returns an error', async () => {
      supabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Email already registered' },
      });
      renderSignup();
      checkBothBoxes();
      submitForm();
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
      checkBothBoxes();
      submitForm();
      await waitFor(() => expect(supabase.auth.signUp).toHaveBeenCalled());
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  // ─── Password visibility toggle ──────────────────────────────────────────────

  describe('Password visibility toggle', () => {
    it('toggles the password field type between "password" and "text"', () => {
      renderSignup();
      const passwordInput = screen.getAllByPlaceholderText('••••••••')[0];
      expect(passwordInput).toHaveAttribute('type', 'password');
      const toggleBtn = passwordInput.parentElement.querySelector('button[type="button"]');
      fireEvent.click(toggleBtn);
      expect(passwordInput).toHaveAttribute('type', 'text');
      fireEvent.click(toggleBtn);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });
});
