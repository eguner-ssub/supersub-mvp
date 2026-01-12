import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { ArrowLeft, Settings as SettingsIcon, Plus } from 'lucide-react';
import MobileLayout from '../components/MobileLayout';

const Settings = () => {
  const { refillEnergy, addCard } = useGame(); 
  const navigate = useNavigate();

  const handleRefillEnergy = () => {
    refillEnergy();
    alert('Energy Refilled to Max');
  };

  const handleResetSaveData = () => {
    if (confirm('Are you sure you want to reset all save data? This cannot be undone.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  // REALITY CHECK: Updated to match Dashboard.jsx exactly
  const cardTypes = [
    { id: 'c_match_result', label: 'Match Result' },
    { id: 'c_total_goals', label: 'Total Goals' },
    { id: 'c_player_score', label: 'Player Score' },
    { id: 'c_supersub', label: 'Super Sub' }, // UPDATED
  ];

  const handleAddCard = (card) => {
    addCard(card.id);
    console.log(`Added ${card.label}`);
    // Optional: Visual feedback
    alert(`Added 1x ${card.label} to Inventory`);
  };

  return (
    <MobileLayout>
      <div className="bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border border-gray-700 h-full overflow-y-auto">
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-4 flex items-center gap-2 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-3 mb-6">
          <SettingsIcon className="w-6 h-6 text-white" />
          <h1 className="text-2xl font-bold text-white">Settings</h1>
        </div>

        <div className="space-y-6">
          
          {/* DEVELOPER TOOLS SECTION */}
          <div className="border-2 border-red-500/50 bg-red-500/5 rounded-xl p-4 space-y-4">
            <h2 className="text-sm font-bold text-red-400 uppercase tracking-widest mb-4 border-b border-red-500/20 pb-2">
              Developer Console
            </h2>
            
            {/* Energy Tools */}
            <div className="space-y-2">
              <p className="text-xs text-gray-400 font-bold uppercase">Game State</p>
              <button
                onClick={handleRefillEnergy}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-700/50 hover:bg-gray-700 border border-white/5 hover:border-white/20 text-white font-semibold rounded-lg transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">⚡</span>
                  <span>Refill Energy</span>
                </div>
              </button>

              <button
                onClick={handleResetSaveData}
                className="w-full flex items-center justify-between px-4 py-3 bg-red-900/20 hover:bg-red-900/40 border border-red-500/30 hover:border-red-500 text-red-200 font-semibold rounded-lg transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🗑️</span>
                  <span>Wipe Save Data</span>
                </div>
              </button>
            </div>

            {/* CARD INJECTOR */}
            <div className="space-y-2 pt-2">
              <p className="text-xs text-gray-400 font-bold uppercase">Inject Cards (Inventory)</p>
              <div className="grid grid-cols-2 gap-2">
                {cardTypes.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => handleAddCard(card)}
                    className="flex flex-col items-center justify-center gap-1 p-3 bg-gray-700/50 hover:bg-blue-600 border border-white/5 hover:border-blue-400 rounded-lg transition-all active:scale-95 group"
                  >
                    <Plus className="w-4 h-4 text-gray-400 group-hover:text-white" />
                    <span className="text-xs font-medium text-gray-300 group-hover:text-white text-center">
                      {card.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </MobileLayout>
  );
};

export default Settings;