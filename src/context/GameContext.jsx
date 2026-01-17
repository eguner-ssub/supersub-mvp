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
  // Moved OUTSIDE useEffect so it can be exported
  const checkActiveBets = async () => {
    if (!userProfile?.id) return;

    try {
      // 1. Fetch active bets (PENDING or LIVE)
      const { data: bets, error } = await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', userProfile.id)
        .in('status', ['PENDING', 'LIVE']);

      if (error || !bets || bets.length === 0) return;

      for (const bet of bets) {

        // SCENARIO A: Kickoff (PENDING -> LIVE)
        if (bet.status === 'PENDING') {
          // In a real app, we check match time. Here, we assume instant kickoff.
          console.log(`⚽ Kickoff for bet ${bet.id}`);
          await supabase
            .from('predictions')
            .update({ status: 'LIVE', created_at: new Date().toISOString() }) // Reset timer
            .eq('id', bet.id);
        }

        // SCENARIO B: Settlement (LIVE -> WON)
        else if (bet.status === 'LIVE') {
          // Check if 30 seconds have passed since creation/update
          const betTime = new Date(bet.created_at).getTime();
          const now = new Date().getTime();
          const timeAlive = now - betTime;

          // If > 30 seconds, simulate a WIN
          if (timeAlive > 30000) {
            console.log(`🏆 Match Finished! Settle WIN for ${bet.id}`);

            // Call the Database Function (RPC) to handle money safely
            const { data, error: rpcError } = await supabase.rpc('settle_prediction', {
              prediction_id: bet.id,
              new_status: 'WON'
            });

            if (rpcError) {
              console.error("Settlement Error:", rpcError);
            } else {
              // Reload profile to see new coin balance
              const { data: { session } } = await supabase.auth.getSession();
              if (session) loadProfile(session);
            }
          }
        }
      }
    } catch (err) {
      console.error("⚠️ Settlement Engine Stalled:", err);
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

  const value = {
    userProfile,
    loading,
    supabase,
    createProfile,
    spendEnergy,
    updateInventory,
    checkActiveBets, // <--- NOW CORRECTLY DEFINED
    loadProfile
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};