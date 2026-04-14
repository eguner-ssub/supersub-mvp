import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGame } from '../shared/context/GameContext';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';
import { Zap, Loader2, ShoppingBag, TrendingUp, Cone } from 'lucide-react';
import CardBase from '../shared/ui/CardBase';

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile, updateInventory, loading, bagAvailableToday, unseenSettlements, markPredictionsSeen, pendingDecay, saveStreakWithDrink, declineStreakSave, energyDrinks } = useGame();

  // --- LOCAL STATE ---
  const [showBagOverlay, setShowBagOverlay] = useState(false);
  const [bagStage, setBagStage] = useState('closed');
  const [newCards, setNewCards] = useState([]);
  const [showStreakSaveModal, setShowStreakSaveModal] = useState(false);

  // UX STATE
  const [imageLoaded, setImageLoaded] = useState(false);

  const userData = userProfile;

  // --- 1. INITIALIZATION & SYNC ---
  useEffect(() => {
    if (location.state?.firstLogin) {
      setShowBagOverlay(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  // Silently mark LOST unseen settlements as seen — no modal shown for losses
  useEffect(() => {
    const lostIds = unseenSettlements
      .filter(p => p.settled_status !== 'WON')
      .map(p => p.id);
    if (lostIds.length > 0) markPredictionsSeen(lostIds);
  }, [unseenSettlements]);

  // Show streak save modal when decay is pending (user missed a day but has drinks)
  useEffect(() => {
    if (pendingDecay) setShowStreakSaveModal(true);
  }, [pendingDecay]);



  // --- 2. INTERACTION HANDLERS ---

  const handleWhiteboardClick = () => {
    navigate('/predictions?tab=whiteboard');
  };

  const handleTabletClick = () => {
    navigate('/leaderboard');
  };

  const handleBagClick = () => navigate('/inventory/kit-bag');

  // --- 3. HELPER: Bag Opening Logic ---
  // One representative card per type shown in the reward screen (with ×3 badge)
  // cardBaseType = key for CardBase's asset maps (c_ prefix)
  // inventoryId  = key stored in the inventory table (matches Training.jsx convention)
  const PACK_CARD_TYPES = [
    { cardBaseType: 'c_match_result', inventoryId: 'c_match_result' },
    { cardBaseType: 'c_total_goals',  inventoryId: 'c_total_goals'  },
    { cardBaseType: 'c_player_score', inventoryId: 'c_player_score' },
    { cardBaseType: 'c_supersub',     inventoryId: 'c_supersub'     },
  ];

  const triggerBagOpening = () => {
    setBagStage('opening');
    setTimeout(() => {
      // Show one card of each type in the reward grid
      setNewCards(PACK_CARD_TYPES);
      setBagStage('rewards');

      // Credit 3 of each = 12 cards to inventory
      const allInventoryIds = PACK_CARD_TYPES.flatMap(ct => [ct.inventoryId, ct.inventoryId, ct.inventoryId]);
      (async () => {
        await updateInventory(allInventoryIds);
      })();
    }, 1500);
  };

  const handleCollectRewards = () => {
    setShowBagOverlay(false);
    setBagStage('closed');
    setNewCards([]);

    // Persist welcome as seen (fire-and-forget) + nudge toast
    if (userProfile?.id) {
      void supabase
        .from('profiles')
        .update({ has_seen_welcome: true })
        .eq('id', userProfile.id);
    }

    toast.success('Your starter cards are ready — make your first call.', {
      action: { label: 'Go →', onClick: () => navigate('/match-hub') },
      duration: 6000,
    });
  };

  if (loading) return (
    <div className="bg-black h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-yellow-500" />
    </div>
  );

  return (
    <div className="w-full h-[100dvh] bg-black flex items-center justify-center overflow-hidden font-sans select-none">

      {/* ============================================================ */}
      {/* LAYER 0: THE ROOM (Background) — fills full viewport          */}
      {/* Lives outside the aspect-ratio div to avoid hairline artefacts*/}
      {/* ============================================================ */}
      <img
        src="/assets/bg-dashboard.webp"
        alt=""
        onLoad={() => setImageLoaded(true)}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
      />

      <div className="relative aspect-[9/16] h-full max-h-[100dvh] w-auto overflow-hidden">

        {/* ============================================================ */}
        {/* LAYER 1: INTERACTIVE HOTSPOTS                                */}
        {/* Positions are % of the 9:16 inner container — consistent     */}
        {/* across all screen sizes. Bottom hotspots end at ≤87% to     */}
        {/* stay clear of the NavigationShell nav bar (~bottom 10%).     */}
        {/* ============================================================ */}

        {/* A. WHITEBOARD (Bets) — center back wall */}
        <div
          onClick={handleWhiteboardClick}
          className="absolute top-[28%] left-[23%] w-[57%] h-[20%] z-10 cursor-pointer active:scale-95 transition-transform"
          data-testid="hotspot-whiteboard"
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float">
            <TrendingUp className="w-3.5 h-3.5 text-white" />
          </div>
        </div>

        {/* B. TABLET — left side of bench */}
        <div
          onClick={handleTabletClick}
          className="absolute top-[52%] left-[7%] w-[24%] h-[10%] z-10 cursor-pointer active:scale-95 transition-transform"
          data-testid="hotspot-tablet"
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float">
            <TrendingUp className="w-3.5 h-3.5 text-green-400" />
          </div>
        </div>

        {/* C. ENERGY DRINKS — right side of bench */}
        <div
          onClick={() => navigate('/inventory/energy-drinks')}
          className="absolute top-[54%] left-[68%] w-[28%] h-[10%] z-10 cursor-pointer active:scale-95 transition-transform"
          data-testid="hotspot-drinks"
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float">
            <Zap className={`w-3.5 h-3.5 ${userData.energy === 0 ? 'text-red-500' : 'text-blue-400'}`} />
          </div>

          {userData.energy === 0 && (
            <div className="absolute inset-0 bg-red-500/20 blur-md animate-pulse" />
          )}
        </div>

        {/* D. KITBAG (Inventory/Rewards) — floor center, ends at 87% */}
        <div
          onClick={handleBagClick}
          className="absolute top-[78%] left-[28%] w-[54%] h-[16%] z-20 cursor-pointer rounded-2xl active:scale-95 transition-transform duration-100"
          data-testid="hotspot-inventory"
        >
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float">
            <ShoppingBag className="w-3.5 h-3.5 text-white" />
            {bagAvailableToday && (
              <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
            )}
          </div>
        </div>

        {/* E. CONES (Training) — floor left, ends at 87% */}
        <div
          onClick={() => navigate('/training')}
          className="absolute top-[67%] left-[0%] w-[28%] h-[18%] z-30 cursor-pointer active:scale-95 transition-transform"
          data-testid="hotspot-training"
        >
          <div className="absolute -top-4 left-3 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float">
            <Cone className="w-3.5 h-3.5 text-orange-400" />
          </div>
        </div>


        {/* ============================================================ */}
        {/* LAYER 2: MODALS                                              */}
        {/* (HUD is provided by NavigationShell > GameHeader)           */}
        {/* ============================================================ */}

        {/* BAG / REWARD OVERLAY */}
        {showBagOverlay && (
          <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center p-6 animate-in fade-in">
            {bagStage === 'closed' && (
              <div className="text-center">
                <h2 className="text-3xl font-black text-white mb-8 italic uppercase tracking-wider">Daily Supply</h2>
                <button onClick={triggerBagOpening} className="bg-gray-800 p-8 rounded-full border-2 border-yellow-500 animate-pulse hover:scale-105 transition-transform">
                  <ShoppingBag className="w-16 h-16 text-yellow-500" />
                </button>
                <p className="text-gray-400 text-sm mt-4 uppercase tracking-widest">Tap to open</p>
              </div>
            )}

            {bagStage === 'opening' && (
              <div className="text-center">
                <Loader2 className="w-16 h-16 text-yellow-500 animate-spin" />
                <p className="text-white mt-4 uppercase tracking-widest">Opening...</p>
              </div>
            )}

            {bagStage === 'rewards' && (
              <div className="text-center w-full max-w-md">
                <h2 className="text-white text-2xl font-bold mb-2 italic uppercase">New Items!</h2>
                <p className="text-yellow-400/70 text-xs font-bold uppercase tracking-widest mb-6">12 Cards Added to Kit Bag</p>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {newCards.map((card, index) => (
                    <div key={index} className="flex justify-center animate-in zoom-in" style={{ animationDelay: `${index * 100}ms` }}>
                      {/* inner div sized to the card so badge positions on its corner */}
                      <div className="relative w-fit">
                        <CardBase type={card.cardBaseType} />
                        <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs font-black rounded-full w-7 h-7 flex items-center justify-center shadow-lg z-30">
                          ×3
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleCollectRewards}
                  className="bg-yellow-500 hover:bg-yellow-400 text-black px-8 py-3 rounded-full font-bold uppercase tracking-wider transition-colors"
                >
                  Collect
                </button>
              </div>
            )}
          </div>
        )}

        {/* STREAK SAVE MODAL */}
        {showStreakSaveModal && pendingDecay && (
          <div className="fixed inset-0 z-[75] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden">
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 blur-[80px] rounded-full" />
              <div className="relative z-10">
                <div className="mb-6 flex justify-center">
                  <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center border-2 border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.3)]">
                    <Zap className="w-10 h-10 text-amber-400" />
                  </div>
                </div>
                <h2 className="text-2xl font-black text-white mb-2 uppercase italic tracking-tight">Streak at Risk</h2>
                <p className="text-gray-400 text-sm mb-6">
                  Your streak would drop from{' '}
                  <span className="text-white font-bold">{pendingDecay.fromStreak}</span> to{' '}
                  <span className="text-red-400 font-bold">{pendingDecay.toStreak}</span>.
                  Spend 1 energy drink to save it?
                </p>
                <div className="flex items-center justify-center gap-2 mb-6">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span className="text-amber-400 font-bold text-sm">{energyDrinks} drink{energyDrinks !== 1 ? 's' : ''} available</span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      setShowStreakSaveModal(false);
                      await declineStreakSave();
                      navigate('/inventory/kit-bag');
                    }}
                    className="flex-1 py-3 border border-white/20 text-white/70 font-bold uppercase tracking-wider rounded-xl text-sm hover:bg-white/5 transition-colors"
                  >
                    Decline
                  </button>
                  <button
                    onClick={async () => {
                      setShowStreakSaveModal(false);
                      await saveStreakWithDrink();
                      navigate('/inventory/kit-bag');
                    }}
                    className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-wider rounded-xl text-sm transition-colors"
                  >
                    Save Streak
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
