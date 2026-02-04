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

  /**
   * PLACE BET
   * Updated to identify and save the team_name to the database for data integrity.
   */
  const placeBet = async (match, selection, potentialReward, cardType, odds) => {
    if (!userProfile) return { success: false, error: 'No user' };

    try {
      const homeTeam = match.teams.home.name;
      const awayTeam = match.teams.away.name;
      const matchTitle = `${homeTeam} vs ${awayTeam}`;

      // STEP 1 FIX: Determine team_name for database record
      let teamName = null;
      if (selection === 'HOME_WIN') teamName = homeTeam;
      else if (selection === 'AWAY_WIN') teamName = awayTeam;
      else if (selection === 'DRAW') teamName = 'Draw';
      // For scorers, the name is usually part of the selection string or handled via MatchDetail

      const { data, error } = await supabase
        .from('predictions')
        .insert([
          {
            user_id: userProfile.id,
            match_id: match.fixture.id,
            selection: selection,
            team_name: teamName, // Now saved to DB instead of null
            potential_reward: potentialReward,
            card_type: cardType,
            status: 'PENDING',
            match_title: matchTitle,
            odds: odds
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

  const consumeCard = async (cardId) => {
    if (!userProfile) return false;
    const currentInv = Array.isArray(userProfile.inventory) ? [...userProfile.inventory] : [];
    const cardIndex = currentInv.indexOf(cardId);
    if (cardIndex === -1) return false;
    currentInv.splice(cardIndex, 1);
    setUserProfile(prev => ({ ...prev, inventory: currentInv }));

    const { error } = await supabase
      .from('profiles')
      .update({ inventory: currentInv })
      .eq('id', userProfile.id);

    return !error;
  };

  const updateInventory = async (newCardIds) => {
    if (!userProfile?.id) return;
    const currentInv = Array.isArray(userProfile.inventory) ? userProfile.inventory : [];
    const updatedInv = [...currentInv, ...newCardIds];
    setUserProfile(prev => ({ ...prev, inventory: updatedInv }));
    await supabase.from('profiles').update({ inventory: updatedInv }).eq('id', userProfile.id);
  };

  const spendEnergy = async (amount) => {
    if (!userProfile) return;
    const newEnergy = Math.max(0, userProfile.energy - amount);
    setUserProfile(prev => ({ ...prev, energy: newEnergy }));
    await supabase.from('profiles').update({ energy: newEnergy }).eq('id', userProfile.id);
  };

  const checkActiveBets = async () => { console.log("Checking active bets..."); };

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
    userProfile, loading, supabase, placeBet, consumeCard,
    spendEnergy, updateInventory, checkActiveBets, loadProfile
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};