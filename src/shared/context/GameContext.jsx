import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';

const GameContext = createContext();

export const useGame = () => useContext(GameContext);

export const GameProvider = ({ children }) => {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statDictionary, setStatDictionary] = useState(null);
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

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (activeRequestId.current !== myRequestId) return;
      if (profileError) throw profileError;

      const { data: invData, error: invError } = await supabase
        .from('inventory')
        .select('card_id, count')
        .eq('user_id', session.user.id);

      if (invError) throw invError;

      const inventoryMap = {};
      invData?.forEach(row => {
        inventoryMap[row.card_id] = row.count;
      });

      setUserProfile({ ...profile, inventoryMap });

    } catch (error) {
      if (activeRequestId.current !== myRequestId) return;
      console.error('🔥 CONNECTION FAILURE:', error.message);
    } finally {
      if (activeRequestId.current === myRequestId) setLoading(false);
    }
  };

  const consumeCard = async (cardId) => {
    if (!userProfile) return false;
    const currentCount = userProfile.inventoryMap?.[cardId] || 0;
    if (currentCount <= 0) return false;

    const { error } = await supabase
      .from('inventory')
      .update({ count: currentCount - 1 })
      .eq('user_id', userProfile.id)
      .eq('card_id', cardId);

    if (error) {
      console.error("Card consumption failed:", error.message);
      return false;
    }

    setUserProfile(prev => ({
      ...prev,
      inventoryMap: { ...prev.inventoryMap, [cardId]: currentCount - 1 }
    }));
    return true;
  };

  const updateInventory = async (newCardIds) => {
    if (!userProfile?.id || !newCardIds.length) return;

    const additions = {};
    newCardIds.forEach(id => { additions[id] = (additions[id] || 0) + 1; });
    const newMap = { ...userProfile.inventoryMap };

    for (const [cardId, amount] of Object.entries(additions)) {
      const currentCount = newMap[cardId] || 0;

      const { error } = await supabase
        .from('inventory')
        .upsert({
          user_id: userProfile.id,
          card_id: cardId,
          count: currentCount + amount
        }, { onConflict: 'user_id,card_id' });

      if (!error) newMap[cardId] = currentCount + amount;
    }

    setUserProfile(prev => ({ ...prev, inventoryMap: newMap }));
  };

  /**
   * PLACE BET
   * - displayLabel: human-readable label ("Over 2.5 Goals", player name, etc.)
   * - teamId: required for Supersub cards — the integer team ID the user is backing.
   *   Pass match.teams.home.id or match.teams.away.id at the call site.
   *   Without this, the backend settlement engine will always settle Supersub as LOST.
   */
  const placeBet = async (match, selection, potentialReward, cardType, odds, displayLabel, teamId = null) => {
    if (!userProfile) return { success: false, error: 'No user' };
    try {
      const homeTeam = match.teams?.home?.name || match.home_team || 'Home';
      const awayTeam = match.teams?.away?.name || match.away_team || 'Away';
      const matchId = match.fixture?.id || match.id;

      // Supersub requires team_id (integer) for backend settlement.
      // Derive it from match data if not explicitly passed.
      const isSupersub = String(cardType).toLowerCase().includes('supersub');

      let resolvedTeamId = teamId;
      if (!resolvedTeamId) {
        // Derive Team ID for Supersub
        if (isSupersub) {
          if (selection === 'HOME' || String(selection).toUpperCase().includes('HOME')) {
            resolvedTeamId = match.teams?.home?.id ?? match.home_team_id ?? null;
          } else if (selection === 'AWAY' || String(selection).toUpperCase().includes('AWAY')) {
            resolvedTeamId = match.teams?.away?.id ?? match.away_team_id ?? null;
          }
        }
        // Derive Team ID for Match Result
        else if (cardType === 'c_match_result') {
          if (selection === 'HOME_WIN') {
            resolvedTeamId = match.teams?.home?.id ?? match.home_team_id ?? null;
          } else if (selection === 'AWAY_WIN') {
            resolvedTeamId = match.teams?.away?.id ?? match.away_team_id ?? null;
          }
          // Note: If selection is 'DRAW', resolvedTeamId safely remains null.
        }
      }

      // Enforce: Supersub selection must be exactly 'HOME' or 'AWAY'
      let resolvedSelection = selection;
      if (isSupersub) {
        if (String(selection).toUpperCase().includes('HOME')) resolvedSelection = 'HOME';
        else if (String(selection).toUpperCase().includes('AWAY')) resolvedSelection = 'AWAY';
      }

      // Extract Player ID from Player Score selections (e.g., "SCORE_12345")
      let resolvedPlayerId = null;
      if (cardType === 'c_player_score' && String(resolvedSelection).startsWith('SCORE_')) {
        const parts = String(resolvedSelection).split('_');
        resolvedPlayerId = parts.length > 1 ? Number(parts[1]) : null;
      }

      const payload = {
        user_id: userProfile.id,
        match_id: matchId,
        selection: resolvedSelection,
        team_name: displayLabel,
        potential_reward: potentialReward,
        card_type: cardType,
        status: 'PENDING',
        match_title: `${homeTeam} vs ${awayTeam}`,
        odds,
        stake: 100,
        // Always include team_id in the payload.
        // Non-Supersub cards send null — backend ignores it for those card types.
        team_id: resolvedTeamId,
        player_id: resolvedPlayerId,
      };

      const { data, error } = await supabase
        .from('predictions')
        .insert([payload])
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const spendEnergy = async (amount) => {
    if (!userProfile) return;
    const newEnergy = Math.max(0, userProfile.energy - amount);
    setUserProfile(prev => ({ ...prev, energy: newEnergy }));
    await supabase.from('profiles').update({ energy: newEnergy }).eq('id', userProfile.id);
  };

  /**
   * GAIN ENERGY
   * Increments the user's energy by `amount`, capped at max_energy.
   * Used by: ad reward flow (Training), energy drink flow (Dashboard/ViewFridge).
   */
  const gainEnergy = async (amount) => {
    if (!userProfile) return;
    const maxEnergy = userProfile.max_energy || 5;
    const newEnergy = Math.min(userProfile.energy + amount, maxEnergy);
    setUserProfile(prev => ({ ...prev, energy: newEnergy }));
    await supabase.from('profiles').update({ energy: newEnergy }).eq('id', userProfile.id);
  };

  /**
   * CREATE PROFILE
   * Called once during onboarding after the user signs the manager contract.
   * Inserts the initial profile row and seeds the signing-bonus values.
   * On success, updates userProfile in context so Onboarding switches to the
   * "Welcome Aboard" screen immediately without a page reload.
   */
  const createProfile = async (clubName) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('createProfile: no authenticated user', authError?.message);
      return { success: false, error: authError?.message || 'No authenticated user' };
    }

    const profileData = {
      id: user.id,
      club_name: clubName,
      points: 500,      // signing bonus
      energy: 3,        // signing bonus
      max_energy: 5,
      ads_watched: 0,
    };

    // Upsert instead of insert so re-submitting the onboarding form (e.g. after
    // a partial failure or page refresh) doesn't crash with a duplicate-key 409.
    // ignoreDuplicates:false means existing rows are updated, preserving idempotency.
    const { data, error } = await supabase
      .from('profiles')
      .upsert([profileData], { onConflict: 'id', ignoreDuplicates: false })
      .select()
      .single();

    if (error) {
      console.error('createProfile: upsert failed', error.message);
      return { success: false, error: error.message };
    }

    // Immediately reflect in context so Onboarding re-renders to the bonus screen.
    setUserProfile({ ...data, inventoryMap: {} });
    return { success: true, data };
  };
  // GLOBAL APP STATE: Load the Sportmonks Dictionary immediately on mount
  useEffect(() => {
    const fetchGlobalDictionary = async () => {
      try {
        const { data, error } = await supabase
          .from('reference_cache')
          .select('value')
          .like('key', 'type:%');

        if (!error && data) {
          const dict = {};
          data.forEach(row => {
            const val = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
            dict[val.id] = val;
          });
          setStatDictionary(dict);
        }
      } catch (err) {
        console.error("Failed to load stat dictionary:", err);
      }
    };
    fetchGlobalDictionary();
  }, []);
  useEffect(() => {
    let mounted = true;
    async function initSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted && session) await loadProfile(session);
      else if (mounted) setLoading(false);
    }
    initSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) { activeRequestId.current += 1; loadProfile(session); }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const value = { userProfile, loading, statDictionary, supabase, placeBet, consumeCard, spendEnergy, gainEnergy, updateInventory, loadProfile, createProfile };
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};