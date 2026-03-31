import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';

const GameContext = createContext();

export const useGame = () => useContext(GameContext);

export const GameProvider = ({ children }) => {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statDictionary, setStatDictionary] = useState(null);
  // Settled predictions the user hasn't seen yet — drives WinCelebrationModal on Dashboard
  const [unseenSettlements, setUnseenSettlements] = useState([]);
  const activeRequestId = useRef(0);
  const realtimeChannelRef = useRef(null);

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

      // Check for unseen settled predictions (drives WinCelebrationModal on Dashboard).
      // Gracefully no-ops if migration 034 hasn't been applied yet (column missing → error → []).
      const { data: unseen, error: unseenError } = await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('seen_by_user', false)
        .eq('status', 'SETTLED')
        .order('created_at', { ascending: false })
        .limit(5);

      if (activeRequestId.current !== myRequestId) return;
      setUnseenSettlements(unseenError ? [] : (unseen ?? []));

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

  /**
   * MARK PREDICTIONS SEEN
   * Called when WinCelebrationModal is dismissed.
   * Sets seen_by_user = true in the DB and removes the rows from local state
   * so the modal doesn't re-appear. Requires migration 034.
   */
  const markPredictionsSeen = async (ids) => {
    if (!ids?.length) return;
    await supabase
      .from('predictions')
      .update({ seen_by_user: true })
      .in('id', ids);
    setUnseenSettlements(prev => prev.filter(p => !ids.includes(p.id)));
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
  const placeBet = async (match, selection, potentialReward, cardType, odds, displayLabel, teamId = null, oddsSnapshot = null, playerId = null) => {
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
      // Also carry through player_id for player-specific supersub bets
      let resolvedPlayerId = playerId ?? null;
      if (!resolvedPlayerId && cardType === 'c_player_score' && String(resolvedSelection).startsWith('SCORE_')) {
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
        league_id: match.league_id ?? null,
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
   * Used by: energy drink flow (Dashboard/ViewFridge).
   * NOT used for ad rewards — see claimAdReward() below.
   */
  const gainEnergy = async (amount) => {
    if (!userProfile) return;
    const maxEnergy = userProfile.max_energy || 5;
    const newEnergy = Math.min(userProfile.energy + amount, maxEnergy);
    setUserProfile(prev => ({ ...prev, energy: newEnergy }));
    await supabase.from('profiles').update({ energy: newEnergy }).eq('id', userProfile.id);
  };

  /**
   * CLAIM AD REWARD
   * Called after the user watches a rewarded ad and taps "Claim Reward".
   * Calls the watch_ad_reward() RPC which atomically:
   *   - Sets energy = max_energy (full refill)
   *   - Increments ads_watched counter
   * Reflects the server response back into local state.
   *
   * Client-side frequency guard: blocks claims within AD_COOLDOWN_MS of the
   * last successful claim (stored in localStorage). This is a UX guard only —
   * the RPC itself is the authoritative enforcement layer.
   */
  const AD_COOLDOWN_MS = 60_000; // 60 seconds between ad claims

  const claimAdReward = async () => {
    if (!userProfile) return;

    // Client-side frequency cap
    const lastClaim = parseInt(localStorage.getItem('last_ad_claim_at') || '0', 10);
    if (Date.now() - lastClaim < AD_COOLDOWN_MS) {
      const remaining = Math.ceil((AD_COOLDOWN_MS - (Date.now() - lastClaim)) / 1000);
      throw new Error(`Please wait ${remaining}s before watching another ad.`);
    }

    const { data, error } = await supabase.rpc('watch_ad_reward', { p_user_id: userProfile.id });

    if (error) {
      console.error('claimAdReward: RPC failed', error.message);
      throw new Error(error.message);
    }

    // RPC returns a single-row table: { new_energy, ads_watched }
    const result = Array.isArray(data) ? data[0] : data;
    if (result) {
      setUserProfile(prev => prev ? {
        ...prev,
        energy: result.new_energy,
        ads_watched: result.ads_watched,
      } : prev);
    }

    localStorage.setItem('last_ad_claim_at', String(Date.now()));
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
      onboarding_complete: false,
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
  // Auth init — loads profile on mount and on auth state changes
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

  // Realtime subscriptions — fires whenever the logged-in user changes
  useEffect(() => {
    if (!userProfile?.id) return;

    const cleanupChannel = async () => {
      if (realtimeChannelRef.current) {
        const old = realtimeChannelRef.current;
        realtimeChannelRef.current = null;
        await supabase.removeChannel(old);
      }
    };

    const initRealtime = async () => {
      await cleanupChannel();

      const channel = supabase
        .channel(`user-data-${userProfile.id}`)
        // Profile row changes (points, energy, coins, etc.)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userProfile.id}` },
          (payload) => {
            setUserProfile(prev => prev ? { ...prev, ...payload.new } : prev);
          }
        )
        // Inventory row changes (card counts — manual edits, settlement, rewards)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'inventory', filter: `user_id=eq.${userProfile.id}` },
          (payload) => {
            if (payload.eventType === 'DELETE') {
              setUserProfile(prev => {
                if (!prev) return prev;
                const newMap = { ...prev.inventoryMap };
                delete newMap[payload.old.card_id];
                return { ...prev, inventoryMap: newMap };
              });
            } else {
              const { card_id, count } = payload.new;
              setUserProfile(prev => prev ? {
                ...prev,
                inventoryMap: { ...prev.inventoryMap, [card_id]: count },
              } : prev);
            }
          }
        )
        .subscribe((status) => {
          console.log(`📡 [Realtime] user-data channel: ${status}`);
        });

      realtimeChannelRef.current = channel;
    };

    initRealtime();

    return () => {
      setTimeout(() => {
        if (realtimeChannelRef.current) supabase.removeChannel(realtimeChannelRef.current);
      }, 100);
    };
  }, [userProfile?.id]);

  const value = { userProfile, loading, statDictionary, supabase, placeBet, consumeCard, spendEnergy, gainEnergy, claimAdReward, updateInventory, loadProfile, createProfile, unseenSettlements, markPredictionsSeen };
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};