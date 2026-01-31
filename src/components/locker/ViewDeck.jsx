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

            {/* REMOVED: "Kit Bag" Header */}
            {/* ADDED: Subtle label for the section */}
            <div className="mb-4 flex items-center gap-2 opacity-60">
                <div className="h-[1px] flex-1 bg-white/50"></div>
                <span className="text-white font-mono text-[10px] uppercase tracking-[0.2em]">Available Cards</span>
                <div className="h-[1px] flex-1 bg-white/50"></div>
            </div>

            {/* GRID: Reduced gap-y-8 to gap-4 */}
            <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
                {cardTypes.map((card) => {
                    const count = getCardCount(card.id);
                    const hasCards = count > 0;

                    return (
                        <div key={card.id} className="relative group transition-transform duration-200 active:scale-95">

                            {/* CARD COMPONENT */}
                            <div className={`${hasCards ? 'opacity-100 drop-shadow-2xl' : 'opacity-40 grayscale contrast-125'}`}>
                                <CardBase
                                    type={card.id}
                                    label={card.label}
                                    status="generic"
                                />
                            </div>

                            {/* BADGE: NEW DESIGN (Tag Top Right) */}
                            {hasCards && (
                                <div className="absolute top-3 right-3 z-30">
                                    <div className="bg-yellow-500 text-black font-black font-mono text-[10px] px-2 py-0.5 rounded-md border border-black/20 shadow-lg flex items-center gap-1">
                                        <span>x</span>
                                        <span className="text-sm">{count}</span>
                                    </div>
                                </div>
                            )}

                            {/* EMPTY STATE */}
                            {!hasCards && (
                                <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                                    <div className="bg-black/60 backdrop-blur-[2px] px-3 py-1 rounded text-[10px] font-bold text-white/70 uppercase border border-white/10">
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
