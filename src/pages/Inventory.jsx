import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { ArrowLeft, Package } from 'lucide-react';
import MobileLayout from '../components/MobileLayout';
import gameData from '../data/gameData.json';

const Inventory = () => {
  const { userProfile } = useGame();
  const navigate = useNavigate();
  const cardTypes = gameData.cardTypes;

  if (!userProfile) return null;

  // Count cards by type
  const cardCounts = {};
  userProfile.inventory.forEach((cardId) => {
    cardCounts[cardId] = (cardCounts[cardId] || 0) + 1;
  });

  const inventoryCards = Object.entries(cardCounts).map(([cardId, count]) => {
    const cardType = cardTypes.find((c) => c.id === cardId);
    return cardType ? { ...cardType, count } : null;
  }).filter(Boolean);

  return (
    <MobileLayout>
      <div className="bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border border-gray-700">
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-4 flex items-center gap-2 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-3 mb-6">
          <Package className="w-6 h-6 text-emerald-500" />
          <h1 className="text-2xl font-bold text-white">Inventory</h1>
        </div>

        {inventoryCards.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No cards in inventory</p>
            <p className="text-gray-500 text-sm mt-2">Complete Training to earn cards!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {inventoryCards.map((card) => (
              <div
                key={card.id}
                className="bg-gray-700/50 border border-gray-600 rounded-lg p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-semibold">{card.name}</p>
                    <p className="text-gray-400 text-sm">{card.desc}</p>
                  </div>
                  <div className="bg-emerald-500/20 border border-emerald-500 rounded-full px-3 py-1">
                    <span className="text-emerald-400 font-semibold">x{card.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-gray-700">
          <p className="text-center text-gray-400 text-sm">
            Total Cards: {userProfile.inventory.length}
          </p>
        </div>
      </div>
    </MobileLayout>
  );
};

export default Inventory;
