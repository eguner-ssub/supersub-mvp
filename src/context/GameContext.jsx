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
      setLoading(true); // Ensure loading is true while we fetch

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      // ZOMBIE CHECK 1: If a newer request started, ignore this result
      if (activeRequestId.current !== myRequestId) return;

      if (error) throw error;

      setUserProfile(data);

    } catch (error) {
      // ZOMBIE CHECK 2
      if (activeRequestId.current !== myRequestId) return;

      console.error('🔥 CONNECTION FAILURE:', error.message);

      // --- THE CRITICAL FIX ---
      // WE REMOVED THE "signOut()" CALL HERE.
      // If the DB fails, we just log the error and stop loading.
      // The user remains "Authenticated" but with "No Profile Data" (Offline Mode).
      console.warn("⚠️ Database is slow/unreachable. Staying logged in.");

    } finally {
      // Final Zombie Check: Only turn off loading if this was the latest request
      if (activeRequestId.current === myRequestId) {
        setLoading(false);
      }
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
        // Reset ID on auth change to kill old requests
        activeRequestId.current += 1;
        loadProfile(session);
      }
    });

    // Settlement Logic: Auto-transition bets through lifecycle
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
          if (bet.status === 'PENDING') {
            // Simulate kickoff - move to LIVE immediately
            await supabase
              .from('predictions')
              .update({ status: 'LIVE', updated_at: new Date().toISOString() })
              .eq('id', bet.id);

            console.log(`✅ Bet ${bet.id} moved to LIVE`);

          } else if (bet.status === 'LIVE') {
            // Check if 30 seconds have passed since it went LIVE
            const liveTime = new Date() - new Date(bet.updated_at);

            if (liveTime > 30000) { // 30 seconds
              // Simulate win - call settlement RPC
              const { data, error: rpcError } = await supabase.rpc('settle_prediction', {
                p_prediction_id: bet.id,
                p_new_status: 'WON'
              });

              if (!rpcError && data && data.length > 0) {
                console.log(`🎉 Bet ${bet.id} WON! New coins: ${data[0].new_coins}`);
                // Reload profile to update coins
                const session = await supabase.auth.getSession();
                if (session.data.session) {
                  loadProfile(session.data.session);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error checking active bets:', error);
      }
    };

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
    setUserProfile(prev => ({ ...prev, inventory: [...(prev.inventory || []), ...newCardIds] }));
    const rows = newCardIds.map(cid => ({ user_id: userProfile.id, card_id: cid }));
    const { error } = await supabase.from('inventory').insert(rows);
    if (error) console.error('Inventory Sync Failed:', error.message);
  };

  const value = {
    userProfile,
    loading,
    supabase,
    createProfile,
    spendEnergy,
    updateInventory,
    checkActiveBets,
    loadProfile
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};