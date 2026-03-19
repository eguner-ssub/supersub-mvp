import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '../../pages/Login';

// Auto-picks up src/__mocks__/supabaseClient.js
vi.mock('../../supabaseClient');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import { supabase } from '../../supabaseClient';

const renderLogin = () =>
  render(<MemoryRouter><Login /></MemoryRouter>);

const fillEmail = (value) =>
  fireEvent.change(screen.getByPlaceholderText('USER@STADIUM.MOBI'), {
    target: { value },
  });

const fillPassword = (value) =>
  fireEvent.change(screen.getAllByPlaceholderText('••••••••')[0], {
    target: { value },
  });

describe('Login Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Form rendering ───────────────────────────────────────────────────────

  describe('Form rendering', () => {
    it('renders the "Welcome Back" heading', () => {
      renderLogin();
      expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    });

    it('renders the Terminal ID (email) input', () => {
      renderLogin();
      expect(screen.getByPlaceholderText('USER@STADIUM.MOBI')).toBeInTheDocument();
    });

    it('renders the Security Key (password) input', () => {
      renderLogin();
      expect(screen.getAllByPlaceholderText('••••••••').length).toBeGreaterThan(0);
    });

    it('renders the "Access Profile" submit button', () => {
      renderLogin();
      expect(screen.getByText('Access Profile')).toBeInTheDocument();
    });

    it('renders the "Dispatch Magic Link" button', () => {
      renderLogin();
      expect(screen.getByText('Dispatch Magic Link')).toBeInTheDocument();
    });

    it('renders the "Gate" back link', () => {
      renderLogin();
      expect(screen.getByText('Gate')).toBeInTheDocument();
    });
  });

  // ─── Password login — success ─────────────────────────────────────────────

  describe('Password login — success', () => {
    beforeEach(() => {
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'u1' }, session: {} },
        error: null,
      });
    });

    it('calls signInWithPassword with trimmed email and password', async () => {
      renderLogin();
      fillEmail('  test@example.com  ');
      fillPassword('secret123');
      fireEvent.submit(screen.getByText('Access Profile').closest('form'));
      await waitFor(() =>
        expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'secret123',
        })
      );
    });

    it('navigates to /dashboard with replace:true on successful login', async () => {
      renderLogin();
      fillEmail('test@example.com');
      fillPassword('secret123');
      fireEvent.submit(screen.getByText('Access Profile').closest('form'));
      await waitFor(() =>
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
      );
    });

    it('does not show an error message on success', async () => {
      renderLogin();
      fillEmail('test@example.com');
      fillPassword('secret123');
      fireEvent.submit(screen.getByText('Access Profile').closest('form'));
      await act(async () => {});
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });
  });

  // ─── Password login — error ───────────────────────────────────────────────

  describe('Password login — error', () => {
    beforeEach(() => {
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid login credentials' },
      });
    });

    it('displays the error message returned by supabase', async () => {
      renderLogin();
      fillEmail('test@example.com');
      fillPassword('wrongpass');
      fireEvent.submit(screen.getByText('Access Profile').closest('form'));
      await waitFor(() =>
        expect(screen.getByText('Invalid login credentials')).toBeInTheDocument()
      );
    });

    it('does not navigate on a failed login', async () => {
      renderLogin();
      fillEmail('test@example.com');
      fillPassword('wrongpass');
      fireEvent.submit(screen.getByText('Access Profile').closest('form'));
      await act(async () => {});
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  // ─── Magic link ───────────────────────────────────────────────────────────

  describe('Magic link', () => {
    it('shows "Terminal ID required." error when clicked without an email', async () => {
      renderLogin();
      fireEvent.click(screen.getByText('Dispatch Magic Link'));
      expect(screen.getByText('Terminal ID required.')).toBeInTheDocument();
      expect(supabase.auth.signInWithOtp).not.toHaveBeenCalled();
    });

    it('calls signInWithOtp with the entered email', async () => {
      supabase.auth.signInWithOtp.mockResolvedValue({ error: null });
      renderLogin();
      fillEmail('manager@club.com');
      fireEvent.click(screen.getByText('Dispatch Magic Link'));
      await waitFor(() =>
        expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith(
          expect.objectContaining({ email: 'manager@club.com' })
        )
      );
    });

    it('shows "Authentication link dispatched." on OTP success', async () => {
      supabase.auth.signInWithOtp.mockResolvedValue({ error: null });
      renderLogin();
      fillEmail('manager@club.com');
      fireEvent.click(screen.getByText('Dispatch Magic Link'));
      await waitFor(() =>
        expect(screen.getByText('Authentication link dispatched.')).toBeInTheDocument()
      );
    });

    it('shows an error message when signInWithOtp fails', async () => {
      supabase.auth.signInWithOtp.mockResolvedValue({
        error: { message: 'Email rate limit exceeded' },
      });
      renderLogin();
      fillEmail('manager@club.com');
      fireEvent.click(screen.getByText('Dispatch Magic Link'));
      await waitFor(() =>
        expect(screen.getByText('Email rate limit exceeded')).toBeInTheDocument()
      );
    });
  });

  // ─── Password visibility toggle ───────────────────────────────────────────

  describe('Password visibility toggle', () => {
    it('toggles the password field between "password" and "text" on eye-icon click', () => {
      renderLogin();
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
