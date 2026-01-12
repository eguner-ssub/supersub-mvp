import React from 'react';
import { useNavigate } from 'react-router-dom'; 
import { useGame } from '../context/GameContext'; 
// 1. CHANGED: Imported 'Cone' instead of 'Dumbbell'
import { Zap, Coins, Cone, Trophy, ShoppingBag } from 'lucide-react'; 

export default function Dashboard() {
  const navigate = useNavigate(); 
  const { userProfile } = useGame(); 

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

  const getCardCount = (cardId) => {
    if (!userData.inventory) return 0;
    return userData.inventory.filter(item => item === cardId).length;
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
          {/* 2. CHANGED: Swapped Dumbbell for Cone */}
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

      {/* 2. THE CARD SHELF */}
      <div className="absolute bottom-0 w-full z-30">
        
        {/* Shelf background */}
        <div className="w-full bg-gradient-to-t from-gray-900 via-black to-transparent pt-8 pb-4">
          
          {/* HEADER */}
          <div className="text-center mb-2">
            <h3 className="text-[#F5C546] font-bold text-xs tracking-[0.2em] uppercase drop-shadow-md">
              Your Card Deck
            </h3>
          </div>

          {/* CARD ROW */}
          <div className="flex justify-center items-end gap-2 px-2 h-28">
            {cardTypes.map((card) => {
              const count = getCardCount(card.id);
              const isActive = count > 0;

              return (
                <div key={card.id} className={`flex flex-col items-center gap-1 transition-all duration-300 ${isActive ? 'opacity-100 hover:-translate-y-2' : 'opacity-40 grayscale'}`}>
                  
                  {/* CARD IMAGE CONTAINER */}
                  <div className={`relative w-20 h-24 rounded-md overflow-hidden shadow-lg ${isActive ? 'shadow-yellow-500/20' : ''}`}>
                    
                    {/* Object Contain to fix Aspect Ratio */}
                    <img 
                      src={card.img} 
                      alt={card.label}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.target.style.display = 'none'; 
                        e.target.parentElement.style.backgroundColor = '#333'; 
                      }}
                    />
                    
                    {/* Glow effect for active cards */}
                    {isActive && <div className="absolute inset-0 ring-1 ring-yellow-400/50 rounded-md"></div>}
                  </div>

                  {/* COUNT LABEL */}
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${isActive ? 'text-white' : 'text-gray-500'}`}>
                    {count} Cards
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}