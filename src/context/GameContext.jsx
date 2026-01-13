import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const GameContext = createContext();

export const useGame = () => useContext(GameContext);

export const GameProvider = ({ children }) => {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- 1. INITIAL LOAD & AUTH LISTENER ---
  useEffect(() => {
    // Check active session immediately
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await loadProfile(session.user);
      } else {
        setLoading(false);
      }
    };
    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        await loadProfile(session.user);
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- 2. LOAD PROFILE (FROM DB) ---
  const loadProfile = async (user) => {
    try {
      // A. Fetch Profile Stats
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error loading profile:', profileError);
      }

      // B. Fetch Inventory
      const { data: inventoryData, error: invError } = await supabase
        .from('inventory')
        .select('card_id')
        .eq('user_id', user.id);

      if (profileData) {
        // MERGE DB DATA INTO STATE
        setUserProfile({
          ...profileData,
          email: user.email,
          inventory: inventoryData ? inventoryData.map(i => i.card_id) : []
        });
      } else {
        // User exists in Auth but not in 'profiles' table yet (needs Onboarding)
        setUserProfile({ 
          id: user.id, 
          email: user.email, 
          club_name: null // Triggers Onboarding flow
        });
      }
    } catch (error) {
      console.error('Load Profile Fatal Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- 3. CREATE PROFILE (ONBOARDING) ---
  const createProfile = async (managerName) => {
    if (!userProfile?.id) return;

    const newProfile = {
      id: userProfile.id, // Links to Auth User
      name: managerName,
      club_name: `${managerName}'s FC`,
      coins: 500,
      energy: 3,
      max_energy: 5,
      // We don't store inventory in 'profiles' table, we use 'inventory' table
    };

    // 1. Insert into DB
    const { error } = await supabase.from('profiles').insert([newProfile]);

    if (error) {
      console.error('Error creating profile:', error);
      return;
    }

    // 2. Add Starter Cards
    const starterCards = ['c_match_result', 'c_total_goals', 'c_player_score'];
    await updateInventory(starterCards);

    // 3. Update State
    setUserProfile({
      ...newProfile,
      email: userProfile.email,
      inventory: starterCards
    });
  };

  // --- 4. GAME ACTIONS (DB WRITES) ---

  const spendEnergy = async (amount) => {
    if (!userProfile) return;
    
    const newEnergy = Math.max(0, userProfile.energy - amount);
    
    // Optimistic UI Update (Instant)
    setUserProfile(prev => ({ ...prev, energy: newEnergy }));

    // DB Update (Background)
    const { error } = await supabase
      .from('profiles')
      .update({ energy: newEnergy })
      .eq('id', userProfile.id);

    if (error) console.error('Failed to sync energy:', error);
  };

  const addCard = async (cardId) => {
    if (!userProfile) return;

    // Optimistic UI Update
    setUserProfile(prev => ({
      ...prev,
      inventory: [...(prev.inventory || []), cardId]
    }));

    // DB Insert
    const { error } = await supabase
      .from('inventory')
      .insert([{ user_id: userProfile.id, card_id: cardId }]);

    if (error) console.error('Failed to add card:', error);
  };

  const updateInventory = async (newCardIds) => {
    if (!userProfile) return;

    // Optimistic UI
    setUserProfile(prev => ({
      ...prev,
      inventory: [...(prev.inventory || []), ...newCardIds]
    }));

    // DB Bulk Insert
    const rows = newCardIds.map(cid => ({
      user_id: userProfile.id,
      card_id: cid
    }));

    const { error } = await supabase.from('inventory').insert(rows);
    if (error) console.error('Failed to update inventory:', error);
  };

  const value = {
    userProfile,
    loading,
    createProfile,
    spendEnergy,
    addCard,
    updateInventory
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};