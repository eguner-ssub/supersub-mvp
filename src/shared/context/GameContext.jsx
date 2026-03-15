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
      if (isSupersub && !resolvedTeamId) {
        // Attempt to derive from selection ('HOME' or 'AWAY')
        if (selection === 'HOME') {
          resolvedTeamId = match.teams?.home?.id ?? match.home_team_id ?? null;
        } else if (selection === 'AWAY') {
          resolvedTeamId = match.teams?.away?.id ?? match.away_team_id ?? null;
        }
      }

      // Enforce: Supersub selection must be 'HOME' or 'AWAY' (not HOME_WIN etc.)
      // Normalize in case the call site passes a legacy format.
      let resolvedSelection = selection;
      if (isSupersub) {
        if (String(selection).toUpperCase().includes('HOME')) resolvedSelection = 'HOME';
        else if (String(selection).toUpperCase().includes('AWAY')) resolvedSelection = 'AWAY';
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

  const value = { userProfile, loading, statDictionary, supabase, placeBet, consumeCard, spendEnergy, updateInventory, loadProfile };
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};