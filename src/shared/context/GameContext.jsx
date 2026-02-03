import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';

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

  // --- GAME ACTIONS ---

  // 1. PLACE BET (Updated to include Odds)
  const placeBet = async (match, selection, potentialReward, cardType, odds) => { // <--- Added 'odds' param
    if (!userProfile) return { success: false, error: 'No user' };

    try {
      // CONSTRUCT THE TITLE 
      // We explicitly format "Home vs Away" here so it is saved permanently.
      const homeTeam = match.teams.home.name;
      const awayTeam = match.teams.away.name;
      const matchTitle = `${homeTeam} vs ${awayTeam}`;

      const { data, error } = await supabase
        .from('predictions')
        .insert([
          {
            user_id: userProfile.id,
            match_id: match.fixture.id,
            selection: selection,
            potential_reward: potentialReward,
            card_type: cardType, // e.g., 'c_match_result'
            status: 'PENDING',
            match_title: matchTitle,
            odds: odds // <--- SAVING ODDS TO DB
          }
        ])
        .select();

      if (error) throw error;
      return { success: true, data };

    } catch (err) {
      console.error("Bet Placement Failed:", err.message);
      return { success: false, error: err.message };
    }
  };

  // 2. CONSUME CARD
  const consumeCard = async (cardId) => {
    if (!userProfile) return false;

    // A. Safe Inventory Copy
    const currentInv = Array.isArray(userProfile.inventory) ? [...userProfile.inventory] : [];

    // B. Find Index
    const cardIndex = currentInv.indexOf(cardId);
    if (cardIndex === -1) return false; // Card not found

    // C. Optimistic Update
    currentInv.splice(cardIndex, 1);
    setUserProfile(prev => ({ ...prev, inventory: currentInv }));

    // D. Database Sync
    const { error } = await supabase
      .from('profiles')
      .update({ inventory: currentInv })
      .eq('id', userProfile.id);

    if (error) {
      console.error("Card Consumption Failed:", error.message);
      return false;
    }
    return true;
  };

  // 3. OTHER ACTIONS
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

  const checkActiveBets = async () => {
    // Placeholder for your settlement engine logic
    console.log("Checking active bets...");
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

  const value = {
    userProfile,
    loading,
    supabase,
    placeBet,    // <--- EXPORTED NEW FUNCTION
    consumeCard,
    spendEnergy,
    updateInventory,
    checkActiveBets,
    loadProfile
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};