import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

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

    // Generate a new ID for this specific request
    const myRequestId = activeRequestId.current + 1;
    activeRequestId.current = myRequestId;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      // ZOMBIE CHECK 1
      if (activeRequestId.current !== myRequestId) return;

      if (error) throw error;

      setUserProfile(data);

    } catch (error) {
      // ZOMBIE CHECK 2
      if (activeRequestId.current !== myRequestId) return;
      console.error('🔥 CONNECTION FAILURE:', error.message);
      console.warn("⚠️ Database is slow/unreachable. Staying logged in.");

    } finally {
      if (activeRequestId.current === myRequestId) {
        setLoading(false);
      }
    }
  };

  // --- LAZY SETTLEMENT ENGINE ---

  // Helper: Determine bet outcome based on real match result
  const determineOutcome = (bet, matchData) => {
    const homeGoals = matchData.goals?.home || 0;
    const awayGoals = matchData.goals?.away || 0;

    if (bet.selection === 'HOME_WIN') {
      return homeGoals > awayGoals ? 'WON' : 'LOST';
    } else if (bet.selection === 'AWAY_WIN') {
      return awayGoals > homeGoals ? 'WON' : 'LOST';
    } else if (bet.selection === 'DRAW') {
      return homeGoals === awayGoals ? 'WON' : 'LOST';
    }

    // Default to LOST if selection is unknown
    return 'LOST';
  };

  // Settlement Logic: Real API-based transitions
  const checkActiveBets = async () => {
    if (!userProfile?.id) return;

    try {
      // Fetch active bets (PENDING or LIVE)
      const { data: bets, error } = await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', userProfile.id)
        .in('status', ['PENDING', 'LIVE']);

      if (error || !bets) return;

      for (const bet of bets) {
        try {
          // Fetch real match data from API
          const response = await fetch(`/api/matches?id=${bet.match_id}`);

          if (!response.ok) {
            console.warn(`Failed to fetch match ${bet.match_id}`);
            continue;
          }

          const data = await response.json();
          const matchData = data.response?.[0];

          if (!matchData) {
            console.warn(`No match data for ${bet.match_id}`);
            continue;
          }

          const matchStatus = matchData.fixture?.status?.short;

          // PENDING -> LIVE: Match has started
          if (bet.status === 'PENDING') {
            // If status is NOT 'NS' (Not Started) and NOT finished
            if (matchStatus && matchStatus !== 'NS' && matchStatus !== 'FT' && matchStatus !== 'AET' && matchStatus !== 'PEN') {
              await supabase
                .from('predictions')
                .update({ status: 'LIVE', updated_at: new Date().toISOString() })
                .eq('id', bet.id);

              console.log(`✅ Bet ${bet.id} moved to LIVE (Match Status: ${matchStatus})`);
            }
          }
          // LIVE -> SETTLED: Match has finished
          else if (bet.status === 'LIVE') {
            // If status is FT (Full Time), AET (After Extra Time), or PEN (Penalties)
            if (matchStatus === 'FT' || matchStatus === 'AET' || matchStatus === 'PEN') {
              const outcome = determineOutcome(bet, matchData);

              // Call settlement RPC
              const { data: settlementData, error: rpcError } = await supabase.rpc('settle_prediction', {
                p_prediction_id: bet.id,
                p_new_status: outcome
              });

              if (!rpcError && settlementData && settlementData.length > 0) {
                console.log(`🎉 Bet ${bet.id} ${outcome}! New coins: ${settlementData[0].new_coins}`);

                // Reload profile to update coins
                const session = await supabase.auth.getSession();
                if (session.data.session) {
                  loadProfile(session.data.session);
                }
              }
            }
          }

          // Rate limiting: 1 second delay between API calls
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (betError) {
          console.error(`Error processing bet ${bet.id}:`, betError);
          // Continue to next bet even if this one fails
        }
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
        if (session) {
          await loadProfile(session);
        } else {
          setLoading(false);
        }
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

  // Heartbeat: Auto-check active bets every 10 seconds
  useEffect(() => {
    if (!userProfile) return;

    // 1. Run immediately on load
    checkActiveBets();

    // 2. Run every 10 seconds
    const interval = setInterval(() => {
      checkActiveBets();
    }, 10000);

    return () => clearInterval(interval);
  }, [userProfile]); // Re-run if profile changes

  // --- GAME ACTIONS ---
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
      const { error } = await supabase.from('profiles').upsert([newProfile]);
      if (error) throw error;
      // Give starter cards
      // Note: Assuming updateInventory is adjusted to handle array logic we fixed earlier
      // For now, simple insert logic:
      await updateInventory(['c_match_result', 'c_total_goals', 'c_player_score']);

      setUserProfile(prev => ({ ...prev, ...newProfile }));
    } catch (error) {
      console.error('Error creating profile:', error.message);
    }
  };

  const spendEnergy = async (amount) => {
    if (!userProfile) return;
    const newEnergy = Math.max(0, userProfile.energy - amount);
    setUserProfile(prev => ({ ...prev, energy: newEnergy }));
    await supabase.from('profiles').update({ energy: newEnergy }).eq('id', userProfile.id);
  };

  const updateInventory = async (newCardIds) => {
    if (!userProfile?.id) return;

    // Optimistic UI Update
    // Assuming inventory is stored as JSONB array in DB based on your previous fixes
    const currentInv = Array.isArray(userProfile.inventory) ? userProfile.inventory : [];
    const updatedInv = [...currentInv, ...newCardIds];

    setUserProfile(prev => ({ ...prev, inventory: updatedInv }));

    // DB Update
    const { error } = await supabase
      .from('profiles')
      .update({ inventory: updatedInv })
      .eq('id', userProfile.id);

    if (error) console.error('Inventory Sync Failed:', error.message);
  };

  const gainEnergy = async (amount) => {
    if (!userProfile) return;

    // Calculate new energy, don't exceed max
    const newEnergy = Math.min(userProfile.max_energy || 5, userProfile.energy + amount);

    // Optimistic Update
    setUserProfile(prev => ({ ...prev, energy: newEnergy }));

    // DB Update
    const { error } = await supabase
      .from('profiles')
      .update({ energy: newEnergy })
      .eq('id', userProfile.id);

    if (error) {
      console.error('Energy update failed:', error);
      throw error;
    }
  };

  const value = {
    userProfile,
    loading,
    supabase,
    createProfile,
    spendEnergy,
    gainEnergy,
    updateInventory,
    checkActiveBets,
    loadProfile
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};