import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; 
import { useGame } from '../context/GameContext'; 
import { Zap, Coins, Cone, Trophy, ShoppingBag, X } from 'lucide-react'; 
// Assuming you have the JSON available via import
import gameData from '../data/gameData.json';

export default function Dashboard() {
  const navigate = useNavigate(); 
  const location = useLocation();
  const { userProfile, updateInventory } = useGame(); // Added updateInventory assumption
  
  // State for the "First Login" Bag Opening Sequence
  const [showBagOverlay, setShowBagOverlay] = useState(false);
  const [bagStage, setBagStage] = useState('closed'); // 'closed', 'opening', 'rewards'
  const [newCards, setNewCards] = useState([]);

  const userData = userProfile || { 
    name: "Loading...", 
    coins: 0, 
    energy: 0, 
    maxEnergy: 3, 
    inventory: [] 
  };

  const cardTypes = [
    { id: 'c_match_result', label: 'Match Result', img: '/cards/card_match_result.png' },
    { id: 'c_total_goals', label: 'Total Goals', img: '/cards/card_total_goals.png' },
    { id: 'c_player_score', label: 'Player Score', img: '/cards/card_player_score.png' },
    { id: 'c_supersub', label: 'Super Sub', img: '/cards/card_supersub.png' }, 
  ];

  // Check for first login flag passed from Onboarding
  useEffect(() => {
    if (location.state?.firstLogin) {
      setShowBagOverlay(true);
      // Clear state so it doesn't happen on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const getCardCount = (cardId) => {
    if (!userData.inventory) return 0;
    return userData.inventory.filter(item => item === cardId).length;
  };

  // Logic to open the bag and generate 5 random cards
  const handleOpenBag = () => {
    setBagStage('opening');
    
    // Simulate animation delay
    setTimeout(() => {
      // Generate 5 random cards based on IDs in GameData (plus supersub)
      const possibleIds = gameData.cardTypes.map(c => c.id); 
      // Add supersub manually if it's missing from JSON but in assets
      if (!possibleIds.includes('c_supersub')) possibleIds.push('c_supersub');

      const drawnCards = Array.from({ length: 5 }, () => {
        const randomId = possibleIds[Math.floor(Math.random() * possibleIds.length)];
        return cardTypes.find(c => c.id === randomId) || { id: randomId, label: 'Unknown', img: '' };
      });

      setNewCards(drawnCards);
      
      // Update Context (You need to ensure this function exists in your provider)
      // If updateInventory doesn't exist, you'll need to implement logic to add these IDs to userData.inventory
      if (updateInventory) {
        updateInventory(drawnCards.map(c => c.id));
      }
      
      setBagStage('rewards');
    }, 1500);
  };

  const closeOverlay = () => {
    setShowBagOverlay(false);
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans select-none">
      
      {/* BACKGROUND */}
      <img 
        src="/bg-dashboard.png" 
        alt="Dressing Room" 
        className="absolute inset-0 w-full h-full object-cover z-0"
      />

      {/* HEADER HUD */}
      <div className="absolute top-0 left-0 w-full p-4 pt-4 flex justify-between items-center z-30">
        <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
          <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          <span className="text-white font-bold text-sm">{userData.energy}/{userData.maxEnergy}</span>
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 text-white text-xl font-black uppercase tracking-widest drop-shadow-md">
          {userData.name}
        </div>
        <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
          <Coins className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          <span className="text-white font-bold text-sm">{userData.coins}</span>
        </div>
      </div>

      {/* TV PLACEHOLDER */}
      <div 
        className="absolute z-10 overflow-hidden" 
        style={{ top: '27.5%', left: '27%', width: '46%', height: '18%' }}
      >
        {/* <img src="/tv-screen-content.png" className="w-full h-full object-cover" /> */}
      </div>

      {/* MAIN ACTIONS */}
      <div 
        className="absolute w-full flex justify-center items-center gap-3 z-20 px-4"
        style={{ top: '49%', transform: 'translateY(-50%)' }}
      >
        <button 
          onClick={() => navigate('/training')}
          className="flex flex-col items-center justify-center w-20 h-20 bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl active:scale-95 transition-all group hover:bg-black/60"
        >
          <Cone className="w-6 h-6 text-white group-hover:text-blue-400 transition-colors mb-1" />
          <span className="text-[10px] text-white font-bold uppercase tracking-wide">Training</span>
        </button>

        <button 
          onClick={() => navigate('/match-hub')}
          className="flex flex-col items-center justify-center w-24 h-24 bg-gradient-to-b from-green-900/80 to-black/80 backdrop-blur-md border border-green-500/30 rounded-2xl shadow-[0_0_15px_rgba(34,197,94,0.2)] active:scale-95 transition-all group hover:shadow-[0_0_20px_rgba(34,197,94,0.4)]"
        >
          <Trophy className="w-8 h-8 text-green-400 mb-1 drop-shadow-lg" />
          <span className="text-xs text-white font-black uppercase tracking-widest">Match</span>
        </button>

        <button 
          onClick={() => console.log("Shop clicked")}
          className="flex flex-col items-center justify-center w-20 h-20 bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl active:scale-95 transition-all group hover:bg-black/60"
        >
          <ShoppingBag className="w-6 h-6 text-white group-hover:text-yellow-400 transition-colors mb-1" />
          <span className="text-[10px] text-white font-bold uppercase tracking-wide">Shop</span>
        </button>
      </div>

      {/* THE CARD SHELF */}
      <div className="absolute bottom-0 w-full z-30">
        <div className="w-full bg-gradient-to-t from-gray-900 via-black to-transparent pt-8 pb-4">
          <div className="text-center mb-2">
            <h3 className="text-[#F5C546] font-bold text-xs tracking-[0.2em] uppercase drop-shadow-md">
              Your Card Deck
            </h3>
          </div>
          <div className="flex justify-center items-end gap-2 px-2 h-28">
            {cardTypes.map((card) => {
              const count = getCardCount(card.id);
              const isActive = count > 0;
              return (
                <div key={card.id} className={`flex flex-col items-center gap-1 transition-all duration-300 ${isActive ? 'opacity-100 hover:-translate-y-2' : 'opacity-40 grayscale'}`}>
                  <div className={`relative w-20 h-24 rounded-md overflow-hidden shadow-lg ${isActive ? 'shadow-yellow-500/20' : ''}`}>
                    <img 
                      src={card.img} 
                      alt={card.label}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.target.style.display = 'none'; 
                        e.target.parentElement.style.backgroundColor = '#333'; 
                      }}
                    />
                    {isActive && <div className="absolute inset-0 ring-1 ring-yellow-400/50 rounded-md"></div>}
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${isActive ? 'text-white' : 'text-gray-500'}`}>
                    {count} Cards
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* --- NEW: TRAINING BAG OVERLAY --- */}
      {showBagOverlay && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
          
          {bagStage === 'closed' && (
            <div className="text-center animate-in zoom-in duration-300">
              <h2 className="text-2xl font-bold text-white mb-8 uppercase tracking-widest">Training Kit Ready</h2>
              <div 
                onClick={handleOpenBag}
                className="w-48 h-48 bg-gray-800 rounded-2xl flex items-center justify-center border-4 border-yellow-500 cursor-pointer hover:scale-105 transition-transform shadow-[0_0_30px_rgba(234,179,8,0.4)] mx-auto mb-8"
              >
                 {/* Replaced Image tag with icon since I can't generate the file */}
                 <ShoppingBag className="w-24 h-24 text-yellow-500" />
              </div>
              <p className="text-gray-400 text-sm animate-pulse">Tap the bag to equip your squad</p>
            </div>
          )}

          {bagStage === 'opening' && (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-white font-mono uppercase">Rummaging through equipment...</p>
            </div>
          )}

          {bagStage === 'rewards' && (
            <div className="w-full max-w-lg text-center animate-in zoom-in slide-in-from-bottom duration-500">
              <h2 className="text-3xl font-black text-white mb-2 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
                KIT ACQUIRED!
              </h2>
              <p className="text-gray-400 text-xs mb-8 uppercase tracking-widest">Added to Inventory</p>
              
              <div className="flex justify-center flex-wrap gap-4 mb-8">
                {newCards.map((card, idx) => (
                  <div key={idx} className="flex flex-col items-center animate-in slide-in-from-bottom fade-in duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                    <div className="w-16 h-20 bg-gray-800 rounded border border-gray-600 overflow-hidden relative shadow-lg">
                       <img src={card.img} className="w-full h-full object-contain" alt={card.label} />
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={closeOverlay}
                className="px-8 py-3 bg-white text-black font-black uppercase tracking-widest rounded hover:bg-gray-200 transition-colors"
              >
                Collect & Continue
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}