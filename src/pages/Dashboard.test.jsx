import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import { useGame } from '../context/GameContext';

// --- MOCKS ---
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/dashboard', state: {} }),
  };
});

vi.mock('../context/GameContext', () => ({
  useGame: vi.fn(),
}));

describe('Dashboard (The Living Room)', () => {

  // Default User Profile for Tests
  const mockProfile = {
    id: 'user-123',
    club_name: 'Antigravity FC',
    energy: 3,
    max_energy: 5,
    coins: 1000,
  };

  const mockSpendEnergy = vi.fn();
  const mockGainEnergy = vi.fn();
  const mockUpdateInventory = vi.fn();
  const mockCheckActiveBets = vi.fn();
  const mockLoadProfile = vi.fn();

  // Mock Supabase
  const mockSupabase = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    })),
    channel: () => ({
      on: () => ({ subscribe: () => { } }),
      unsubscribe: () => { },
    }),
    removeChannel: () => { },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useGame.mockReturnValue({
      userProfile: mockProfile,
      loading: false,
      spendEnergy: mockSpendEnergy,
      gainEnergy: mockGainEnergy,
      updateInventory: mockUpdateInventory,
      checkActiveBets: mockCheckActiveBets,
      loadProfile: mockLoadProfile,
      supabase: mockSupabase,
    });
  });

  it('renders the room and HUD correctly', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Wait for component to render
    await waitFor(() => {
      expect(screen.getByAltText('Dressing Room')).toBeInTheDocument();
    });

    // Check HUD displays energy and coins
    expect(screen.getByText('3/5')).toBeInTheDocument(); // Energy
    expect(screen.getByText('1000')).toBeInTheDocument(); // Coins
  });

  // --- INTERACTION TESTS ---

  it('navigates to Training when Cones are clicked', async () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByTestId('hotspot-training')).toBeInTheDocument();
    });

    const cones = screen.getByTestId('hotspot-training');
    fireEvent.click(cones);

    expect(mockNavigate).toHaveBeenCalledWith('/training');
  });

  it('navigates to Pending Bets when Whiteboard is clicked', async () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByTestId('hotspot-whiteboard')).toBeInTheDocument();
    });

    const whiteboard = screen.getByTestId('hotspot-whiteboard');
    fireEvent.click(whiteboard);

    expect(mockNavigate).toHaveBeenCalledWith('/inventory?tab=pending');
  });

  it('navigates to Training when Tablet is clicked (training not completed)', async () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByTestId('hotspot-tablet')).toBeInTheDocument();
    });

    const tablet = screen.getByTestId('hotspot-tablet');
    fireEvent.click(tablet);

    // Since trainingCompletedToday is false by default, should navigate to training
    expect(mockNavigate).toHaveBeenCalledWith('/training');
  });

  // --- CRITICAL LOGIC TESTS ---

  it('opens Energy Modal when Drinks are clicked (instead of navigating)', async () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByTestId('hotspot-drinks')).toBeInTheDocument();
    });

    // 1. Click Drinks
    const drinks = screen.getByTestId('hotspot-drinks');
    fireEvent.click(drinks);

    // 2. Verify Modal Opens (not navigation)
    await waitFor(() => {
      expect(screen.getByText('Hydration Station')).toBeInTheDocument();
    });

    // 3. Verify navigation was NOT called
    expect(mockNavigate).not.toHaveBeenCalled();

    // 4. Verify "Drink" button exists and is functional
    const drinkBtn = screen.getByText(/Drink \(Restore\)/i);
    expect(drinkBtn).toBeInTheDocument();

    fireEvent.click(drinkBtn);

    // 5. Verify gainEnergy was called
    await waitFor(() => {
      expect(mockGainEnergy).toHaveBeenCalledWith(1);
    });
  });

  it('closes Energy Modal when X button is clicked', async () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByTestId('hotspot-drinks')).toBeInTheDocument();
    });

    // Open modal
    const drinks = screen.getByTestId('hotspot-drinks');
    fireEvent.click(drinks);

    await waitFor(() => {
      expect(screen.getByText('Hydration Station')).toBeInTheDocument();
    });

    // Close modal
    const closeBtn = screen.getAllByRole('button').find(btn =>
      btn.querySelector('svg') // Find button with X icon
    );

    if (closeBtn) {
      fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByText('Hydration Station')).not.toBeInTheDocument();
      });
    }
  });

  it('navigates to Inventory Deck when Kitbag is clicked (No Daily Reward)', async () => {
    // Since dailyRewardAvailable is false by default in Dashboard.jsx
    render(<MemoryRouter><Dashboard /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByTestId('hotspot-inventory')).toBeInTheDocument();
    });

    const bag = screen.getByTestId('hotspot-inventory');
    fireEvent.click(bag);

    expect(mockNavigate).toHaveBeenCalledWith('/inventory?tab=deck');
  });

  it('shows disabled Drink button when energy is full', async () => {
    // Mock user with full energy
    useGame.mockReturnValue({
      userProfile: { ...mockProfile, energy: 5, max_energy: 5 },
      loading: false,
      spendEnergy: mockSpendEnergy,
      gainEnergy: mockGainEnergy,
      updateInventory: mockUpdateInventory,
      checkActiveBets: mockCheckActiveBets,
      loadProfile: mockLoadProfile,
      supabase: mockSupabase,
    });

    render(<MemoryRouter><Dashboard /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByTestId('hotspot-drinks')).toBeInTheDocument();
    });

    // Open modal
    const drinks = screen.getByTestId('hotspot-drinks');
    fireEvent.click(drinks);

    await waitFor(() => {
      expect(screen.getByText('Hydration Station')).toBeInTheDocument();
    });

    // Verify disabled state
    const disabledBtn = screen.getByText(/Max Energy Full/i);
    expect(disabledBtn).toBeInTheDocument();
    expect(disabledBtn).toBeDisabled();
  });

  it('displays active bet count badge when bets exist', async () => {
    // Mock Supabase to return active bets
    const mockSupabaseWithBets = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(() => Promise.resolve({
              data: [
                { id: 1, status: 'pending' },
                { id: 2, status: 'live' },
              ],
              error: null
            })),
          })),
        })),
      })),
      channel: () => ({
        on: () => ({ subscribe: () => { } }),
        unsubscribe: () => { },
      }),
      removeChannel: () => { },
    };

    useGame.mockReturnValue({
      userProfile: mockProfile,
      loading: false,
      spendEnergy: mockSpendEnergy,
      gainEnergy: mockGainEnergy,
      updateInventory: mockUpdateInventory,
      checkActiveBets: mockCheckActiveBets,
      loadProfile: mockLoadProfile,
      supabase: mockSupabaseWithBets,
    });

    render(<MemoryRouter><Dashboard /></MemoryRouter>);

    // Wait for bets to load and badge to appear
    await waitFor(() => {
      expect(screen.getByText('2 ACTIVE')).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});