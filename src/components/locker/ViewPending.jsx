import React from 'react';
import { usePredictions } from '../../hooks/usePredictions';
import { Coins, Calendar } from 'lucide-react';

const ViewPending = () => {
    const { predictions: pendingBets, loading } = usePredictions('PENDING');

    // Helper: Format bet selection for display
    const formatBetSelection = (bet) => {
        if (bet.selection === 'DRAW') {
            return 'Draw';
        } else if (bet.selection === 'HOME_WIN' || bet.selection === 'AWAY_WIN') {
            // Extract just the team name from team_name field
            // team_name format: "Arsenal vs Chelsea"
            const teams = bet.team_name?.split(' vs ');
            if (bet.selection === 'HOME_WIN' && teams?.[0]) {
                return `${teams[0]} to Win`;
            } else if (bet.selection === 'AWAY_WIN' && teams?.[1]) {
                return `${teams[1]} to Win`;
            }
        }
        // Fallback: capitalize the selection
        return bet.selection?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Loading...</p>
            </div>
        );
    }

    if (pendingBets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <p className="text-gray-500 text-lg font-bold mb-2">No Pending Bets</p>
                <p className="text-gray-600 text-sm">Place predictions to see them here</p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto scrollbar-hide p-6 pb-32 pt-6">
            {/* Whiteboard Header */}
            <div className="mb-6 text-center">
                <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tight">
                    The Whiteboard
                </h2>
                <p className="text-gray-600 text-sm mt-1">Upcoming Predictions</p>
            </div>

            {/* Tactic Cards Grid */}
            <div className="grid grid-cols-1 gap-6 max-w-2xl mx-auto">
                {pendingBets.map((bet, index) => {
                    // Random rotation between -1deg and 1deg
                    const rotation = Math.random() * 2 - 1;

                    return (
                        <div
                            key={bet.id}
                            className="bg-gray-100 border-2 border-gray-300 rounded-lg p-6 shadow-lg hover:rotate-0 transition-transform cursor-pointer relative"
                            style={{ transform: `rotate(${rotation}deg)` }}
                        >
                            {/* Visual Magnet */}
                            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-6 h-6 rounded-full bg-red-600 border-2 border-gray-800 shadow-md"></div>

                            {/* Card Image - Top Right Corner */}
                            <div className="absolute top-4 right-4">
                                <img
                                    src="/cards/card_match_result.webp"
                                    alt="Card"
                                    className="w-12 h-12 object-contain opacity-80"
                                />
                            </div>

                            {/* Match - Bold System Font */}
                            <h3 className="text-xl font-black text-gray-900 mb-3 uppercase tracking-tight pr-16">
                                {bet.team_name}
                            </h3>

                            {/* Prediction - Handwritten Font */}
                            <div className="mb-4">
                                <p className="text-xs text-gray-600 uppercase tracking-wide font-bold mb-1">Prediction:</p>
                                <p
                                    className="text-2xl font-bold text-blue-700"
                                    style={{ fontFamily: "'Permanent Marker', cursive" }}
                                >
                                    {formatBetSelection(bet)}
                                </p>
                            </div>

                            {/* Projected Payout */}
                            <div className="border-t-2 border-gray-300 pt-3">
                                <p className="text-xs text-gray-600 uppercase tracking-wide font-bold mb-1">PROJECTED PAYOUT</p>
                                <div className="flex items-center gap-2">
                                    <Coins className="w-5 h-5 text-green-700" />
                                    <p className="text-2xl font-black text-green-700">{bet.potential_reward}</p>
                                </div>
                            </div>

                            {/* Created Time */}
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-3">
                                <Calendar className="w-3 h-3" />
                                <span>{new Date(bet.created_at).toLocaleString()}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ViewPending;
