import React from 'react';
import { useGame } from '../../shared/context/GameContext';
import CardBase from '../../shared/ui/CardBase';

/**
 * Returns a label + urgency level for a card's expiry date.
 * Expiry is always Monday 23:59 UTC.
 *   red   — today is Monday (expiry day)
 *   amber — today is Saturday or Sunday (1–2 days out)
 *   normal — earlier in the week
 */
function timeUntilExpiry(isoDate) {
    if (!isoDate) return null;
    const expiry = new Date(isoDate);
    const now = new Date();
    if (expiry <= now) return null;

    const todayDay = now.getDay(); // 0=Sun, 1=Mon, …, 6=Sat
    const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

    let urgency = 'normal';
    if (todayDay === 1) urgency = 'red';
    else if (todayDay === 0 || todayDay === 6) urgency = 'amber';

    let label;
    if (todayDay === 1) label = 'exp. today';
    else if (daysLeft <= 1) label = 'exp. tmrw';
    else label = 'exp. Mon';

    return { label, urgency };
}

const ViewDeck = () => {
    const { userProfile, expiryMap } = useGame();

    const cardTypes = [
        { id: 'c_match_result', label: 'Match Result' },
        { id: 'c_total_goals', label: 'Total Goals' },
        { id: 'c_player_score', label: 'Player Score' },
        { id: 'c_supersub', label: 'Super Sub' },
    ];

    const getCardCount = (cardId) => userProfile?.inventoryMap?.[cardId] || 0;

    const totalItems = Object.values(userProfile?.inventoryMap || {}).reduce((acc, count) => acc + count, 0);

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="mb-4 flex items-center gap-2 opacity-60">
                <div className="h-[1px] flex-1 bg-white/50"></div>
                <span className="text-white font-mono text-[10px] uppercase tracking-[0.2em]">Available Cards</span>
                <div className="h-[1px] flex-1 bg-white/50"></div>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
                {cardTypes.map((card) => {
                    const count = getCardCount(card.id);
                    const hasCards = count > 0;
                    const expiryChip = hasCards ? timeUntilExpiry(expiryMap[card.id]) : null;

                    return (
                        <div key={card.id} className="relative group transition-transform duration-200 active:scale-95">
                            <div className={`${hasCards ? 'opacity-100 drop-shadow-2xl' : 'opacity-40 grayscale contrast-125'}`}>
                                <CardBase
                                    type={card.id}
                                    label={card.label}
                                    status="generic"
                                />
                            </div>

                            {hasCards && (
                                <div className="absolute top-3 right-3 z-30">
                                    <div className="bg-yellow-500 text-black font-black font-mono text-[10px] px-2 py-0.5 rounded-md border border-black/20 shadow-lg flex items-center gap-1">
                                        <span>x</span>
                                        <span className="text-sm">{count}</span>
                                    </div>
                                </div>
                            )}

                            {hasCards && expiryChip && (
                                <div className="absolute bottom-3 left-0 right-0 flex justify-center z-30 pointer-events-none">
                                    <div className={`text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                                        expiryChip.urgency === 'red'
                                            ? 'bg-red-500/20 border-red-400/50 text-red-300'
                                            : expiryChip.urgency === 'amber'
                                                ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                                                : 'bg-white/10 border-white/20 text-white/50'
                                    }`}>
                                        {expiryChip.label}
                                    </div>
                                </div>
                            )}

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

            <div className="mt-8 text-center">
                <p className="text-gray-400 text-sm">
                    Total Cards: <span className="text-white font-bold">{totalItems}</span>
                </p>
            </div>
        </div>
    );
};

export default ViewDeck;