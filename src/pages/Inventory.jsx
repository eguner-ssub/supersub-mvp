import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { ArrowLeft, Zap, X } from 'lucide-react';
import MobileLayout from '../components/MobileLayout';
import { mockConsumables } from '../data/mockInventory';
// 1. IMPORT THE COMPONENT
import CardBase from '../components/CardBase';

const Inventory = () => {
  const navigate = useNavigate();
  const { userProfile } = useGame();
  const [showDrinkPopup, setShowDrinkPopup] = useState(false);
  const [showToast, setShowToast] = useState(false);

  // 2. SIMPLIFIED DATA (We don't need 'img' paths anymore, CardBase handles it)
  const cardTypes = [
    { id: 'c_match_result', label: 'Match Result' },
    { id: 'c_total_goals', label: 'Total Goals' },
    { id: 'c_player_score', label: 'Player Score' },
    { id: 'c_supersub', label: 'Super Sub' },
  ];

  const getCardCount = (cardId) => {
    if (!userProfile?.inventory) return 0;
    return userProfile.inventory.filter(item => item === cardId).length;
  };

  const handleDrink = () => {
    console.log('✅ Energy Drink consumed!');
    setShowDrinkPopup(false);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  return (
    <>
      <MobileLayout bgImage="/assets/bg-dashboard.webp">
        <div className="w-full max-w-md h-full flex flex-col p-6 relative">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-bold">Back</span>
            </button>
            <h1 className="text-2xl font-black text-white uppercase tracking-wide italic">Inventory</h1>
            <div className="w-16" />
          </div>

          {/* Consumables Section */}
          <div className="mb-8">
            <h2 className="text-white/50 font-mono text-[10px] uppercase tracking-[0.2em] mb-4 pl-1">Consumables</h2>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setShowDrinkPopup(true)}
                className="relative bg-gray-900/60 backdrop-blur-md border border-white/10 rounded-xl p-4 hover:border-blue-500/50 transition-all active:scale-95 group"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full flex items-center justify-center border border-blue-500/20 group-hover:shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-shadow">
                    <Zap className="w-6 h-6 text-blue-400 fill-blue-400 group-hover:text-yellow-400 group-hover:fill-yellow-400 transition-colors" />
                  </div>
                  <div className="text-center">
                    <p className="text-gray-300 font-bold text-xs uppercase tracking-wide group-hover:text-white">Energy Drink</p>
                    <p className="text-blue-400 text-[10px] font-mono mt-1">x{mockConsumables.energy_drinks}</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* My Deck Section - THE OVERHAUL */}
          <div className="flex-1 overflow-y-auto pb-20">
            <h2 className="text-white/50 font-mono text-[10px] uppercase tracking-[0.2em] mb-4 pl-1">Tactical Deck</h2>

            <div className="grid grid-cols-2 gap-x-4 gap-y-8">
              {cardTypes.map((card) => {
                const count = getCardCount(card.id);
                const hasCards = count > 0;

                return (
                  <div key={card.id} className="relative group">

                    {/* 3. THE STANDARD COMPONENT */}
                    {/* Opacity logic: Dim it if they have 0 cards */}
                    <div className={hasCards ? 'opacity-100' : 'opacity-40 grayscale contrast-125'}>
                      <CardBase
                        type={card.id}
                        label={card.label}
                        status="generic" // Forces the Silver look
                      />
                    </div>

                    {/* 4. QUANTITY BADGE (Overlay) */}
                    {/* We float this ON TOP of the CardBase */}
                    {hasCards && (
                      <div className="absolute -top-2 -right-2 z-30">
                        <div className="bg-yellow-500 text-black font-black font-mono text-xs w-6 h-6 flex items-center justify-center rounded-full border-2 border-black shadow-lg">
                          {count}
                        </div>
                      </div>
                    )}

                    {/* Empty State Badge */}
                    {!hasCards && (
                      <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                        <div className="bg-black/80 px-3 py-1 rounded text-[10px] font-bold text-white/50 uppercase border border-white/10">
                          Empty
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </MobileLayout>

      {/* DRINK POPUP (Keep existing logic, just refined styles) */}
      {showDrinkPopup && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-8 max-w-sm w-full relative animate-in zoom-in slide-in-from-bottom duration-300 shadow-2xl">
            <button
              onClick={() => setShowDrinkPopup(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="flex justify-center mb-6">
              {/* Placeholder for a future 3D Can Asset */}
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full flex items-center justify-center border border-blue-500/30">
                <Zap className="w-10 h-10 text-yellow-400 fill-yellow-400" />
              </div>
            </div>

            <h3 className="text-xl font-black text-white text-center mb-2 uppercase italic tracking-wider">Hydration</h3>
            <p className="text-gray-400 text-center text-xs mb-8">Restore 3 Energy Points?</p>

            <button
              onClick={handleDrink}
              className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase tracking-widest rounded-xl transition-all active:scale-95"
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {showToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-full shadow-[0_0_20px_rgba(22,163,74,0.4)] z-[100] animate-in slide-in-from-top fade-in duration-300 font-bold text-sm tracking-wide">
          ⚡ ENERGY RESTORED
        </div>
      )}
    </>
  );
};

export default Inventory;