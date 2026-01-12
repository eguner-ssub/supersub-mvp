import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { PenTool } from 'lucide-react';
import MobileLayout from '../components/MobileLayout';

const Onboarding = () => {
  const [clubName, setClubName] = useState('');
  const { createProfile } = useGame();
  const navigate = useNavigate();

  const handleSignContract = () => {
    if (clubName.trim()) {
      createProfile(clubName.trim());
      navigate('/dashboard');
    }
  };

  return (
    <MobileLayout>
      <div className="bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-gray-700">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-500/20 rounded-full mb-4">
            <PenTool className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to SuperSub</h1>
          <p className="text-gray-300">Create your football club</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Club Name
            </label>
            <input
              type="text"
              value={clubName}
              onChange={(e) => setClubName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSignContract()}
              placeholder="Enter your club name"
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-lg"
              autoFocus
            />
          </div>

          <button
            onClick={handleSignContract}
            disabled={!clubName.trim()}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-lg transition-colors shadow-lg"
          >
            Sign Contract
          </button>

          <div className="bg-gray-700/50 rounded-lg p-4 text-sm text-gray-300">
            <p className="font-semibold mb-2">Starting Package:</p>
            <ul className="space-y-1">
              <li>💰 500 Coins</li>
              <li>⚡ 3 Energy</li>
              <li>🃏 3 Starter Cards</li>
            </ul>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
};

export default Onboarding;
