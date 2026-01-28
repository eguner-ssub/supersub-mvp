import React from 'react';
import { useGame } from '../../context/GameContext';
import { getCardsByStatus } from '../../data/mockInventory';
import CardBase from '../CardBase';

const ViewDeck = () => {
    const { userProfile } = useGame();
    const availableCards = getCardsByStatus('AVAILABLE');

    const cardTypes = [
        { id: 'c_match_result', label: 'Match Result' },
        { id: 'c_total_goals', label: 'Total Goals' },
        { id: 'c_player_score', label: 'Player Score' },
        { id: 'c_supersub', label: 'Super Sub' },
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

            {/* Cards Grid - STRIPPED DOWN TO MATCH CARDLAB */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 max-w-2xl mx-auto">
                {cardTypes.map((card) => {
                    const count = getCardCount(card.id);
                    const hasCards = count > 0;

                    return (
                        <div key={card.id} className="relative group">

                            {/* THE NAKED COMPONENT - No wrappers, no borders, no aspect ratio conflicts */}
                            <div className={hasCards ? 'opacity-100' : 'opacity-40 grayscale contrast-125'}>
                                <CardBase
                                    type={card.id}
                                    label={card.label}
                                    status="generic"
                                />
                            </div>

                            {/* QUANTITY BADGE (Overlay) - Floats on top */}
                            {hasCards && (
                                <div className="absolute -top-2 -right-2 z-30">
                                    <div className="bg-yellow-500 text-black font-black font-mono text-xs w-6 h-6 flex items-center justify-center rounded-full border-2 border-black shadow-lg">
                                        {count}
                                    </div>
                                </div>
                            )}

                            {/* Empty State Badge */}
                            {!hasCards && (
                                <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                                    <div className="bg-black/80 px-3 py-1 rounded text-[10px] font-bold text-white/50 uppercase border border-white/10">
                                        Empty
                                    </div>
                                </div>
                            )}

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
