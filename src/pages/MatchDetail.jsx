import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap } from 'lucide-react';

const MatchDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- MOCK DATA ---
  const userData = { 
    energy: 2, 
    maxEnergy: 3, 
    inventory: ['c_match_result', 'c_total_goals', 'c_player_score'] 
  };

  const mockMatchData = {
    fixture: {
      id: 1208240,
      date: "2025-01-25T16:00:00+00:00",
      venue: { name: "Etihad Stadium" },
      status: { short: "NS" } 
    },
    teams: {
      home: { id: 50, name: "Man City", logo: "https://media.api-sports.io/football/teams/50.png" },
      away: { id: 49, name: "Chelsea", logo: "https://media.api-sports.io/football/teams/49.png" }
    }
  };

  const cardTypes = [
    { id: 'c_match_result', label: 'Match Result', img: '/cards/card_match_result.png' },
    { id: 'c_total_goals', label: 'Total Goals', img: '/cards/card_total_goals.png' },
    { id: 'c_player_score', label: 'Player Score', img: '/cards/card_player_score.png' },
    { id: 'c_supersub', label: 'Super Sub', img: '/cards/card_supersub.png' }, 
  ];

  const getCardCount = (cardId) => {
    return userData.inventory.filter(item => item === cardId).length;
  };

  const handleImageError = (e) => {
    e.target.style.opacity = 0.5; 
  };

  useEffect(() => {
    setTimeout(() => {
      setMatch(mockMatchData);
      setLoading(false);
    }, 500);
  }, []);

  const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const formatDate = (d) => new Date(d).toLocaleDateString([], { weekday: 'long' });

  return (
    <div className="w-full h-screen relative font-sans select-none overflow-hidden bg-gray-900">
      
      {/* 1. BACKGROUND IMAGE */}
      <div className="absolute inset-0 z-0">
        <img 
            src="/bg-dugout.png" 
            alt="Tunnel Background" 
            className="w-full h-full object-cover opacity-100" // Increased opacity for better visibility
            onError={(e) => {
                e.target.onerror = null; 
                e.target.src = "/bg-dugout.jpg";
            }}
        />
        {/* Subtle Darkening at top/bottom for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80"></div>
      </div>

      {/* 2. TOP NAVIGATION (Back & Energy) */}
      <div className="absolute top-0 w-full px-4 pt-12 flex justify-between items-center z-[60] pointer-events-none">
        <button
          onClick={() => navigate('/match-hub')}
          className="flex items-center justify-center w-10 h-10 bg-black/50 backdrop-blur-md border border-white/20 rounded-full text-white hover:bg-black/70 active:scale-95 transition-all shadow-lg pointer-events-auto"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 shadow-lg pointer-events-auto">
          <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          <span className="text-white font-bold text-sm">
            {userData.energy}/{userData.maxEnergy}
          </span>
        </div>
      </div>

      {loading && (
         <div className="flex-1 flex items-center justify-center h-full z-50 relative">
           <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
         </div>
      )}

      {!loading && match && (
        <>
          {/* 3. SCOREBOARD HEADER (Moved Down) */}
          <div className="absolute top-24 left-0 w-full z-40 px-4">
              <div className="relative h-20 w-full bg-gradient-to-b from-gray-100 via-white to-gray-300 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-start justify-between px-3 pt-3 pb-1 border-b-4 border-[#C0A062] rounded-xl">
                  
                  {/* Home Team */}
                  <div className="flex items-center gap-2 w-1/3 mt-2">
                      <img src={match.teams.home.logo} className="w-9 h-9 object-contain drop-shadow-md" alt="Home" />
                      <span className="text-gray-900 font-black text-xs uppercase tracking-tight leading-none truncate">
                          {match.teams.home.name}
                      </span>
                  </div>

                  {/* Center Time (Trapezoid) */}
                  <div className="absolute left-1/2 -translate-x-1/2 -top-1 h-24 w-1/3 pointer-events-none filter drop-shadow-lg">
                      <div className="w-full h-full bg-[#1a1a1a] clip-path-trapezoid flex flex-col items-center justify-center pt-6 border-t-2 border-[#C0A062] shadow-inner">
                           
                           <div className="text-[9px] text-[#F5C546] font-bold uppercase tracking-[0.2em] mb-0.5">
                              KICKOFF
                           </div>
                           <div className="text-white font-black text-lg leading-none uppercase">
                              {formatDate(match.fixture.date)}
                           </div>
                           <div className="text-xl text-white font-mono leading-none tracking-widest mt-1">
                              {formatTime(match.fixture.date)}
                           </div>
                      </div>
                  </div>

                  {/* Away Team */}
                  <div className="flex items-center justify-end gap-2 w-1/3 mt-2">
                      <span className="text-gray-900 font-black text-xs uppercase tracking-tight leading-none text-right truncate">
                          {match.teams.away.name}
                      </span>
                      <img src={match.teams.away.logo} className="w-9 h-9 object-contain drop-shadow-md" alt="Away" />
                  </div>
              </div>
          </div>

          {/* 4. 3D WALL LOGOS (Adjusted Perspective) */}
          <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
              {/* Left Wall Logo (Home) - Flattened to fit wall angle */}
              <div 
                  className="absolute top-[45%] left-[8%] w-40 h-40 opacity-70"
                  style={{ transform: 'perspective(800px) rotateY(60deg) skewY(-10deg) scale(0.9)' }}
              >
                  <img src={match.teams.home.logo} className="w-full h-full object-contain grayscale brightness-125 contrast-125 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]" alt="" />
              </div>

              {/* Right Wall Logo (Away) - Flattened to fit wall angle */}
              <div 
                  className="absolute top-[45%] right-[8%] w-40 h-40 opacity-70"
                  style={{ transform: 'perspective(800px) rotateY(-60deg) skewY(10deg) scale(0.9)' }}
              >
                  <img src={match.teams.away.logo} className="w-full h-full object-contain grayscale brightness-125 contrast-125 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]" alt="" />
              </div>
          </div>

          {/* 5. THE SHELF (New Structure) */}
          <div className="absolute bottom-0 w-full z-30">
              
              {/* Cards Sitting ON the Shelf */}
              <div className="w-full flex justify-center items-end gap-3 pb-4 px-4 z-40 relative translate-y-2">
                  {cardTypes.map((card) => {
                  const count = getCardCount(card.id);
                  const isActive = count > 0;

                  return (
                      <div key={card.id} className={`group relative flex flex-col items-center gap-1 transition-all duration-300 ${isActive ? 'opacity-100 hover:-translate-y-4' : 'opacity-40 grayscale'}`}>
                          
                          {/* Card Image */}
                          <div className={`relative w-[4.5rem] h-24 rounded-lg transition-all transform origin-bottom ${isActive ? 'shadow-[0_10px_20px_rgba(0,0,0,0.5)]' : ''}`}>
                              <img 
                                src={card.img} 
                                alt={card.label}
                                className="w-full h-full object-contain drop-shadow-2xl"
                                onError={handleImageError} 
                              />
                              {isActive && (
                                 <div className="absolute -top-2 -right-2 bg-[#F5C546] text-black text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-black shadow-lg z-10">
                                   {count}
                                 </div>
                              )}
                          </div>

                          <span className={`text-[8px] font-bold uppercase tracking-wider text-center max-w-[4rem] leading-tight ${isActive ? 'text-white' : 'text-gray-500'} drop-shadow-md`}>
                              {card.label}
                          </span>
                      </div>
                  );
                  })}
              </div>

              {/* THE PHYSICAL SHELF */}
              <div className="w-full h-12 bg-[#1a1a1a] relative z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.8)]">
                  {/* Top Edge Highlight (The Ledge) */}
                  <div className="absolute top-0 w-full h-2 bg-gradient-to-b from-[#555] to-[#222] border-t border-white/20"></div>
                  {/* Front Face Gradient */}
                  <div className="w-full h-full bg-gradient-to-b from-[#222] to-black opacity-90"></div>
                  {/* Text on the Shelf */}
                  <div className="absolute top-4 w-full text-center">
                    <span className="text-[#666] text-[9px] font-bold uppercase tracking-[0.3em] text-shadow-sm">
                        Inventory Deck
                    </span>
                  </div>
              </div>
          </div>
        </>
      )}

      <style>{`
        .clip-path-trapezoid {
          clip-path: polygon(0 0, 100% 0, 85% 100%, 15% 100%);
        }
      `}</style>
    </div>
  );
};

export default MatchDetail;