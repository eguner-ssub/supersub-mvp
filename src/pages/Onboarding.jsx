import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { ArrowRight, PenTool, CheckCircle, Coins, Zap, Layers } from 'lucide-react';
import MobileLayout from '../components/MobileLayout';

const Onboarding = () => {
  const [managerName, setManagerName] = useState('');
  
  // FIX 1: REMOVED local state 'showSigningBonus'. 
  // We now derive the view directly from the profile.
  const { createProfile, userProfile, loading } = useGame();
  const navigate = useNavigate();

  // FIX 2: DERIVED STATE
  // If the profile has a club_name, we are in "Bonus Mode" automatically.
  // This persists even if the page refreshes or bounces.
  const hasSignedContract = !!userProfile?.club_name;

  // Tactical Carbon Fiber CSS texture
  const carbonStyle = {
    background: `radial-gradient(circle, #333 1px, transparent 1px), radial-gradient(circle, #333 1px, transparent 1px), #1a1a1a`,
    backgroundSize: '4px 4px',
    backgroundPosition: '0 0, 2px 2px',
  };

  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleSignContract = async () => {
    if (managerName.trim()) {
      // This will update 'userProfile' in context, triggering a re-render
      // which switches 'hasSignedContract' to true instantly.
      await createProfile(managerName.trim());
    }
  };

  const handleGetToWork = () => {
    // Navigate with state to trigger the Bag Animation on Dashboard
    navigate('/dashboard', { state: { firstLogin: true } });
  };

  // Prevent flash while loading
  if (loading) return null;

  return (
    <MobileLayout>
      {/* DYNAMIC BACKGROUND */}
      <div 
        className={`fixed inset-0 bg-cover bg-center bg-no-repeat z-0 transition-all duration-1000 ${hasSignedContract ? 'scale-110 blur-sm' : 'scale-100'}`}
        style={{ backgroundImage: "url('/bg-clubroom.webp')" }}
      >
        <div className={`absolute inset-0 bg-black transition-opacity duration-1000 ${hasSignedContract ? 'opacity-80' : 'opacity-40'}`}></div>
      </div>

      <div className="relative z-10 h-full flex flex-col items-center justify-center p-6">
        
        {!hasSignedContract ? (
          /* --- STATE 1: THE CONTRACT (Show only if NO club name) --- */
          <div className="w-full max-w-md bg-[#f4f1ea] text-gray-900 rounded-sm shadow-[0_0_50px_rgba(0,0,0,0.7)] overflow-hidden relative animate-in slide-in-from-bottom-8 duration-700">
            
            <div className="h-3 bg-[#1a1a1a] w-full flex items-center justify-center">
                <div className="w-1/3 h-[1px] bg-gold-500/50"></div>
            </div>

            <div className="p-8">
              <div className="text-center border-b-2 border-gray-900 pb-5 mb-6">
                <h1 className="text-3xl font-serif font-black uppercase tracking-widest text-gray-900">
                  Managerial Contract
                </h1>
                <p className="text-xs font-serif text-gray-500 mt-2 uppercase tracking-wide">
                  Effective Date: <span className="text-gray-900 font-bold">{today}</span>
                </p>
              </div>

              <div className="space-y-5 text-sm font-serif leading-relaxed text-justify mb-8 text-gray-800">
                <p>
                  <strong>1. LIABILITY:</strong> By executing this agreement, the undersigned Manager accepts full accountability for tactical operations, squad morale, and economic stability.
                </p>
                <p>
                  <strong>2. COMPENSATION:</strong> Upon signature, the Club shall release a starting capital of <span className="font-bold border-b border-gray-800">500 Coins</span> and standard tactical provisions.
                </p>
              </div>

              <div className="space-y-6 mt-8">
                <div className="relative group">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 text-center">
                    Sign Here
                  </label>
                  <input
                    type="text"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSignContract()}
                    placeholder="ENTER SURNAME"
                    className="w-full px-4 py-4 bg-[#e8e4dc] border-2 border-gray-300 rounded-lg text-gray-900 font-serif font-bold text-2xl text-center uppercase tracking-widest focus:outline-none focus:border-gray-900 focus:bg-white transition-all placeholder:text-gray-300"
                    autoFocus
                  />
                  <PenTool className="absolute right-4 top-10 w-5 h-5 text-gray-400 opacity-50" />
                </div>

                <button
                  onClick={handleSignContract}
                  disabled={!managerName.trim()}
                  className="group relative w-full h-[64px] rounded-full p-[2px] transition-all active:scale-95 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(180deg, #cccccc 0%, #333333 100%)' }} 
                >
                  <div 
                    className="w-full h-full rounded-full flex items-center justify-center gap-3 border-[2px] border-green-600/50 relative z-10" 
                    style={carbonStyle}
                  >
                    <div className="absolute inset-0 rounded-full bg-green-500/5 group-hover:bg-green-500/10 transition-colors"></div>
                    <PenTool className="w-5 h-5 text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                    <span className="text-white font-black text-xl tracking-widest italic drop-shadow-md">SIGN CONTRACT</span>
                  </div>
                </button>
              </div>
            </div>

            <div className="bg-[#ebe7e0] p-2 text-center border-t border-gray-200">
               <p className="text-[9px] text-gray-400 font-serif uppercase tracking-[0.3em] font-bold">Official Club Document</p>
            </div>
          </div>
        ) : (
          /* --- STATE 2: THE WELCOME BONUS (Show if Club Name Exists) --- */
          <div className="w-full max-w-sm relative animate-in fade-in zoom-in duration-500">
            <div className="absolute inset-0 bg-green-500/20 blur-[60px] rounded-full"></div>

            <div 
              className="relative bg-[#1a1a1a] rounded-2xl p-1 border border-white/10 shadow-2xl overflow-hidden"
              style={carbonStyle}
            >
              <div className="bg-gradient-to-b from-white/5 to-transparent p-6 rounded-xl">
                
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center p-3 bg-green-500/10 rounded-full mb-4 ring-1 ring-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </div>
                  <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase drop-shadow-lg">
                    Welcome Aboard
                  </h2>
                  <p className="text-green-400 font-bold tracking-widest text-xs mt-2 uppercase">Contract Ratified</p>
                </div>

                <div className="bg-black/40 rounded-xl p-5 mb-8 border border-white/5 space-y-4 shadow-inner">
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] text-center mb-2">Signing Bonus Issued</p>
                  
                  <div className="flex items-center justify-between p-2 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <Coins className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                      <span className="text-gray-300 font-bold uppercase text-sm tracking-wider">Capital</span>
                    </div>
                    <span className="text-yellow-400 font-mono font-bold text-lg drop-shadow-md">+500</span>
                  </div>

                  <div className="flex items-center justify-between p-2 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <Zap className="w-5 h-5 text-blue-400 fill-blue-400" />
                      <span className="text-gray-300 font-bold uppercase text-sm tracking-wider">Energy</span>
                    </div>
                    <span className="text-blue-400 font-mono font-bold text-lg drop-shadow-md">+3</span>
                  </div>

                  <div className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-3">
                      <Layers className="w-5 h-5 text-purple-400" />
                      <span className="text-gray-300 font-bold uppercase text-sm tracking-wider">Scouts</span>
                    </div>
                    <span className="text-purple-400 font-mono font-bold text-lg drop-shadow-md">+3</span>
                  </div>
                </div>

                {/* GET TO WORK BUTTON */}
                <button
                  onClick={handleGetToWork}
                  className="group relative w-full h-[68px] rounded-full p-[2px] transition-all active:scale-95 shadow-[0_0_30px_rgba(34,197,94,0.3)] hover:shadow-[0_0_45px_rgba(34,197,94,0.5)]"
                  style={{ background: 'linear-gradient(180deg, #D4AF37 0%, #1a1a1a 100%)' }}
                >
                  <div 
                    className="w-full h-full rounded-full flex items-center justify-center gap-3 border-[2px] border-green-500/50 relative z-10" 
                    style={carbonStyle}
                  >
                    <span className="text-white font-black text-xl tracking-widest italic uppercase">GET TO WORK</span>
                    <ArrowRight className="w-6 h-6 text-green-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default Onboarding;