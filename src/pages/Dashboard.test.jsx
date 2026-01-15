import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react'; // Added 'within'
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

  it('triggers bag opening and updates inventory', async () => {
    const mockUpdateInventory = vi.fn();
    
    useGame.mockReturnValue({
      userProfile: { 
        id: '123', 
        club_name: 'Test FC', 
        coins: 1000, 
        energy: 5, 
        max_energy: 5, 
        inventory: [] 
      },
      loading: false,
      updateInventory: mockUpdateInventory
    });

    // Render with state: { firstLogin: true }
    render(
      <MemoryRouter initialEntries={[{ pathname: '/dashboard', state: { firstLogin: true } }]}>
        <Dashboard />
      </MemoryRouter>
    );

    // 1. Verify Overlay is Present by finding the Heading
    const overlayTitle = screen.getByText(/Kit Delivery/i);
    expect(overlayTitle).toBeInTheDocument();

    // 2. Find the Bag Button specifically inside the Overlay
    // We grab the parent container of the "Kit Delivery" text to ignore background buttons
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
});