// src/context/GameContext.jsx
import React, { createContext, useContext, useState } from 'react';

// 1. Create the Context
const GameContext = createContext();

// 2. Export the Provider (Named Export)
export const GameProvider = ({ children }) => {
  const [userProfile, setUserProfile] = useState({
    energy: 3,
    maxEnergy: 3,
    coins: 100,
    inventory: ['c_match_result', 'c_total_goals'], // Mock items
    name: "Player 1"
  });

  return (
    <GameContext.Provider value={{ userProfile, isNewUser: false, isLoading: false }}>
      {children}
    </GameContext.Provider>
  );
};

// 3. Export the Hook (Named Export)
export const useGame = () => useContext(GameContext);

export default GameContext;