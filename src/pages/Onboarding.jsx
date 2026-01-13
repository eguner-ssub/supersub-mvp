import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { ArrowRight, PenTool } from 'lucide-react';
import MobileLayout from '../components/MobileLayout';

const Onboarding = () => {
  const [managerName, setManagerName] = useState('');
  const [showSigningBonus, setShowSigningBonus] = useState(false);
  const { createProfile } = useGame();
  const navigate = useNavigate();

  // Get today's date for the contract "Date" field
  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleSignContract = () => {
    if (managerName.trim()) {
      createProfile(managerName.trim());
      setShowSigningBonus(true);
    }
  };

  const handleGetToWork = () => {
    navigate('/dashboard', { state: { firstLogin: true } });
  };

  return (
    <MobileLayout>
      {/* BACKGROUND */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{ backgroundImage: "url('/bg-clubroom.png')" }}
      >
        <div className="absolute inset-0 bg-black/50"></div>
      </div>

      <div className="relative z-10 h-full flex flex-col items-center justify-center p-6">
        
        {!showSigningBonus ? (
          /* --- THE CONTRACT --- */
          <div className="w-full max-w-md bg-[#f4f1ea] text-gray-900 rounded-sm shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden relative">
            
            {/* Top Border / Letterhead decoration */}
            <div className="h-4 bg-gray-800 w-full"></div>

            <div className="p-8">
              {/* Header */}
              <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
                <h1 className="text-2xl font-serif font-bold uppercase tracking-widest text-gray-900">
                  Managerial Contract
                </h1>
                <p className="text-xs font-serif text-gray-600 mt-1">
                  Date: {today}
                </p>
              </div>

              {/* Legal Text Body */}
              <div className="space-y-4 text-sm font-serif leading-relaxed text-justify mb-8">
                <p>
                  <strong>1. LIABILITY:</strong> By signing this document, the undersigned agrees to take full responsibility for tactical failures, player tantrums, and financial ruin. The board reserves the right to terminate this contract immediately if match results are not satisfactory.
                </p>
                
                <p>
                  <strong>2. COMPENSATION:</strong> Upon execution of this agreement, the undersigned Manager shall receive a one-time signing bonus of <span className="font-bold border-b border-gray-400">500 Coins</span> to commence club operations.
                </p>

                <p className="italic text-center mt-4 text-gray-500">
                  "Good luck, you'll need it."
                </p>
              </div>

              {/* Signature Section */}
              <div className="space-y-4">
                <div className="relative">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                    Manager Name (Signature)
                  </label>
                  <input
                    type="text"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSignContract()}
                    placeholder="ENTER NAME HERE"
                    className="w-full px-4 py-3 bg-[#1a1d21] border border-gray-800 rounded text-emerald-400 font-mono text-lg text-center uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-600"
                    autoFocus
                  />
                </div>

                <button
                  onClick={handleSignContract}
                  disabled={!managerName.trim()}
                  className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold uppercase tracking-widest rounded shadow-md transition-all flex items-center justify-center gap-2 border border-emerald-900"
                >
                  <PenTool className="w-4 h-4" />
                  Create Club
                </button>
              </div>

            </div>

            {/* Bottom watermark/footer */}
            <div className="bg-gray-100 p-2 text-center">
               <p className="text-[10px] text-gray-400 font-serif uppercase tracking-widest">Official Club Document • Do Not Distribute</p>
            </div>
          </div>
        ) : (
          /* --- SIGNING BONUS POPUP (Unchanged logic, just consistent styling) --- */
          <div className="w-full max-w-sm bg-gray-900 border-2 border-emerald-600 rounded-xl p-6 shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-1 uppercase tracking-wider">Welcome Aboard</h2>
              <div className="h-1 w-16 bg-emerald-500 mx-auto rounded"></div>
            </div>

            <div className="bg-black/40 rounded-lg p-4 mb-6 border border-gray-700">
              <p className="text-gray-400 text-xs uppercase tracking-widest text-center mb-4">Signing Bonus Received</p>
              <ul className="space-y-3">
                <li className="flex items-center justify-between text-white border-b border-gray-700 pb-2">
                  <span className="flex items-center gap-2 font-medium">💰 Coins</span>
                  <span className="text-yellow-400 font-bold font-mono">+500</span>
                </li>
                <li className="flex items-center justify-between text-white border-b border-gray-700 pb-2">
                  <span className="flex items-center gap-2 font-medium">⚡ Energy</span>
                  <span className="text-blue-400 font-bold font-mono">+3</span>
                </li>
                <li className="flex items-center justify-between text-white">
                  <span className="flex items-center gap-2 font-medium">🃏 Starter Cards</span>
                  <span className="text-emerald-400 font-bold font-mono">+3</span>
                </li>
              </ul>
            </div>

            <button
              onClick={handleGetToWork}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg uppercase tracking-widest rounded transition-colors flex items-center justify-center gap-2 shadow-lg"
            >
              Get to Work <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default Onboarding;