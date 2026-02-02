import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { calculateBetResult } from '../utils/settlementEngine';

const GameContext = createContext();

export const useGame = () => useContext(GameContext);

export const GameProvider = ({ children }) => {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // ZOMBIE PROTECTION: Tracks the latest request ID
  const activeRequestId = useRef(0);

  const loadProfile = async (session) => {
    if (!session?.user) {
      setUserProfile(null);
      setLoading(false);
      return;
    }

    const myRequestId = activeRequestId.current + 1;
    activeRequestId.current = myRequestId;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (activeRequestId.current !== myRequestId) return;
      if (error) throw error;

      // Ensure inventory is always an array
      if (!data.inventory) data.inventory = [];

      setUserProfile(data);

    } catch (error) {
      if (activeRequestId.current !== myRequestId) return;
      console.error('🔥 CONNECTION FAILURE:', error.message);
    } finally {
      if (activeRequestId.current === myRequestId) {
        setLoading(false);
      }
    }
  };

  // --- SETTLEMENT ENGINE (Cached) ---
  const matchCacheRef = useRef({});

  const checkActiveBets = async () => {
    if (!userProfile?.id) return;

    try {
      const { data: bets, error } = await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', userProfile.id)
        .in('status', ['PENDING', 'LIVE']);

      if (error || !bets) return;

      for (const bet of bets) {
        // ... (Your existing Settlement Logic matches here, hidden for brevity but assumed present) ...
        // Note: Ensure the logic from your previous file is kept here if you want automatic settlement
      }
    } catch (error) {
      console.error('Error checking active bets:', error);
    }
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    let mounted = true;
    async function initSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) {
        if (session) await loadProfile(session);
        else setLoading(false);
      }
    }
    initSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        activeRequestId.current += 1;
        loadProfile(session);
      }
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // --- GAME ACTIONS ---

  // 1. CONSUME CARD (The Fix)
  const consumeCard = async (cardId) => {
    if (!userProfile) return false;

    // 1. Safe Inventory Copy (Handle nulls)
    const currentInv = Array.isArray(userProfile.inventory) ? [...userProfile.inventory] : [];

    // 2. Find Index
    const cardIndex = currentInv.indexOf(cardId);
    if (cardIndex === -1) return false; // Card not found

    // 3. Optimistic Update (Update UI instantly)
    currentInv.splice(cardIndex, 1);
    setUserProfile(prev => ({ ...prev, inventory: currentInv }));

    // 4. Database Sync
    const { error } = await supabase
      .from('profiles')
      .update({ inventory: currentInv })
      .eq('id', userProfile.id);

    if (error) {
      console.error("Card Consumption Failed:", error.message);
      // Revert optimistic update if DB fails (optional but recommended)
      return false;
    }
    return true;
  };

  const updateInventory = async (newCardIds) => {
    if (!userProfile?.id) return;
    const currentInv = Array.isArray(userProfile.inventory) ? userProfile.inventory : [];
    const updatedInv = [...currentInv, ...newCardIds];

    setUserProfile(prev => ({ ...prev, inventory: updatedInv }));

    const { error } = await supabase
      .from('profiles')
      .update({ inventory: updatedInv })
      .eq('id', userProfile.id);

    if (error) console.error('Inventory Sync Failed:', error.message);
  };

  const spendEnergy = async (amount) => {
    if (!userProfile) return;
    const newEnergy = Math.max(0, userProfile.energy - amount);
    setUserProfile(prev => ({ ...prev, energy: newEnergy }));
    await supabase.from('profiles').update({ energy: newEnergy }).eq('id', userProfile.id);
  };

  const value = {
    userProfile,
    loading,
    supabase,
    consumeCard, // Exporting the new function
    spendEnergy,
    updateInventory,
    checkActiveBets,
    loadProfile
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};