import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Coins } from 'lucide-react';
import MobileLayout from '../shared/ui/MobileLayout';
import { usePredictions } from '../shared/hooks/usePredictions';
import CardBase from '../shared/ui/CardBase';

const CardsInPlay = () => {
    const navigate = useNavigate();
    // Fetch real pending and live bets from Supabase
    const { predictions: pendingBets, loading: pendingLoading } = usePredictions('PENDING');
    const { predictions: liveBets, loading: liveLoading } = usePredictions('LIVE');

    // Combine pending and live bets
    const cardsInPlay = [...pendingBets, ...liveBets];
    const isLoading = pendingLoading || liveLoading;

    // Map market types to CardBase types
    const getCardType = (market) => {
        const typeMap = {
            'match_result': 'c_match_result',
            'total_goals': 'c_total_goals',
            'goalscorer': 'c_player_score',
            'player_score': 'c_player_score',
            'supersub': 'c_supersub',
            'super_sub': 'c_supersub',
        };
        return typeMap[market?.toLowerCase()] || 'c_match_result';
    };

    if (isLoading) {
        return (
            <MobileLayout bgImage="/bg-dashboard.webp">
                <div className="w-full h-full flex items-center justify-center">
                    <p className="text-gray-400 text-lg">Loading...</p>
                </div>
            </MobileLayout>
        );
    }

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

                {/* Cards Grid */}
                <div className="flex-1 overflow-y-auto">
                    {cardsInPlay.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <p className="text-gray-500 text-lg font-bold mb-2">No Active Bets</p>
                            <p className="text-gray-600 text-sm">Place predictions to see them here</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                            {cardsInPlay.map((bet) => (
                                <div key={bet.id} className="w-32 mx-auto">
                                    <CardBase
                                        type={getCardType(bet.market)}
                                        label={bet.market?.toUpperCase() || 'BET'}
                                        selection={bet.selection}
                                        status={bet.status?.toLowerCase() === 'live' ? 'active' : 'pending'}
                                    />
                                    <div className="mt-2 text-center">
                                        <p className="text-gray-400 text-[10px] truncate">{bet.match_title}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Summary Footer */}
                {cardsInPlay.length > 0 && (
                    <div className="mt-6 bg-gradient-to-r from-emerald-900/40 to-blue-900/40 backdrop-blur-md border border-emerald-500/30 rounded-xl p-4">
                        <div className="flex justify-between items-center">
                            <span className="text-white/70 text-sm">Total Bets Active</span>
                            <div className="flex items-center gap-2">
                                <span className="text-yellow-400 font-black text-xl">
                                    {cardsInPlay.length}
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
