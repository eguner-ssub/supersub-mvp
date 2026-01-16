import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

const GameContext = createContext();

export const useGame = () => useContext(GameContext);

export const GameProvider = ({ children }) => {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // TRACKING REF: This is the "Ticket Number" for the current request.
  // If a request finishes and its ticket doesn't match this, we ignore it.
  const activeRequestId = useRef(0);

  // --- HELPER: Fetch with Retry & Timeout ---
  const fetchProfileSafely = async (userId, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        // 1. Timeout Promise (7s)
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("DB_TIMEOUT")), 7000)
        );

        // 2. DB Promise
        const dbPromise = supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        // 3. Race
        const { data, error } = await Promise.race([dbPromise, timeoutPromise]);

        if (error) throw error;
        return data; 

      } catch (err) {
        console.warn(`⚠️ Attempt ${i + 1} Failed: ${err.message}`);
        if (i === retries - 1) throw err;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  };

  // --- 1. CORE LOAD LOGIC ---
  const loadProfile = async (user) => {
    // GENERATE NEW TICKET
    const myRequestId = Date.now();
    activeRequestId.current = myRequestId;

    console.log(`📂 LOADING PROFILE (ReqID: ${myRequestId}) FOR:`, user.email);
    
    try {
      const profileData = await fetchProfileSafely(user.id);

      // ZOMBIE CHECK 1: If a newer request started while we were waiting, STOP.
      if (activeRequestId.current !== myRequestId) {
          console.log(`✋ Request ${myRequestId} aborted (Stale).`);
          return;
      }

      let inventoryData = [];
      if (profileData) {
        const { data } = await supabase.from('inventory').select('card_id').eq('user_id', user.id);
        inventoryData = data || [];
      }

      if (profileData) {
        console.log("✅ PROFILE LOADED:", profileData.club_name);
        setUserProfile({
          ...profileData,
          email: user.email,
          inventory: inventoryData.map(i => i.card_id)
        });
      } else {
        console.log("🆕 NEW USER DETECTED");
        setUserProfile({ id: user.id, email: user.email, club_name: null });
      }
    // ... inside loadProfile function ...
  } catch (error) {
    // ZOMBIE CHECK 2
    if (activeRequestId.current !== myRequestId) return;

    console.error('🔥 CONNECTION FAILURE:', error.message);
    
    // FIX: DO NOT LOG OUT. JUST STOP LOADING.
    // We assume the user is still valid, just disconnected.
    // This prevents the "Kick to Login" loop.
    console.warn("⚠️ Database is slow/unreachable. Staying logged in but in 'Offline Mode'.");
    
    // Optionally set a flag here like setConnectionError(true) if you want to show a specific UI
    
  } finally {
    if (activeRequestId.current === myRequestId) {
      setLoading(false);
    }
  }
  };

  // --- 2. AUTH LISTENER ---
  useEffect(() => {
    console.log("⚡ INIT: Starting Auth Listener...");
    
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn("🛑 DEADMAN SWITCH: Forcing app load.");
        setLoading(false);
      }
    }, 12000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`🔔 AUTH EVENT: ${event}`);

      if (event === 'SIGNED_OUT') {
        setUserProfile(null);
        setLoading(false);
        activeRequestId.current = 0; // Clear active requests
        localStorage.removeItem('sb-access-token');
      } else if (session?.user) {
        // ALWAYS LOAD on Signed In, effectively cancelling any previous hangs
        if (userProfile?.id !== session.user.id) {
            await loadProfile(session.user);
        } else {
            setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  // --- 3. WRITE ACTIONS ---
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
    updateInventory
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};

export default GameProvider;