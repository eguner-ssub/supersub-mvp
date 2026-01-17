import React from 'react';
import { useGame } from '../../context/GameContext';
import { getCardsByStatus } from '../../data/mockInventory';

const ViewDeck = () => {
    const { userProfile } = useGame();
    const availableCards = getCardsByStatus('AVAILABLE');

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

    return (
        <div className="h-full overflow-y-auto p-6">
            {/* Kit Bag Header */}
            <div className="mb-6 text-center">
                <h2 className="text-3xl font-black text-white uppercase tracking-tight">
                    Kit Bag
                </h2>
                <p className="text-gray-400 text-sm mt-1">Your Available Cards</p>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
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

            {/* Summary */}
            <div className="mt-8 text-center">
                <p className="text-gray-400 text-sm">
                    Total Cards: <span className="text-white font-bold">{userProfile?.inventory?.length || 0}</span>
                </p>
            </div>
        </div>
    );
};

export default ViewDeck;
