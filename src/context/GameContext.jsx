import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const GameContext = createContext();

export const useGame = () => useContext(GameContext);

export const GameProvider = ({ children }) => {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- 1. AUTH & LOAD LOGIC ---
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) loadProfile(session.user);
      else setLoading(false);
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) loadProfile(session.user);
      else {
        setUserProfile(null);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = (user) => {
    const savedData = localStorage.getItem('superSubProfile');
    if (savedData) {
      setUserProfile({ ...JSON.parse(savedData), id: user.id, email: user.email });
    } else {
      setUserProfile({ id: user.id, email: user.email, club_name: null });
    }
    setLoading(false);
  };

  // --- 2. PROFILE CREATION ---
  const createProfile = (managerName) => {
    const newProfile = {
      ...userProfile,
      name: managerName,
      club_name: `${managerName}'s FC`,
      coins: 500,
      energy: 3,
      maxEnergy: 5,
      inventory: ['c_match_result', 'c_total_goals', 'c_player_score'],
      createdAt: new Date().toISOString()
    };
    saveProfile(newProfile);
  };

  // --- 3. GAME LOGIC (The Missing Links) ---

  // Helper to save state + localStorage
  const saveProfile = (profile) => {
    setUserProfile(profile);
    localStorage.setItem('superSubProfile', JSON.stringify(profile));
  };

  // FIX FOR TRAINING: Consumes Energy
  const spendEnergy = (amount) => {
    if (!userProfile) return;
    const newProfile = { 
      ...userProfile, 
      energy: Math.max(0, userProfile.energy - amount) 
    };
    saveProfile(newProfile);
  };

  // FIX FOR TRAINING: Adds a single card
  const addCard = (cardId) => {
    if (!userProfile) return;
    const newProfile = {
      ...userProfile,
      inventory: [...userProfile.inventory, cardId]
    };
    saveProfile(newProfile);
  };

  // Existing bulk update (for opening bags)
  const updateInventory = (newCardIds) => {
    if (!userProfile) return;
    const newProfile = {
      ...userProfile,
      inventory: [...userProfile.inventory, ...newCardIds]
    };
    saveProfile(newProfile);
  };

  const value = {
    userProfile,
    loading,
    createProfile,
    spendEnergy,    // Now exposed to Training.jsx
    addCard,        // Now exposed to Training.jsx
    updateInventory
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};