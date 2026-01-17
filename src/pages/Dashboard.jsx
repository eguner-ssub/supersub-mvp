import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { Zap, Coins, Cone, Trophy, Backpack, ShoppingBag, Loader2 } from 'lucide-react';
import gameDataRaw from '../data/gameData.json';
import { mockCards } from '../data/mockInventory';

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const { userProfile, updateInventory, loading } = useGame();

  const [showBagOverlay, setShowBagOverlay] = useState(false);
  const [bagStage, setBagStage] = useState('closed');
  const [newCards, setNewCards] = useState([]);

  const gameData = gameDataRaw || { cardTypes: [] };

  useEffect(() => {
    if (location.state?.firstLogin) {
      setShowBagOverlay(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const cardTypes = [
    { id: 'c_match_result', label: 'Match Result', img: '/cards/card_match_result.webp' },
    { id: 'c_total_goals', label: 'Total Goals', img: '/cards/card_total_goals.webp' },
    { id: 'c_player_score', label: 'Player Score', img: '/cards/card_player_score.webp' },
    { id: 'c_supersub', label: 'Super Sub', img: '/cards/card_supersub.webp' },
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

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans select-none">

      {/* BACKGROUND */}
      <div className="absolute inset-0 z-0">
        <img
          src="/bg-dashboard.webp"
          alt="Dressing Room"
          className="w-full h-full object-cover opacity-80"
          onError={(e) => e.target.style.display = 'none'}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40"></div>
      </div>

      {/* HEADER HUD */}
      <div className="absolute top-0 left-0 w-full p-4 pt-6 flex justify-between items-center z-30">
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

      {/* CENTER ACTIONS */}
      <div className="absolute w-full flex justify-center items-center gap-4 z-20 px-4" style={{ top: '50%', transform: 'translateY(-50%)' }}>
        <button
          onClick={() => navigate('/training')}
          className="flex flex-col items-center justify-center w-20 h-20 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl active:scale-95 transition-all group hover:bg-white/5"
        >
          <Cone className="w-6 h-6 text-gray-300 group-hover:text-blue-400 transition-colors mb-1" />
          <span className="text-[10px] text-gray-300 font-bold uppercase tracking-wide">Train</span>
        </button>

        <button
          onClick={() => navigate('/match-hub')}
          className="relative flex flex-col items-center justify-center w-28 h-28 bg-gradient-to-b from-green-900/90 to-black/90 backdrop-blur-xl border border-green-500/50 rounded-2xl shadow-[0_0_25px_rgba(34,197,94,0.25)] active:scale-95 transition-all group hover:shadow-[0_0_35px_rgba(34,197,94,0.4)]"
        >
          <div className="absolute inset-0 bg-green-500/10 rounded-2xl animate-pulse"></div>
          <Trophy className="w-10 h-10 text-green-400 mb-2 drop-shadow-lg relative z-10" />
          <span className="text-xs text-white font-black uppercase tracking-widest relative z-10">Match</span>
        </button>

        <button
          onClick={() => navigate('/inventory')}
          className="flex flex-col items-center justify-center w-20 h-20 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl active:scale-95 transition-all group hover:bg-white/5"
        >
          <Backpack className="w-6 h-6 text-gray-300 group-hover:text-yellow-400 transition-colors mb-1" />
          <span className="text-[10px] text-gray-300 font-bold uppercase tracking-wide">Inventory</span>
        </button>
      </div>

      {/* THE DECK SHELF */}
      <div className="absolute bottom-0 w-full z-30">
        <div className="w-full bg-gradient-to-t from-black via-black/90 to-transparent pt-12 pb-6 px-4">

          {/* Dynamic Status Bar - Live Action or Pending Bets */}
          {(() => {
            const liveCards = mockCards.filter(c => c.status === 'LIVE');
            const pendingCards = mockCards.filter(c => c.status === 'PENDING');

            if (liveCards.length > 0) {
              return (
                <div className="bg-red-600/20 backdrop-blur-md border border-red-500 rounded-xl p-4 mb-4 mx-2 animate-pulse">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                      <span className="text-red-400 font-bold text-sm uppercase">
                        🔴 {liveCards.length} Live {liveCards.length === 1 ? 'Match' : 'Matches'}
                      </span>
                    </div>
                    <button
                      onClick={() => navigate('/inventory?tab=live')}
                      className="text-red-300 hover:text-red-200 text-sm font-bold transition-colors"
                    >
                      Watch Now →
                    </button>
                  </div>
                </div>
              );
            } else if (pendingCards.length > 0) {
              return (
                <div className="bg-yellow-600/20 backdrop-blur-md border border-yellow-500/30 rounded-xl p-4 mb-4 mx-2">
                  <div className="flex justify-between items-center">
                    <span className="text-yellow-400 font-bold text-sm">
                      📋 {pendingCards.length} Pending {pendingCards.length === 1 ? 'Bet' : 'Bets'}
                    </span>
                    <button
                      onClick={() => navigate('/inventory?tab=pending')}
                      className="text-yellow-300 hover:text-yellow-200 text-sm font-bold transition-colors"
                    >
                      View All →
                    </button>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          <div className="flex justify-between items-end mb-3 px-2">
            <h3 className="text-white/50 font-bold text-[10px] tracking-[0.2em] uppercase">Tactical Deck</h3>
            <span className="text-yellow-500 font-bold text-[10px] tracking-wider uppercase bg-yellow-500/10 px-2 py-0.5 rounded">
              {userData.inventory?.length || 0} Cards
            </span>
          </div>
          <div className="flex justify-between items-end gap-2 h-24">
            {cardTypes.map((card) => {
              const count = getCardCount(card.id);
              const isActive = count > 0;
              return (
                <div key={card.id} className={`flex-1 flex flex-col items-center gap-2 transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-30 grayscale'}`}>
                  <div className={`relative w-full h-full rounded-lg border border-white/5 bg-white/5 overflow-hidden flex items-center justify-center ${isActive ? 'shadow-[0_0_15px_rgba(234,179,8,0.15)] border-yellow-500/30' : ''}`}>
                    <img
                      src={card.img}
                      alt={card.label}
                      className="w-full h-full object-contain p-1"
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-wider ${isActive ? 'text-white' : 'text-gray-600'}`}>x{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* FIRST LOGIN BAG OVERLAY */}
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
                      <img src={card.img} className="w-full h-full object-contain p-1" alt={card.label} />
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowBagOverlay(false)}
                className="w-full py-4 bg-white hover:bg-gray-200 text-black font-black uppercase tracking-widest rounded-xl transition-transform active:scale-95 shadow-xl"
              >
                Enter Dressing Room
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}