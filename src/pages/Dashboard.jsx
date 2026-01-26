import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { Zap, Coins, Loader2, ShoppingBag } from 'lucide-react';
import gameDataRaw from '../data/gameData.json';
import { getCardConfig } from '../utils/cardConfig';
import CardBase from '../components/CardBase';
import WinModal from '../components/WinModal';

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const { userProfile, updateInventory, loading, supabase, checkActiveBets, loadProfile } = useGame();

  const [showBagOverlay, setShowBagOverlay] = useState(false);
  const [bagStage, setBagStage] = useState('closed');
  const [newCards, setNewCards] = useState([]);

  // Win celebration state
  const [showWinModal, setShowWinModal] = useState(false);
  const [winAmount, setWinAmount] = useState(0);

  // Live and pending bets state
  const [liveBets, setLiveBets] = useState([]);
  const [pendingBets, setPendingBets] = useState([]);

  // PERFORMANCE ENGINE: Progressive Image Loading
  const [imageLoaded, setImageLoaded] = useState(false);

  // USER GUIDANCE: Highlight kitbag after claiming starter kit
  const [highlightBag, setHighlightBag] = useState(false);

  const gameData = gameDataRaw || { cardTypes: [] };

  useEffect(() => {
    if (location.state?.firstLogin) {
      setShowBagOverlay(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  // Real-time subscription for win celebrations
  useEffect(() => {
    if (!userProfile?.id || !supabase) return;

    const channel = supabase
      .channel('predictions-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'predictions',
          filter: `user_id=eq.${userProfile.id}`
        },
        (payload) => {
          const { old: oldRecord, new: newRecord } = payload;

          if (newRecord.status === 'WON' && oldRecord.status !== 'WON') {
            setWinAmount(newRecord.potential_reward);
            setShowWinModal(true);

            // Reload profile to update coins
            if (loadProfile) {
              supabase.auth.getSession().then(({ data }) => {
                if (data.session) loadProfile(data.session);
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile?.id, supabase, loadProfile]);

  // Check active bets periodically
  useEffect(() => {
    if (userProfile && checkActiveBets) {
      checkActiveBets(); // Initial check
      const interval = setInterval(checkActiveBets, 10000); // Check every 10s
      return () => clearInterval(interval);
    }
  }, [userProfile, checkActiveBets]);

  // Fetch live and pending bets
  useEffect(() => {
    const fetchActiveBets = async () => {
      if (!userProfile?.id || !supabase) return;

      try {
        // Fetch LIVE bets
        const { data: live, error: liveError } = await supabase
          .from('predictions')
          .select('*')
          .eq('user_id', userProfile.id)
          .eq('status', 'LIVE');

        if (!liveError && live) {
          setLiveBets(live);
        }

        // Fetch PENDING bets
        const { data: pending, error: pendingError } = await supabase
          .from('predictions')
          .select('*')
          .eq('user_id', userProfile.id)
          .eq('status', 'PENDING');

        if (!pendingError && pending) {
          setPendingBets(pending);
        }
      } catch (error) {
        console.error('Error fetching active bets:', error);
      }
    };

    fetchActiveBets();

    // Refresh every 30 seconds
    const interval = setInterval(fetchActiveBets, 30000);
    return () => clearInterval(interval);
  }, [userProfile?.id, supabase]);

  const cardTypes = [
    { id: 'c_match_result', label: 'Match Result' },
    { id: 'c_total_goals', label: 'Total Goals' },
    { id: 'c_player_score', label: 'Player Score' },
    { id: 'c_supersub', label: 'Super Sub' },
  ];

  if (loading) {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
        <p className="text-gray-500 text-xs uppercase tracking-widest">Syncing Club Data...</p>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-red-500 font-bold text-xl mb-4">DATA SYNC ERROR</h2>
        <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto">
          We couldn't retrieve your manager profile. This usually happens if the database policies (RLS) are blocking access.
        </p>
        <button
          onClick={() => window.location.href = '/login'}
          className="px-6 py-3 bg-white text-black font-bold uppercase tracking-widest rounded hover:bg-gray-200"
        >
          Return to Gate
        </button>
      </div>
    );
  }

  const userData = userProfile;

  const getCardCount = (cardId) => {
    if (!userData.inventory) return 0;
    return userData.inventory.filter(item => item === cardId).length;
  };

  const handleOpenBag = () => {
    setBagStage('opening');
    setTimeout(() => {
      const possibleIds = gameData.cardTypes?.length > 0
        ? gameData.cardTypes.map(c => c.id)
        : ['c_match_result', 'c_total_goals'];

      const drawnCards = Array.from({ length: 5 }, () => {
        const randomId = possibleIds[Math.floor(Math.random() * possibleIds.length)];
        return cardTypes.find(c => c.id === randomId) || { id: randomId, label: 'Card', img: '' };
      });

      setNewCards(drawnCards);

      if (updateInventory) {
        updateInventory(drawnCards.map(c => c.id));
      }

      setBagStage('rewards');
    }, 1500);
  };

  // HELPER: Close bag overlay & trigger user guidance
  const closeBagOverlay = () => {
    setShowBagOverlay(false);
    // Pulse the bag in the room to show them where the items went
    setHighlightBag(true);
    // Stop pulsing after 5 seconds automatically (User protection)
    setTimeout(() => setHighlightBag(false), 5000);
  };

  return (
    <div className="relative w-full h-[100dvh] bg-black overflow-hidden md:max-w-[480px] md:mx-auto md:h-screen md:border-x md:border-gray-800">

      {/* ============================================================================ */}
      {/* LAYER 0: PROGRESSIVE BACKGROUND (BLUR-UP STRATEGY)                        */}
      {/* ============================================================================ */}

      {/* A. The Placeholder (Instant Load) */}
      {/* Uses a dark gradient approximating the room colors to hide the white flash */}
      <div
        className={`absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-800 to-black transition-opacity duration-1000 ${imageLoaded ? 'opacity-0' : 'opacity-100'}`}
      />

      {/* B. The Master Asset (Lazy Fade-In) */}
      <img
        src="/assets/bg-dressing-room.webp"
        alt="Dressing Room"
        onLoad={() => setImageLoaded(true)}
        className={`absolute inset-0 w-full h-full object-cover object-bottom transition-opacity duration-700 ease-in-out ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Optional: Dark Gradient Overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/20 pointer-events-none" />

      {/* ============================================================================ */}
      {/* LAYER 1: TACTILE HITBOXES (THE "SQUISH" SYSTEM)                           */}
      {/* ============================================================================ */}

      {/* A. KITBAG (Inventory) - Bottom Center/Right */}
      <div
        onClick={() => {
          setHighlightBag(false); // Stop pulsing
          navigate('/inventory');
          // Optional SFX: new Audio('/assets/sfx/zip.mp3').play().catch(() => {});
        }}
        className={`
          absolute bottom-[2%] left-[35%] w-[55%] h-[25%] z-20 cursor-pointer rounded-[40px]
          active:scale-95 active:backdrop-brightness-125 active:backdrop-contrast-110
          transition-all duration-100 ease-out
          ${highlightBag ? 'animate-pulse ring-4 ring-yellow-500/30 shadow-[0_0_30px_rgba(234,179,8,0.3)]' : ''}
        `}
        data-testid="hotspot-inventory"
      />

      {/* B. CONES (Training) - Bottom Left */}
      <div
        onClick={() => navigate('/training')}
        className="absolute bottom-[5%] left-[-2%] w-[30%] h-[30%] 
                   rounded-tr-[50px] cursor-pointer z-30
                   active:scale-95 active:backdrop-brightness-125 active:backdrop-contrast-110
                   transition-all duration-100 ease-out"
        data-testid="hotspot-training"
      />

      {/* C. DRINKS (Shop) - Bench Right */}
      <div
        onClick={() => navigate('/shop')}
        className="absolute bottom-[35%] right-[2%] w-[25%] h-[15%] 
                   rounded-xl cursor-pointer z-10
                   active:scale-95 active:backdrop-brightness-125 active:backdrop-contrast-110
                   transition-all duration-100 ease-out"
        data-testid="hotspot-shop"
      />

      {/* D. TABLET (Missions) - Bench Left */}
      <div
        onClick={() => navigate('/missions')}
        className="absolute bottom-[35%] left-[10%] w-[25%] h-[18%] 
                   rounded-xl cursor-pointer z-10
                   active:scale-95 active:backdrop-brightness-125 active:backdrop-contrast-110
                   transition-all duration-100 ease-out"
        data-testid="hotspot-missions"
      />

      {/* E. WHITEBOARD (Pending Bets) - Wall Top Right */}
      <div
        onClick={() => navigate('/inventory?tab=pending')}
        className="absolute top-[20%] right-[10%] w-[40%] h-[20%] 
                     bg-transparent cursor-pointer z-10"
        data-testid="hotspot-whiteboard"
      >
        {/* Dynamic Indicator for Live Bets */}
        {liveBets?.length > 0 && (
          <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded animate-pulse shadow-lg border border-red-400">
            LIVE NOW
          </div>
        )}
      </div>

      {/* F. MANAGER OFFICE NAVIGATION (Right Edge) */}
      <div
        onClick={() => navigate('/manager-office')}
        className="absolute top-1/2 right-2 -translate-y-1/2 z-40 p-2 cursor-pointer opacity-50 hover:opacity-100 transition-opacity"
        data-testid="nav-office"
      >
        {/* Use a simple Chevron icon here */}
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
      </div>

      {/* LAYER 2: HUD (Energy/Coins) */}
      <div className="absolute top-0 left-0 w-full p-4 pt-6 flex justify-between items-center z-50">
        {/* Energy */}
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg">
          <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          <span className="text-white font-bold text-sm font-mono pt-0.5">
            {userData.energy}/{userData.max_energy || 3}
          </span>
        </div>

        {/* Manager Name - CLICKABLE LINK TO ACCOUNT */}
        <button
          onClick={() => navigate('/account')}
          className="absolute left-1/2 -translate-x-1/2 text-white text-lg font-black uppercase tracking-widest drop-shadow-lg truncate max-w-[150px] text-center hover:text-yellow-400 hover:scale-105 transition-all cursor-pointer"
        >
          {userData.club_name || userData.name}
        </button>

        {/* Coins */}
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg">
          <Coins className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          <span className="text-white font-bold text-sm font-mono pt-0.5">{userData.coins}</span>
        </div>
      </div>


      {showBagOverlay && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
          {bagStage === 'closed' && (
            <div className="text-center animate-in zoom-in duration-300">
              <h2 className="text-3xl font-black text-white mb-8 uppercase tracking-widest italic">Kit Delivery</h2>
              <button
                onClick={handleOpenBag}
                className="w-48 h-48 bg-gray-900 rounded-3xl flex items-center justify-center border-2 border-yellow-500/50 cursor-pointer hover:scale-105 transition-transform shadow-[0_0_50px_rgba(234,179,8,0.2)] mx-auto mb-8 group"
              >
                <ShoppingBag className="w-20 h-20 text-yellow-500 group-hover:text-yellow-400 transition-colors drop-shadow-[0_0_15px_rgba(234,179,8,0.6)]" />
              </button>
              <p className="text-white/50 text-xs uppercase tracking-[0.2em] animate-pulse">Tap to Equip</p>
            </div>
          )}
          {bagStage === 'opening' && (
            <div className="flex flex-col items-center gap-6">
              <Loader2 className="w-16 h-16 text-yellow-500 animate-spin" />
              <p className="text-white font-mono uppercase text-sm tracking-widest">Unpacking Gear...</p>
            </div>
          )}
          {bagStage === 'rewards' && (
            <div className="w-full max-w-lg text-center animate-in zoom-in slide-in-from-bottom duration-500">
              <h2 className="text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 mb-2 uppercase tracking-tighter">Squad Ready</h2>
              <p className="text-gray-500 text-[10px] mb-10 uppercase tracking-[0.3em] font-bold">New Assets Added to Inventory</p>
              <div className="flex justify-center flex-wrap gap-3 mb-12">
                {newCards.map((card, idx) => (
                  <div key={idx} className="flex flex-col items-center animate-in slide-in-from-bottom fade-in duration-500" style={{ animationDelay: `${idx * 150}ms` }}>
                    <div className="w-14 h-20 bg-gray-800/80 rounded border border-yellow-500/30 overflow-hidden relative shadow-[0_0_15px_rgba(234,179,8,0.1)]">
                      <CardBase
                        rarity={getCardConfig(card.id).rarity}
                        role={getCardConfig(card.id).role}
                        label={card.label}
                        className="w-full h-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={closeBagOverlay}
                className="w-full py-4 bg-white hover:bg-gray-200 text-black font-black uppercase tracking-widest rounded-xl transition-transform active:scale-95 shadow-xl"
              >
                Enter Dressing Room
              </button>
            </div>
          )}
        </div>
      )
      }

      {/* Win Celebration Modal */}
      {
        showWinModal && (
          <WinModal
            amount={winAmount}
            onClose={() => setShowWinModal(false)}
          />
        )
      }
    </div >
  );
}