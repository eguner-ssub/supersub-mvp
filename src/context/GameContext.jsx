import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const GameContext = createContext();

export const useGame = () => useContext(GameContext);

export const GameProvider = ({ children }) => {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- 1. INITIALIZATION & SESSION MANAGEMENT ---
  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          if (mounted) await loadProfile(session.user);
        } else {
          if (mounted) setLoading(false);
        }
      } catch (err) {
        console.error("Session Init Failed:", err);
        if (mounted) setLoading(false);
      }
    };

    initSession();

    // 2. Listen for Auth Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`AUTH EVENT: ${event}`);

      if (event === 'SIGNED_OUT') {
        // CHANGED: Only clear state. Do NOT clear localStorage here. 
        // Supabase signOut() already handles token removal.
        setUserProfile(null);
        setLoading(false); 
      } else if (session?.user) {
        await loadProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // --- 2. LOAD PROFILE (READ) ---
  const loadProfile = async (user) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileError.message);
      }

      const { data: inventoryData, error: invError } = await supabase
        .from('inventory')
        .select('card_id')
        .eq('user_id', user.id);

      if (invError) console.warn("Inventory fetch warning:", invError.message);

      if (profileData) {
        setUserProfile({
          ...profileData,
          email: user.email,
          inventory: inventoryData ? inventoryData.map(i => i.card_id) : []
        });
      } else {
        setUserProfile({ 
          id: user.id, 
          email: user.email, 
          club_name: null 
        });
      }
    } catch (error) {
      console.error('CRITICAL: Load Profile Failed', error);
    } finally {
      setLoading(false);
    }
  };

  // --- 3. CREATE PROFILE (WRITE) ---
  const createProfile = async (managerName) => {
    if (!userProfile?.id) return;

    const newProfile = {
      id: userProfile.id,
      name: managerName,
      club_name: `${managerName}'s FC`,
      coins: 500,
      energy: 3,
      max_energy: 5,
      updated_at: new Date()
    };

    try {
      const { error } = await supabase.from('profiles').insert([newProfile]);
      if (error) throw error;

      const starterCards = ['c_match_result', 'c_total_goals', 'c_player_score'];
      await updateInventory(starterCards);

      setUserProfile(prev => ({
        ...prev,
        ...newProfile,
        inventory: starterCards
      }));

    } catch (error) {
      console.error('Error creating profile:', error.message);
    }
  };

  // --- 4. GAME ACTIONS ---
  const spendEnergy = async (amount) => {
    if (!userProfile) return;
    
    const newEnergy = Math.max(0, userProfile.energy - amount);
    
    setUserProfile(prev => ({ ...prev, energy: newEnergy }));

    const { error } = await supabase
      .from('profiles')
      .update({ energy: newEnergy })
      .eq('id', userProfile.id);

    if (error) console.error('Energy Sync Failed:', error);
  };

  const updateInventory = async (newCardIds) => {
    if (!userProfile?.id) return;

    const rows = newCardIds.map(cid => ({
      user_id: userProfile.id,
      card_id: cid
    }));

    const { error } = await supabase.from('inventory').insert(rows);
    
    if (error) {
      console.error('Inventory Sync Failed:', error.message);
    } else {
      setUserProfile(prev => ({
        ...prev,
        inventory: [...(prev.inventory || []), ...newCardIds]
      }));
    }
  };

  const value = {
    userProfile,
    loading,
    createProfile,
    spendEnergy,
    updateInventory
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};
export default GameProvider;