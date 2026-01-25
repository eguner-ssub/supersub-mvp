import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import { useGame } from '../context/GameContext';

// Mock Context
vi.mock('../context/GameContext', () => ({
  useGame: vi.fn(),
}));

// Mock Location manually since we aren't using the full router mock
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Dashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- DEFINE DATA HERE SO ALL TESTS CAN USE IT ---
  const mockProfile = {
    id: '123',
    club_name: 'Test FC',
    name: 'Test Manager',
    coins: 1000,
    energy: 5,
    max_energy: 5,
    inventory: []
  };

  it('triggers bag opening and updates inventory', async () => {
    const mockUpdateInventory = vi.fn();

    useGame.mockReturnValue({
      userProfile: mockProfile,
      loading: false,
      updateInventory: mockUpdateInventory
    });

    // Render with state: { firstLogin: true }
    render(
      <MemoryRouter initialEntries={[{ pathname: '/dashboard', state: { firstLogin: true } }]}>
        <Dashboard />
      </MemoryRouter>
    );

    // 1. Verify Overlay is Present
    const overlayTitle = screen.getByText(/Kit Delivery/i);
    expect(overlayTitle).toBeInTheDocument();

    // 2. Find the Bag Button specifically inside the Overlay
    const overlayContainer = overlayTitle.parentElement;
    const bagButton = within(overlayContainer).getByRole('button');

    fireEvent.click(bagButton);

    // 3. Fast-forward animation (1500ms)
    act(() => {
      vi.advanceTimersByTime(1600);
    });

    // 4. Verify Next Stage (Rewards)
    expect(screen.getByText(/Squad Ready/i)).toBeInTheDocument();

    // 5. Verify Inventory Update was called
    expect(mockUpdateInventory).toHaveBeenCalled();

    // 6. Close the overlay
    const closeBtn = screen.getByText(/Enter Dressing Room/i);
    fireEvent.click(closeBtn);

    // 7. Overlay should be gone
    expect(screen.queryByText(/Kit Delivery/i)).not.toBeInTheDocument();
  });

  it('navigates to account when club name is clicked', async () => {
    useGame.mockReturnValue({
      userProfile: mockProfile,
      loading: false,
      updateInventory: vi.fn()
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Find the club name button
    const clubNameBtn = screen.getByText('Test FC');
    fireEvent.click(clubNameBtn);

    // Verify navigation
    expect(mockNavigate).toHaveBeenCalledWith('/account');
  });

  // --- NEW TESTS FOR GOLDEN MASTER HITBOX NAVIGATION ---
  it('navigates to inventory when kitbag hotspot is tapped', () => {
    useGame.mockReturnValue({
      userProfile: mockProfile,
      loading: false,
      updateInventory: vi.fn()
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    const hotspot = screen.getByTestId('hotspot-inventory');
    fireEvent.click(hotspot);

    expect(mockNavigate).toHaveBeenCalledWith('/inventory');
  });

  it('navigates to training when cones hotspot is tapped', () => {
    useGame.mockReturnValue({
      userProfile: mockProfile,
      loading: false,
      updateInventory: vi.fn()
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    const hotspot = screen.getByTestId('hotspot-training');
    fireEvent.click(hotspot);

    expect(mockNavigate).toHaveBeenCalledWith('/training');
  });

  it('navigates to shop when drinks hotspot is tapped', () => {
    useGame.mockReturnValue({
      userProfile: mockProfile,
      loading: false,
      updateInventory: vi.fn()
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    const hotspot = screen.getByTestId('hotspot-shop');
    fireEvent.click(hotspot);

    expect(mockNavigate).toHaveBeenCalledWith('/shop');
  });

  it('navigates to missions when tablet hotspot is tapped', () => {
    useGame.mockReturnValue({
      userProfile: mockProfile,
      loading: false,
      updateInventory: vi.fn()
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    const hotspot = screen.getByTestId('hotspot-missions');
    fireEvent.click(hotspot);

    expect(mockNavigate).toHaveBeenCalledWith('/missions');
  });

  it('navigates to manager office when chevron is clicked', () => {
    useGame.mockReturnValue({
      userProfile: mockProfile,
      loading: false,
      updateInventory: vi.fn()
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    const chevronNav = screen.getByTestId('nav-office');
    fireEvent.click(chevronNav);

    expect(mockNavigate).toHaveBeenCalledWith('/manager-office');
  });

  it('shows LIVE indicator on whiteboard when live bets exist', () => {
    // Mock Supabase with proper channel subscription
    const mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() })
    };

    const mockSupabase = {
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: vi.fn()
    };

    useGame.mockReturnValue({
      userProfile: mockProfile,
      loading: false,
      updateInventory: vi.fn(),
      supabase: mockSupabase,
      checkActiveBets: vi.fn(),
      loadProfile: vi.fn()
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Initially no LIVE indicator
    expect(screen.queryByText(/LIVE NOW/i)).not.toBeInTheDocument();
  });

  it('navigates to pending bets when whiteboard is clicked', () => {
    useGame.mockReturnValue({
      userProfile: mockProfile,
      loading: false,
      updateInventory: vi.fn()
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    const whiteboard = screen.getByTestId('hotspot-whiteboard');
    fireEvent.click(whiteboard);

    expect(mockNavigate).toHaveBeenCalledWith('/inventory?tab=pending');
  });

});