import React, { useEffect } from 'react'; // Added useEffect
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext'; // Added GameContext
import { LogIn, UserPlus } from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();
  const { userProfile } = useGame(); // Get the profile

  // --- AUTO-REDIRECT LOGIC ---
  // If the user is already logged in (has a club name), kick them straight to the game.
  useEffect(() => {
    if (userProfile?.club_name) {
      navigate('/dashboard', { replace: true });
    }
  }, [userProfile, navigate]);

  // Tactical Carbon Fiber CSS texture
  const carbonStyle = {
    background: `radial-gradient(circle, #333 1px, transparent 1px), radial-gradient(circle, #333 1px, transparent 1px), #1a1a1a`,
    backgroundSize: '4px 4px',
    backgroundPosition: '0 0, 2px 2px',
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-6 overflow-hidden">
      
      {/* BACKGROUND IMAGE */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-105"
        style={{ backgroundImage: "url('/bg-benchview.webp')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/80 backdrop-blur-[1px]"></div>
      </div>

      <div className="relative z-10 max-w-md w-full flex flex-col items-center text-center">
        
        {/* LOGO SECTION */}
        <div className="mb-16 animate-in fade-in slide-in-from-top-6 duration-1000">
          <div className="relative group">
            <div className="absolute inset-0 bg-green-500/20 blur-3xl rounded-full group-hover:bg-green-500/30 transition-all duration-700"></div>
            <img 
              src="/logo.webp" 
              alt="SUPERSUB Shield" 
              className="relative w-72 h-auto drop-shadow-[0_0_35px_rgba(34,197,94,0.4)] transition-transform duration-500 hover:scale-105"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-6 w-full flex flex-col items-center">
          
          <button
            onClick={() => navigate('/signup')}
            className="group relative w-full max-w-[300px] h-[68px] rounded-full p-[2px] transition-all active:scale-95 shadow-[0_0_30px_rgba(34,197,94,0.4)]"
            style={{ background: 'linear-gradient(180deg, #D4AF37 0%, #1a1a1a 100%)' }}
          >
            <div 
              className="w-full h-full rounded-full flex items-center justify-center gap-3 border-[1px] border-green-400/50" 
              style={carbonStyle}
            >
              <UserPlus className="w-5 h-5 text-green-400 group-hover:scale-110 transition-transform" />
              <span className="text-white font-black text-xl tracking-widest italic">JOIN THE SQUAD</span>
            </div>
          </button>

          <button
            onClick={() => navigate('/login')}
            className="group relative w-full max-w-[300px] h-[64px] rounded-full p-[2px] transition-all active:scale-95 shadow-lg"
            style={{ background: 'linear-gradient(180deg, #666 0%, #111 100%)' }}
          >
            <div 
              className="w-full h-full rounded-full flex items-center justify-center gap-3 border-[1px] border-white/10" 
              style={carbonStyle}
            >
              <LogIn className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
              <span className="text-gray-400 group-hover:text-white font-black text-lg tracking-widest italic transition-colors">LOGIN</span>
            </div>
          </button>
        </div>

      </div>
    </div>
  );
};

export default Landing;