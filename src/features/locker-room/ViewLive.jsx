import React from 'react';
import { usePredictions } from '../../shared/hooks/usePredictions'; // Path verified
import { Coins, Activity } from 'lucide-react';

const ViewLive = () => {
    const { predictions: liveBets, loading } = usePredictions('LIVE');

    const formatBetSelection = (bet) => {
        if (bet.selection === 'DRAW') return 'Draw';
        if (bet.selection === 'HOME_WIN' || bet.selection === 'AWAY_WIN') {
            const teams = bet.match_title?.split(' vs ');
            if (bet.selection === 'HOME_WIN') return `${teams[0]} to Win`;
            if (bet.selection === 'AWAY_WIN') return `${teams[1]} to Win`;
        }
        // Fallback to the displayLabel saved in team_name
        return bet.team_name || bet.selection?.replace(/_/g, ' ');
    };

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <p className="text-gray-400 animate-pulse font-bold uppercase tracking-widest">Scanning Live Feed...</p>
        </div>
    );

    if (liveBets.length === 0) return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-40">
            <Activity className="w-12 h-12 text-zinc-600 mb-4" />
            <p className="text-white text-lg font-bold mb-2 uppercase tracking-widest">No Active Plays</p>
            <p className="text-gray-500 text-xs">Live tracking begins at kickoff</p>
        </div>
    );

    return (
        <div className="h-full overflow-y-auto scrollbar-hide p-6 pb-32">
            <div className="mb-6 text-center">
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center justify-center gap-3">
                    <span className="w-3 h-3 bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.8)]"></span>
                    LIVE TABLET
                </h2>
            </div>

            <div className="space-y-4 max-w-2xl mx-auto">
                {liveBets.map((bet) => (
                    <div key={bet.id} className="bg-zinc-900 border-2 border-emerald-500 rounded-xl p-6 shadow-xl transition-all border border-white/5">
                        <div className="flex justify-between items-start mb-4">
                            <div className="min-w-0 flex-1">
                                <h3 className="text-xl font-black text-white uppercase leading-none mb-1 truncate">{bet.match_title}</h3>
                                <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest">{formatBetSelection(bet)}</p>
                            </div>
                            <div className="bg-red-600/20 border border-red-500/50 px-3 py-1 rounded-full flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></div>
                                <span className="text-red-500 text-[10px] font-black uppercase tracking-tighter">Live</span>
                            </div>
                        </div>

                        {/* LIVE SCORE: Now synced from your matches table */}
                        <div className="bg-black/40 rounded-lg p-4 mb-4 border border-emerald-500/20">
                            <div className="flex items-center justify-center gap-6">
                                <div className="text-3xl font-black text-white font-mono tracking-tighter">
                                    {bet.match?.home_score ?? 0}
                                </div>
                                <div className="h-8 w-[1px] bg-white/10"></div>
                                <div className="text-3xl font-black text-white font-mono tracking-tighter">
                                    {bet.match?.away_score ?? 0}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center bg-black/40 rounded-lg p-4">
                            <div>
                                <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Entry Stake</p>
                                <div className="flex items-center gap-1.5 text-yellow-500">
                                    <Coins className="w-4 h-4" />
                                    <p className="text-xl font-black">{bet.stake || 100}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Target Win</p>
                                <div className="flex items-center gap-1.5 justify-end text-emerald-500">
                                    <Coins className="w-4 h-4" />
                                    <p className="text-2xl font-black">+{bet.potential_reward}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ViewLive;