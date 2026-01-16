import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { ArrowLeft, Zap, X } from 'lucide-react';
import MobileLayout from '../components/MobileLayout';
import { mockConsumables } from '../data/mockInventory';

const Inventory = () => {
  const navigate = useNavigate();
  const { userProfile } = useGame();
  const [showDrinkPopup, setShowDrinkPopup] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const cardTypes = [
    { id: 'c_match_result', label: 'Match Result', img: '/cards/card_match_result.webp' },
    { id: 'c_total_goals', label: 'Total Goals', img: '/cards/card_total_goals.webp' },
    { id: 'c_player_score', label: 'Player Score', img: '/cards/card_player_score.webp' },
    { id: 'c_supersub', label: 'Super Sub', img: '/cards/card_supersub.webp' },
  ];

  const getCardCount = (cardId) => {
    if (!userProfile?.inventory) return 0;
    return userProfile.inventory.filter(item => item === cardId).length;
  };

  const handleDrink = () => {
    // Mock function - in production this would call an API
    console.log('✅ Energy Drink consumed!');
    setShowDrinkPopup(false);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  return (
    <>
      <MobileLayout bgImage="/bg-dashboard.webp">
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
            <h1 className="text-2xl font-black text-white uppercase tracking-wide">Inventory</h1>
            <div className="w-16" /> {/* Spacer for centering */}
          </div>

          {/* Consumables Section */}
          <div className="mb-8">
            <h2 className="text-white/70 font-bold text-sm uppercase tracking-wider mb-4">Consumables</h2>
            <div className="grid grid-cols-2 gap-4">
              {/* Energy Drink Card */}
              <button
                onClick={() => setShowDrinkPopup(true)}
                className="bg-gradient-to-br from-blue-900/40 to-yellow-900/40 backdrop-blur-md border border-blue-500/30 rounded-xl p-4 hover:scale-105 transition-all active:scale-95"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center border-2 border-blue-400/50">
                    <Zap className="w-8 h-8 text-yellow-400 fill-yellow-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-bold text-sm">Energy Drink</p>
                    <p className="text-blue-300 text-xs font-mono">x{mockConsumables.energy_drinks}</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* My Deck Section */}
          <div className="flex-1 overflow-y-auto">
            <h2 className="text-white/70 font-bold text-sm uppercase tracking-wider mb-4">My Deck</h2>
            <div className="grid grid-cols-2 gap-4">
              {cardTypes.map((card) => {
                const count = getCardCount(card.id);
                const isActive = count > 0;
                return (
                  <div
                    key={card.id}
                    className={`bg-black/40 backdrop-blur-md border rounded-xl p-4 transition-all ${isActive
                        ? 'border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.15)]'
                        : 'border-white/10 opacity-40 grayscale'
                      }`}
                  >
                    <div className="aspect-[3/4] bg-white/5 rounded-lg overflow-hidden mb-3 flex items-center justify-center">
                      <img
                        src={card.img}
                        alt={card.label}
                        className="w-full h-full object-contain p-2"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    </div>
                    <div className="text-center">
                      <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${isActive ? 'text-white' : 'text-gray-600'}`}>
                        {card.label}
                      </p>
                      <p className={`text-sm font-black ${isActive ? 'text-yellow-400' : 'text-gray-700'}`}>
                        x{count}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </MobileLayout>

      {/* Energy Drink Popup */}
      {showDrinkPopup && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-gradient-to-br from-gray-900 to-black border-2 border-blue-500/50 rounded-2xl p-8 max-w-sm w-full relative animate-in zoom-in slide-in-from-bottom duration-300">
            {/* Close button */}
            <button
              onClick={() => setShowDrinkPopup(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Energy Drink Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500/20 to-yellow-500/20 rounded-full flex items-center justify-center border-4 border-blue-400/50 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                <Zap className="w-12 h-12 text-yellow-400 fill-yellow-400 animate-pulse" />
              </div>
            </div>

            {/* Text */}
            <h3 className="text-2xl font-black text-white text-center mb-2 uppercase">Energy Drink</h3>
            <p className="text-blue-300 text-center mb-6">Restore 3 Energy?</p>

            {/* Drink Button */}
            <button
              onClick={handleDrink}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-lg"
            >
              DRINK
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-lg shadow-lg z-[100] animate-in slide-in-from-bottom fade-in duration-300">
          ⚡ Energy Restored!
        </div>
      )}
    </>
  );
};

export default Inventory;