import React from 'react';
import { usePredictions } from '../../hooks/usePredictions';
import { Coins, Clock } from 'lucide-react';

const ViewLive = () => {
    const { predictions: liveBets, loading } = usePredictions('LIVE');

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-gray-400">Loading...</p>
            </div>
        );
    }

    if (liveBets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <p className="text-gray-400 text-lg font-bold mb-2">No Live Matches</p>
                <p className="text-gray-600 text-sm">Check back when matches are in progress</p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-6">
            {/* Tablet Header */}
            <div className="mb-6 text-center">
                <h2 className="text-3xl font-black text-white uppercase tracking-tight flex items-center justify-center gap-3">
                    <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                    LIVE ACTION
                </h2>
                <p className="text-gray-400 text-sm mt-1">Matches in Progress</p>
            </div>

            {/* Live Match Cards */}
            <div className="space-y-4 max-w-2xl mx-auto">
                {liveBets.map((bet) => {
                    // Calculate how long the bet has been live
                    const liveTime = Math.floor((new Date() - new Date(bet.updated_at)) / 1000);
                    const remainingTime = Math.max(0, 30 - liveTime);

                    return (
                        <div
                            key={bet.id}
                            className="bg-gray-900 border-2 border-emerald-500 rounded-xl p-6 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all"
                        >
                            {/* Match Header */}
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-white mb-1">{bet.team_name}</h3>
                                    <p className="text-sm text-gray-400">{bet.selection}</p>
                                </div>
                                <div className="flex items-center gap-2 bg-red-600 px-3 py-1 rounded-full">
                                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                                    <span className="text-white text-xs font-bold uppercase">LIVE</span>
                                </div>
                            </div>

                            {/* Live Status */}
                            <div className="bg-black/50 rounded-lg p-4 mb-4">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <Clock className="w-4 h-4 text-emerald-400" />
                                    <span className="text-emerald-400 font-bold text-lg">
                                        {remainingTime > 0 ? `Settling in ${remainingTime}s` : 'Settling...'}
                                    </span>
                                </div>
                                <p className="text-gray-500 text-xs text-center">Match simulation in progress</p>
                            </div>

                            {/* Bet Details */}
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wide">Your Stake</p>
                                    <div className="flex items-center gap-1 mt-1">
                                        <Coins className="w-4 h-4 text-yellow-400" />
                                        <p className="text-lg font-bold text-yellow-400">{bet.stake}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500 uppercase tracking-wide">Potential Win</p>
                                    <div className="flex items-center gap-1 justify-end mt-1">
                                        <Coins className="w-4 h-4 text-emerald-400" />
                                        <p className="text-lg font-bold text-emerald-400">{bet.potential_reward}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ViewLive;
