import React from 'react';
import { vi } from 'vitest';

// Default mock user profile
export const mockUserProfile = {
  id: 'test-user-id',
  email: 'test@example.com',
  club_name: 'Test FC',
  name: 'Test Manager',
  points: 1000,
  energy: 5,
  max_energy: 5,
  inventory: ['c_match_result', 'c_total_goals'],
  inventoryMap: { c_energy_drink: 2, c_match_result: 1 },
};

// Default mock context value factory function
export const createMockGameContextValue = (overrides = {}) => ({
  userProfile: mockUserProfile,
  loading: false,
  createProfile: vi.fn(),
  spendEnergy: vi.fn(),
  gainEnergy: vi.fn(),
  consumeCard: vi.fn(),
  placeBet: vi.fn(),
  loadProfile: vi.fn(),
  updateInventory: vi.fn(),
  ...overrides,
});

// Default mock context value
export const mockGameContextValue = createMockGameContextValue();

// Mock GameContext for testing
export const GameContext = React.createContext(mockGameContextValue);

export const useGame = () => {
  return React.useContext(GameContext);
};

export const GameProvider = ({ children, value = mockGameContextValue }) => {
  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};
