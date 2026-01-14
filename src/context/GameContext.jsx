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

    // A. DEADMAN'S SWITCH: Force loading to stop after 4 seconds
    // This guarantees the app never gets "stuck" infinitely.
    const safetyTimeout = setTimeout(() => {
      if (loading && mounted) {
        console.warn("⚠️ DATABASE TIMEOUT: Forcing application load.");
        setLoading(false);
      }
    }, 4000);

    const initSession = async () => {
      console.log("⚡ INIT: Starting Session Check...");
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          console.log("✅ USER FOUND:", session.user.id);
          if (mounted) await loadProfile(session.user);
        } else {
          console.log("❌ NO USER SESSION");
          if (mounted) setLoading(false);
        }
      } catch (err) {
        console.error("💀 FATAL SESSION ERROR:", err);
        if (mounted) setLoading(false);
      }
    };

    initSession();

    // B. AUTH LISTENER
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`🔔 AUTH EVENT: ${event}`);

      if (event === 'SIGNED_OUT') {
        setUserProfile(null);
        setLoading(false);
        localStorage.clear(); 
      } else if (session?.user) {
        await loadProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout); // Clean up the timer
      subscription.unsubscribe();
    };
  }, []);

  // --- 2. LOAD PROFILE (READ) ---
  const loadProfile = async (user) => {
    console.log("📂 LOADING PROFILE FOR:", user.email);
    try {
      // Fetch Core Profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle(); // Changed from single() to maybeSingle() to prevent error throwing on new users

      if (profileError) {
        console.error('⚠️ PROFILE FETCH ERROR:', profileError.message);
      }

      // Fetch Inventory
      const { data: inventoryData } = await supabase
        .from('inventory')
        .select('card_id')
        .eq('user_id', user.id);

      if (profileData) {
        console.log("✅ PROFILE LOADED:", profileData.club_name);
        setUserProfile({
          ...profileData,
          email: user.email,
          inventory: inventoryData ? inventoryData.map(i => i.card_id) : []
        });
      } else {
        console.log("🆕 NEW USER DETECTED (No Profile DB Row)");
        // THIS IS CRITICAL: We must set userProfile even if DB row is missing
        // so App.jsx doesn't kick us out, but sends us to Onboarding instead.
        setUserProfile({ 
          id: user.id, 
          email: user.email, 
          club_name: null 
        });
      }
    } catch (error) {
      console.error('🔥 CRITICAL PROFILE FAILURE:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- 3. CREATE PROFILE (WRITE) ---
  const createProfile = async (managerName) => {
    if (!userProfile?.id) return;
    console.log("✍️ CREATING PROFILE:", managerName);

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
      // FIX IS HERE: Change .insert() to .upsert()
      const { error } = await supabase.from('profiles').upsert([newProfile]);
      
      if (error) {
        console.error("Database Error:", error.message);
        throw error;
      }

      // 2. Insert Starter Inventory
      const starterCards = ['c_match_result', 'c_total_goals', 'c_player_score'];
      await updateInventory(starterCards);

      // 3. Update Local State (This triggers the Onboarding screen to switch)
      setUserProfile(prev => ({
        ...prev,
        ...newProfile
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
    await supabase.from('profiles').update({ energy: newEnergy }).eq('id', userProfile.id);
  };

  const updateInventory = async (newCardIds) => {
    if (!userProfile?.id) return;
    const rows = newCardIds.map(cid => ({ user_id: userProfile.id, card_id: cid }));
    
    // Optimistic update
    setUserProfile(prev => ({
      ...prev,
      inventory: [...(prev.inventory || []), ...newCardIds]
    }));

    const { error } = await supabase.from('inventory').insert(rows);
    if (error) console.error('Inventory Sync Failed:', error.message);
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