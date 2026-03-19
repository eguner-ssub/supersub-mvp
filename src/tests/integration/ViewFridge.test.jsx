import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../shared/context/GameContext', () => ({ useGame: vi.fn() }));

import { useGame } from '../../shared/context/GameContext';
import ViewFridge from '../../features/locker-room/ViewFridge';

const makeContext = (overrides = {}) => ({
  userProfile: {
    id: 'u1',
    inventoryMap: { c_energy_drink: 2 },
  },
  consumeCard: vi.fn().mockResolvedValue(true),
  gainEnergy: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const renderFridge = (ctx = makeContext()) => {
  useGame.mockReturnValue(ctx);
  return render(<ViewFridge />);
};

describe('ViewFridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Display ──────────────────────────────────────────────────────────────

  describe('Display', () => {
    it('renders "The Fridge" heading', () => {
      renderFridge();
      expect(screen.getByText('The Fridge')).toBeInTheDocument();
    });

    it('shows "x2" when inventoryMap has 2 energy drinks', () => {
      renderFridge();
      expect(screen.getByText('x2')).toBeInTheDocument();
    });

    it('shows "x0" when inventoryMap has 0 energy drinks', () => {
      renderFridge(makeContext({
        userProfile: { id: 'u1', inventoryMap: { c_energy_drink: 0 } },
      }));
      expect(screen.getByText('x0')).toBeInTheDocument();
    });

    it('shows "x0" when inventoryMap is undefined', () => {
      renderFridge(makeContext({
        userProfile: { id: 'u1', inventoryMap: undefined },
      }));
      expect(screen.getByText('x0')).toBeInTheDocument();
    });
  });

  // ─── Popup ────────────────────────────────────────────────────────────────

  describe('Popup', () => {
    it('clicking the Energy Drink card opens the confirmation popup', () => {
      renderFridge();
      fireEvent.click(screen.getByText('Energy Drink'));
      expect(screen.getByText('Restore 3 Energy?')).toBeInTheDocument();
    });

    it('popup shows "DRINK" button when energy drinks > 0', () => {
      renderFridge();
      fireEvent.click(screen.getByText('Energy Drink'));
      expect(screen.getByRole('button', { name: 'DRINK' })).toBeInTheDocument();
    });

    it('"DRINK" button is enabled when count > 0', () => {
      renderFridge();
      fireEvent.click(screen.getByText('Energy Drink'));
      expect(screen.getByRole('button', { name: 'DRINK' })).not.toBeDisabled();
    });

    it('"DRINK" button shows "NONE LEFT" and is disabled when count === 0', () => {
      renderFridge(makeContext({
        userProfile: { id: 'u1', inventoryMap: { c_energy_drink: 0 } },
      }));
      fireEvent.click(screen.getByText('Energy Drink'));
      const drinkBtn = screen.getByRole('button', { name: 'NONE LEFT' });
      expect(drinkBtn).toBeInTheDocument();
      expect(drinkBtn).toBeDisabled();
    });

    it('popup closes when the X button is clicked', () => {
      renderFridge();
      fireEvent.click(screen.getByText('Energy Drink'));
      expect(screen.getByText('Restore 3 Energy?')).toBeInTheDocument();
      // The X close button is the only other interactive element in the popup header
      const closeBtn = screen.getByText('Restore 3 Energy?')
        .closest('[class*="fixed"]')
        ?.querySelector('button:first-child');
      // Fallback: find via accessible role (close icon button has no text, use container query)
      const popup = screen.getByText('Restore 3 Energy?').closest('[class*="rounded-2xl"]');
      const xBtn = popup.querySelector('button');
      fireEvent.click(xBtn);
      expect(screen.queryByText('Restore 3 Energy?')).not.toBeInTheDocument();
    });
  });

  // ─── handleDrink — successful consumption ─────────────────────────────────

  describe('handleDrink — successful consumption', () => {
    it('calls consumeCard("c_energy_drink") when DRINK is clicked', async () => {
      const ctx = makeContext();
      renderFridge(ctx);
      fireEvent.click(screen.getByText('Energy Drink'));
      fireEvent.click(screen.getByRole('button', { name: 'DRINK' }));
      await waitFor(() =>
        expect(ctx.consumeCard).toHaveBeenCalledWith('c_energy_drink')
      );
    });

    it('calls gainEnergy(3) after consumeCard resolves true', async () => {
      const ctx = makeContext();
      renderFridge(ctx);
      fireEvent.click(screen.getByText('Energy Drink'));
      fireEvent.click(screen.getByRole('button', { name: 'DRINK' }));
      await waitFor(() =>
        expect(ctx.gainEnergy).toHaveBeenCalledWith(3)
      );
    });

    it('closes the popup after successful drink', async () => {
      renderFridge();
      fireEvent.click(screen.getByText('Energy Drink'));
      fireEvent.click(screen.getByRole('button', { name: 'DRINK' }));
      await waitFor(() =>
        expect(screen.queryByText('Restore 3 Energy?')).not.toBeInTheDocument()
      );
    });

    it('shows the "Energy Restored!" toast after drinking', async () => {
      renderFridge();
      fireEvent.click(screen.getByText('Energy Drink'));
      fireEvent.click(screen.getByRole('button', { name: 'DRINK' }));
      await waitFor(() =>
        expect(screen.getByText('⚡ Energy Restored!')).toBeInTheDocument()
      );
    });
  });

  // ─── handleDrink — consumeCard returns false ──────────────────────────────

  describe('handleDrink — consumeCard returns false', () => {
    it('does NOT call gainEnergy when consumeCard returns false', async () => {
      const ctx = makeContext({
        consumeCard: vi.fn().mockResolvedValue(false),
        gainEnergy: vi.fn(),
      });
      renderFridge(ctx);
      fireEvent.click(screen.getByText('Energy Drink'));
      fireEvent.click(screen.getByRole('button', { name: 'DRINK' }));
      await waitFor(() => expect(ctx.consumeCard).toHaveBeenCalled());
      expect(ctx.gainEnergy).not.toHaveBeenCalled();
    });

    it('keeps the popup open when consumeCard returns false', async () => {
      const ctx = makeContext({
        consumeCard: vi.fn().mockResolvedValue(false),
      });
      renderFridge(ctx);
      fireEvent.click(screen.getByText('Energy Drink'));
      fireEvent.click(screen.getByRole('button', { name: 'DRINK' }));
      await waitFor(() => expect(ctx.consumeCard).toHaveBeenCalled());
      expect(screen.getByText('Restore 3 Energy?')).toBeInTheDocument();
    });
  });

  // ─── Loading guard ────────────────────────────────────────────────────────

  describe('Loading guard', () => {
    it('shows "DRINKING..." and disables the button during the async operation', async () => {
      // consumeCard returns a never-resolving promise so we can inspect mid-flight state
      const ctx = makeContext({
        consumeCard: vi.fn(() => new Promise(() => {})),
      });
      renderFridge(ctx);
      fireEvent.click(screen.getByText('Energy Drink'));
      fireEvent.click(screen.getByRole('button', { name: 'DRINK' }));
      // Immediately after click, isDrinking=true
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: 'DRINKING...' });
        expect(btn).toBeDisabled();
      });
    });
  });
});
