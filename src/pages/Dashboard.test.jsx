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
  }); // <--- OLD TEST CLOSES HERE

  // --- NEW TEST LIVES HERE (OUTSIDE THE OTHER ONE) ---
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

});