import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const GameContext = createContext();

export const GameProvider = ({ children }) => {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- 1. DATA TRANSFORMER ---
  const fetchFullProfile = async (userId) => {
    try {
      // Get Profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      // Get Inventory
      const { data: inventoryData, error: invError } = await supabase
        .from('inventory')
        .select('card_id')
        .eq('user_id', userId);

      if (invError) throw invError;

      const flatInventory = inventoryData.map(item => item.card_id);

      setUserProfile({
        ...profile,
        inventory: flatInventory 
      });

    } catch (err) {
      console.error("Profile Load Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. AUTH LISTENER (THE FIX IS HERE) ---
  useEffect(() => {
    // Check active session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchFullProfile(session.user.id);
      } else {
        // 🔴 CRITICAL FIX:
        // If there is a "hash" in the URL (access_token), it means Supabase is 
        // about to log us in. DO NOT turn off loading yet. Wait for the event below.
        if (!window.location.hash.includes('access_token')) {
           setLoading(false); 
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        // We have a user! Fetch their data.
        await fetchFullProfile(session.user.id);
        
        // Handle New User Creation
        const { data: check } = await supabase.from('profiles').select('id').eq('id', session.user.id).single();
        if (!check) {
          await supabase.from('profiles').insert([{ 
            id: session.user.id,
            email: session.user.email,
            username: session.user.email.split('@')[0],
            energy: 3, 
            max_energy: 3, 
            coins: 100 
          }]);
          await supabase.from('inventory').insert([{ user_id: session.user.id, card_id: 'c_match_result' }]);
          fetchFullProfile(session.user.id);
        }
      } else {
        // Only set loading to false if we are SURE there's no pending auth
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- 3. GAME ACTIONS ---
  const spendEnergy = async (amount) => {
    if (!userProfile || userProfile.energy < amount) return false;
    
    // Optimistic
    const newEnergy = userProfile.energy - amount;
    setUserProfile(prev => ({ ...prev, energy: newEnergy }));

    // DB
    const { error } = await supabase
      .from('profiles')
      .update({ energy: newEnergy })
      .eq('id', userProfile.id);

    if (error) {
      fetchFullProfile(userProfile.id); 
      return false;
    }
    return true;
  };

  const addCard = async (cardId) => {
    if (!userProfile) return;
    
    // Optimistic
    setUserProfile(prev => ({ ...prev, inventory: [...prev.inventory, cardId] }));

    // DB
    const { error } = await supabase
      .from('inventory')
      .insert([{ user_id: userProfile.id, card_id: cardId }]);

    if (error) fetchFullProfile(userProfile.id); 
  };

  const value = {
    userProfile,
    loading,
    spendEnergy,
    addCard,
    supabase
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => useContext(GameContext);
export default GameContext;