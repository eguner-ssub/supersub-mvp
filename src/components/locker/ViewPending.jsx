import React from 'react';
import { getCardsByStatus } from '../../data/mockInventory';
import { Coins, Calendar } from 'lucide-react';

const ViewPending = () => {
    const pendingBets = getCardsByStatus('PENDING');

    if (pendingBets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <p className="text-gray-500 text-lg font-bold mb-2">No Pending Bets</p>
                <p className="text-gray-600 text-sm">Place predictions to see them here</p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-6">
            {/* Whiteboard Header */}
            <div className="mb-6 text-center">
                <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tight" style={{ fontFamily: 'Permanent Marker, cursive' }}>
                    The Whiteboard
                </h2>
                <p className="text-gray-600 text-sm mt-1">Upcoming Predictions</p>
            </div>

            {/* Sticky Notes Grid */}
            <div className="grid grid-cols-1 gap-6 max-w-2xl mx-auto">
                {pendingBets.map((bet, index) => (
                    <div
                        key={bet.id}
                        className={`bg-yellow-200 border-2 border-yellow-400 rounded-lg p-6 shadow-lg transform ${index % 2 === 0 ? 'rotate-1' : '-rotate-1'
                            } hover:rotate-0 transition-transform cursor-pointer`}
                        style={{ fontFamily: 'Permanent Marker, cursive' }}
                    >
                        {/* Match */}
                        <h3 className="text-xl font-black text-gray-900 mb-3">
                            {bet.match}
                        </h3>

                        {/* Prediction */}
                        <div className="mb-3">
                            <p className="text-sm text-gray-700 uppercase tracking-wide">Prediction:</p>
                            <p className="text-lg font-bold text-gray-900">{bet.predictionLabel}</p>
                        </div>

                        {/* Stake & Potential Win */}
                        <div className="flex justify-between items-center mb-3">
                            <div>
                                <p className="text-xs text-gray-700">Stake</p>
                                <div className="flex items-center gap-1">
                                    <Coins className="w-4 h-4 text-yellow-700" />
                                    <p className="text-lg font-bold text-gray-900">{bet.stake}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-gray-700">Potential Win</p>
                                <div className="flex items-center gap-1 justify-end">
                                    <Coins className="w-4 h-4 text-green-700" />
                                    <p className="text-lg font-bold text-green-700">{bet.potentialWin}</p>
                                </div>
                            </div>
                        </div>

                        {/* Kickoff Time */}
                        <div className="flex items-center gap-2 text-sm text-gray-700 border-t border-yellow-400 pt-3">
                            <Calendar className="w-4 h-4" />
                            <span>{bet.kickoffLabel}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ViewPending;
