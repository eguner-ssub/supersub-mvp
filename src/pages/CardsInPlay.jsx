import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Coins } from 'lucide-react';
import MobileLayout from '../components/MobileLayout';
import { mockCardsInPlay, getCardTypeDisplay, getCardTypeIcon } from '../data/mockInventory';

const CardsInPlay = () => {
    const navigate = useNavigate();

    return (
        <MobileLayout bgImage="/bg-dashboard.webp">
            <div className="w-full max-w-md h-full flex flex-col p-6 relative">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => navigate('/inventory')}
                        className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-bold">Back</span>
                    </button>
                    <h1 className="text-2xl font-black text-white uppercase tracking-wide">Cards in Play</h1>
                    <div className="w-16" /> {/* Spacer for centering */}
                </div>

                {/* Subtitle */}
                <p className="text-gray-400 text-sm mb-6 text-center">
                    Active predictions waiting for results
                </p>

                {/* Cards List */}
                <div className="flex-1 overflow-y-auto space-y-4">
                    {mockCardsInPlay.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <p className="text-gray-500 text-lg font-bold mb-2">No Active Bets</p>
                            <p className="text-gray-600 text-sm">Place predictions to see them here</p>
                        </div>
                    ) : (
                        mockCardsInPlay.map((card) => (
                            <div
                                key={card.id}
                                className="bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-4 hover:border-emerald-500/30 transition-all"
                            >
                                <div className="grid grid-cols-[1fr_auto_auto] gap-4 items-center">
                                    {/* Column 1: Match */}
                                    <div>
                                        <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Match</p>
                                        <p className="text-white font-bold text-sm">{card.match}</p>
                                        <p className="text-gray-500 text-xs mt-1">
                                            {card.homeTeam} vs {card.awayTeam}
                                        </p>
                                    </div>

                                    {/* Column 2: Bet */}
                                    <div className="text-center">
                                        <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Bet</p>
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-2xl">{getCardTypeIcon(card.cardType)}</span>
                                            <p className="text-white text-xs font-bold">{getCardTypeDisplay(card.cardType)}</p>
                                        </div>
                                    </div>

                                    {/* Column 3: Reward */}
                                    <div className="text-right">
                                        <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Reward</p>
                                        <div className="flex items-center gap-1 justify-end">
                                            <Coins className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                                            <p className="text-yellow-400 font-black text-lg">{card.coins}</p>
                                        </div>
                                        <p className={`text-xs font-bold mt-1 ${card.status === 'OPEN' ? 'text-emerald-400' : 'text-gray-500'
                                            }`}>
                                            {card.status}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Summary Footer */}
                {mockCardsInPlay.length > 0 && (
                    <div className="mt-6 bg-gradient-to-r from-emerald-900/40 to-blue-900/40 backdrop-blur-md border border-emerald-500/30 rounded-xl p-4">
                        <div className="flex justify-between items-center">
                            <span className="text-white/70 text-sm">Total Potential Win</span>
                            <div className="flex items-center gap-2">
                                <Coins className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                                <span className="text-yellow-400 font-black text-xl">
                                    {mockCardsInPlay.reduce((sum, card) => sum + card.coins, 0)}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </MobileLayout>
    );
};

export default CardsInPlay;
