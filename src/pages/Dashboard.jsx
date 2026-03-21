import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGame } from '../shared/context/GameContext';
import { Zap, Star, Loader2, ShoppingBag, X, TrendingUp, Cone, User, Mail, Shield, LogOut, ChevronRight } from 'lucide-react';
import gameDataRaw from '../data/gameData.json';
import { getCardConfig } from '../utils/cardConfig';
import CardBase from '../shared/ui/CardBase';
import WinModal from '../components/WinModal';

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile, updateInventory, loading, gainEnergy, supabase } = useGame();

  // --- LOCAL STATE ---
  const [showSettings, setShowSettings] = useState(false);
  const [showBagOverlay, setShowBagOverlay] = useState(false);
  const [bagStage, setBagStage] = useState('closed');
  const [newCards, setNewCards] = useState([]);
  const [showEnergyModal, setShowEnergyModal] = useState(false);

  // REAL-TIME DATA
  const [winAmount, setWinAmount] = useState(0);
  const [showWinModal, setShowWinModal] = useState(false);

  // UX STATE
  const [imageLoaded, setImageLoaded] = useState(false);
  const [highlightBag, setHighlightBag] = useState(false);

  // MOCK LOGIC (Replace with real data later)
  const trainingCompletedToday = false;
  const dailyRewardAvailable = false;

  const gameData = gameDataRaw || { cardTypes: [] };
  const userData = userProfile;
  const clubName = userProfile?.club_name || userProfile?.name || 'Manager';

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // --- 1. INITIALIZATION & SYNC ---
  useEffect(() => {
    if (location.state?.firstLogin) {
      setShowBagOverlay(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);



  // --- 2. INTERACTION HANDLERS ---

  const handleWhiteboardClick = () => {
    navigate('/inventory?tab=pending');
  };

  const handleTabletClick = () => {
    navigate('/leaderboard');
  };

  const handleDrinkClick = () => {
    setShowEnergyModal(true);
  };

  const handleEnergyAction = async () => {
    if (userData.energy < (userData.max_energy || 5)) {
      await gainEnergy(1);
      setShowEnergyModal(false);
    }
  };

  const handleBagClick = () => {
    if (dailyRewardAvailable) {
      setBagStage('closed');
      setShowBagOverlay(true);
    } else {
      navigate('/inventory?tab=deck');
    }
  };

  // --- 3. HELPER: Bag Opening Logic ---
  const triggerBagOpening = () => {
    setBagStage('opening');
    setTimeout(() => {
      const availableCards = gameData.cardTypes || [];
      const randomCards = [];

      for (let i = 0; i < 3; i++) {
        const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];
        if (randomCard) {
          randomCards.push({
            ...randomCard,
            id: `card-${Date.now()}-${i}`,
          });
        }
      }

      setNewCards(randomCards);
      setBagStage('rewards');

      if (randomCards.length > 0) {
        // updateInventory expects string card IDs, not card objects
        updateInventory(randomCards.map(c => c.type || c.id));
      }
    }, 1500);
  };

  const handleCollectRewards = () => {
    setShowBagOverlay(false);
    setBagStage('closed');
    setNewCards([]);
  };

  if (loading) return (
    <div className="bg-black h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-yellow-500" />
    </div>
  );

  return (
    <div className="w-full h-[100dvh] bg-black flex items-center justify-center overflow-hidden font-sans select-none">
      <div className="relative aspect-[9/16] h-full max-h-[100dvh] w-auto overflow-hidden">

        {/* ============================================================ */}
        {/* LAYER 0: THE ROOM (Background)                               */}
        {/* ============================================================ */}

        {/* Placeholder while image loads */}
        <div className={`absolute inset-0 bg-gray-900 transition-opacity duration-1000 ${imageLoaded ? 'opacity-0' : 'opacity-100'}`} />

        <img
          src="/assets/bg-dashboard.webp"
          alt="Dashboard"
          onLoad={() => setImageLoaded(true)}
          className={`absolute inset-0 w-full h-full object-fill transition-opacity duration-700 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
        />


        {/* ============================================================ */}
        {/* LAYER 1: INTERACTIVE HOTSPOTS                                */}
        {/* Positions are % of the 9:16 inner container — consistent     */}
        {/* across all screen sizes. Bottom hotspots end at ≤87% to     */}
        {/* stay clear of the NavigationShell nav bar (~bottom 10%).     */}
        {/* ============================================================ */}

        {/* A. WHITEBOARD (Bets) — center back wall */}
        <div
          onClick={handleWhiteboardClick}
          className="absolute top-[30%] left-[18%] w-[64%] h-[22%] z-10 cursor-pointer active:scale-95 transition-transform"
          data-testid="hotspot-whiteboard"
        >
          <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float">
            <TrendingUp className="w-3.5 h-3.5 text-white" />
          </div>
        </div>

        {/* B. TABLET — left side of bench */}
        <div
          onClick={handleTabletClick}
          className="absolute top-[55%] left-[12%] w-[20%] h-[7%] z-10 cursor-pointer active:scale-95 transition-transform"
          data-testid="hotspot-tablet"
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float">
            <TrendingUp className="w-3.5 h-3.5 text-green-400" />
          </div>
        </div>

        {/* C. ENERGY DRINKS — right side of bench */}
        <div
          onClick={handleDrinkClick}
          className="absolute top-[55%] left-[62%] w-[23%] h-[7%] z-10 cursor-pointer active:scale-95 transition-transform"
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
          className={`
            absolute top-[74%] left-[28%] w-[54%] h-[14%] z-20 cursor-pointer rounded-2xl
            active:scale-95 transition-transform duration-100
            ${(highlightBag || dailyRewardAvailable) ? 'animate-pulse ring-4 ring-yellow-500/30 shadow-[0_0_30px_rgba(234,179,8,0.3)]' : ''}
          `}
          data-testid="hotspot-inventory"
        >
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float">
            <ShoppingBag className={`w-3.5 h-3.5 ${dailyRewardAvailable ? 'text-yellow-400' : 'text-white'}`} />
          </div>
        </div>

        {/* E. CONES (Training) — floor left, ends at 87% */}
        <div
          onClick={() => navigate('/training')}
          className="absolute top-[68%] left-[5%] w-[23%] h-[14%] z-30 cursor-pointer active:scale-95 transition-transform"
          data-testid="hotspot-training"
        >
          <div className="absolute -top-4 right-2 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float">
            <Cone className="w-3.5 h-3.5 text-orange-400" />
          </div>
        </div>


        {/* ============================================================ */}
        {/* LAYER 2: HUD & MODALS                                        */}
        {/* ============================================================ */}

        {/* HUD (Top Bar) */}
        <div className="absolute top-0 left-0 w-full p-4 pt-6 flex justify-between items-center z-50 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
            <Zap className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
            <span className="text-white font-bold text-xs font-mono">{userData.energy}/{userData.max_energy}</span>
          </div>

          {/* Club Name — centered, tappable */}
          <button
            onClick={() => setShowSettings(true)}
            className="absolute left-1/2 -translate-x-1/2 pointer-events-auto text-white text-base font-black uppercase tracking-widest drop-shadow-lg truncate max-w-[160px] text-center active:opacity-70 transition-opacity"
          >
            {clubName}
          </button>

          <div className="pointer-events-auto flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
            <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
            <span className="text-white font-bold text-xs font-mono">{userData.points}</span>
          </div>
        </div>

        {/* SETTINGS BOTTOM SHEET */}
        {showSettings && (
          <div
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end animate-in fade-in"
            onClick={() => setShowSettings(false)}
          >
            <div
              className="w-full bg-zinc-900 rounded-t-2xl border-t border-white/10 p-6 pb-10 animate-in slide-in-from-bottom"
              onClick={e => e.stopPropagation()}
            >
              {/* Drag handle */}
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />

              {/* Profile card */}
              <div className="bg-zinc-800 rounded-xl p-4 flex items-center gap-4 border border-white/10 mb-6">
                <div className="w-10 h-10 bg-zinc-700 rounded-full flex items-center justify-center border border-white/10 flex-shrink-0">
                  <User className="w-5 h-5 text-zinc-400" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs text-zinc-400 uppercase tracking-widest font-bold">Manager Profile</p>
                  <p className="text-white font-semibold truncate text-sm">{userProfile?.email || 'Unknown'}</p>
                </div>
              </div>

              {/* Account info */}
              <div className="bg-zinc-800/60 rounded-xl border border-white/10 overflow-hidden mb-6">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-white">Email</span>
                  </div>
                  <span className="text-xs text-zinc-500 truncate max-w-[160px]">{userProfile?.email}</span>
                </div>
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-medium text-white">Status</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">Active</span>
                </div>
              </div>

              {/* Log Out */}
              <button
                onClick={handleLogout}
                className="w-full bg-red-500/10 hover:bg-red-500/20 active:scale-95 border border-red-500/30 text-red-400 p-4 rounded-xl flex items-center justify-between transition-all group"
              >
                <div className="flex items-center gap-3">
                  <LogOut className="w-5 h-5" />
                  <span className="font-bold">Log Out</span>
                </div>
                <ChevronRight className="w-5 h-5 opacity-50 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        )}

        {/* ENERGY MODAL */}
        {showEnergyModal && (
          <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
            <div className="w-full max-w-sm bg-gray-900 border border-white/10 rounded-2xl p-6 relative shadow-2xl">
              <button onClick={() => setShowEnergyModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white">
                <X className="w-6 h-6" />
              </button>

              <h3 className="text-2xl font-black italic text-white uppercase mb-2">Hydration Station</h3>
              <div className="flex justify-center my-6">
                <img src="/assets/energydrinks.png" alt="Drinks" className="w-32 h-32 object-contain drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
              </div>

              <div className="text-center mb-6">
                <p className="text-gray-400 text-sm uppercase tracking-widest mb-1">Current Energy</p>
                <div className="text-4xl font-mono font-bold text-yellow-400">{userData.energy} / {userData.max_energy}</div>
              </div>

              {userData.energy < userData.max_energy ? (
                <button
                  onClick={handleEnergyAction}
                  className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase tracking-widest rounded-xl transition-colors"
                >
                  Drink (Restore)
                </button>
              ) : (
                <button disabled className="w-full py-4 bg-gray-800 text-gray-500 font-bold uppercase tracking-widest rounded-xl cursor-not-allowed">
                  Max Energy Full
                </button>
              )}
            </div>
          </div>
        )}

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
                <h2 className="text-white text-2xl font-bold mb-6 italic uppercase">New Items!</h2>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {newCards.map((card, index) => (
                    <div key={index} className="animate-in zoom-in" style={{ animationDelay: `${index * 100}ms` }}>
                      <CardBase card={card} />
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

        {/* WIN MODAL */}
        {showWinModal && (
          <WinModal
            amount={winAmount}
            onClose={() => {
              setShowWinModal(false);
              setWinAmount(0);
            }}
          />
        )}

      </div>
    </div>
  );
}
