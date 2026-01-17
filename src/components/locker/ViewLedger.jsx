import React from 'react';
import { getCardsByStatus } from '../../data/mockInventory';
import { Coins, TrendingUp, TrendingDown } from 'lucide-react';

const ViewLedger = () => {
    const settledBets = getCardsByStatus('SETTLED');

    if (settledBets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <p className="text-gray-500 text-lg font-bold mb-2">No History Yet</p>
                <p className="text-gray-600 text-sm">Your settled bets will appear here</p>
            </div>
        );
    }

    const totalWon = settledBets.filter(b => b.result === 'WON').reduce((sum, b) => sum + b.payout, 0);
    const totalLost = settledBets.filter(b => b.result === 'LOST').reduce((sum, b) => sum + b.stake, 0);
    const netProfit = totalWon - totalLost;

    return (
        <div className="h-full overflow-y-auto p-6">
            {/* Ledger Header */}
            <div className="mb-6 text-center">
                <h2 className="text-3xl font-black text-amber-900 uppercase tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
                    The Ledger
                </h2>
                <p className="text-amber-800 text-sm mt-1">Betting History</p>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6 max-w-2xl mx-auto">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                    <p className="text-xs text-amber-700 uppercase tracking-wide mb-1">Won</p>
                    <div className="flex items-center justify-center gap-1">
                        <Coins className="w-4 h-4 text-green-600" />
                        <p className="text-lg font-bold text-green-600">{totalWon}</p>
                    </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                    <p className="text-xs text-amber-700 uppercase tracking-wide mb-1">Lost</p>
                    <div className="flex items-center justify-center gap-1">
                        <Coins className="w-4 h-4 text-red-600" />
                        <p className="text-lg font-bold text-red-600">{totalLost}</p>
                    </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                    <p className="text-xs text-amber-700 uppercase tracking-wide mb-1">Net</p>
                    <div className="flex items-center justify-center gap-1">
                        {netProfit >= 0 ? (
                            <TrendingUp className="w-4 h-4 text-green-600" />
                        ) : (
                            <TrendingDown className="w-4 h-4 text-red-600" />
                        )}
                        <p className={`text-lg font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {netProfit >= 0 ? '+' : ''}{netProfit}
                        </p>
                    </div>
                </div>
            </div>

            {/* History Entries */}
            <div className="space-y-3 max-w-2xl mx-auto">
                {settledBets.map((bet) => (
                    <div
                        key={bet.id}
                        className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                        style={{ fontFamily: 'Georgia, serif' }}
                    >
                        {/* Match & Result */}
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className="text-lg font-bold text-amber-900">{bet.match}</h3>
                                <p className="text-sm text-amber-700">{bet.predictionLabel}</p>
                            </div>
                            <div className={`px-3 py-1 rounded-full font-bold text-sm ${bet.result === 'WON'
                                    ? 'bg-green-100 text-green-700 border border-green-300'
                                    : 'bg-red-100 text-red-700 border border-red-300'
                                }`}>
                                {bet.result}
                            </div>
                        </div>

                        {/* Final Score */}
                        <div className="mb-3">
                            <p className="text-xs text-amber-600 uppercase tracking-wide">Final Score</p>
                            <p className="text-xl font-bold text-amber-900">{bet.finalScore}</p>
                        </div>

                        {/* Financial Details */}
                        <div className="flex justify-between items-center border-t border-amber-300 pt-3">
                            <div>
                                <p className="text-xs text-amber-600">Stake</p>
                                <div className="flex items-center gap-1">
                                    <Coins className="w-3 h-3 text-amber-700" />
                                    <p className="text-sm font-bold text-amber-900">{bet.stake}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-amber-600">Payout</p>
                                <div className="flex items-center gap-1 justify-end">
                                    <Coins className={`w-3 h-3 ${bet.result === 'WON' ? 'text-green-600' : 'text-red-600'}`} />
                                    <p className={`text-sm font-bold ${bet.result === 'WON' ? 'text-green-600' : 'text-red-600'}`}>
                                        {bet.payout}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ViewLedger;
