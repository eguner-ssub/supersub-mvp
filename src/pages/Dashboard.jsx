import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGame } from '../shared/context/GameContext';
import { Zap, Coins, Loader2, ShoppingBag, X, TrendingUp, Cone } from 'lucide-react';
import gameDataRaw from '../data/gameData.json';
import { getCardConfig } from '../utils/cardConfig';
import CardBase from '../shared/ui/CardBase';
import WinModal from '../components/WinModal';

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile, updateInventory, loading, gainEnergy } = useGame();

  // --- LOCAL STATE ---
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
        updateInventory(randomCards);
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
          className="absolute top-[25%] left-[15%] w-[70%] h-[30%] z-10 cursor-pointer active:scale-95 transition-transform"
          data-testid="hotspot-whiteboard"
        >
          <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float">
            <TrendingUp className="w-3.5 h-3.5 text-white" />
          </div>
        </div>

        {/* B. TABLET — left side of bench */}
        <div
          onClick={handleTabletClick}
          className="absolute top-[58%] left-[5%] w-[30%] h-[12%] z-10 cursor-pointer active:scale-95 transition-transform"
          data-testid="hotspot-tablet"
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float">
            <TrendingUp className="w-3.5 h-3.5 text-green-400" />
          </div>
        </div>

        {/* C. ENERGY DRINKS — right side of bench */}
        <div
          onClick={handleDrinkClick}
          className="absolute top-[58%] left-[62%] w-[30%] h-[12%] z-10 cursor-pointer active:scale-95 transition-transform"
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
            absolute top-[74%] left-[25%] w-[52%] h-[13%] z-20 cursor-pointer rounded-2xl
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
          className="absolute top-[70%] left-[0%] w-[25%] h-[17%] z-30 cursor-pointer active:scale-95 transition-transform"
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
          <div className="pointer-events-auto flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg">
            <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span className="text-white font-bold text-sm font-mono pt-0.5">{userData.energy}/{userData.max_energy}</span>
          </div>
          <div className="pointer-events-auto flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg">
            <Coins className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span className="text-white font-bold text-sm font-mono pt-0.5">{userData.points}</span>
          </div>
        </div>

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
