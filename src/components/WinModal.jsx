import React from 'react';
import { Coins, Trophy, X } from 'lucide-react';

const WinModal = ({ amount, onClose }) => {
    return (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="relative bg-gradient-to-br from-yellow-500 via-orange-500 to-red-500 rounded-3xl p-8 max-w-md w-full text-center shadow-[0_0_50px_rgba(234,179,8,0.5)] animate-in zoom-in slide-in-from-bottom duration-500">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>

                {/* Celebration Icon */}
                <div className="mb-6 animate-bounce">
                    <div className="w-24 h-24 mx-auto bg-white/20 rounded-full flex items-center justify-center border-4 border-white/50 shadow-lg">
                        <Trophy className="w-12 h-12 text-white" />
                    </div>
                </div>

                {/* Title */}
                <h2 className="text-5xl font-black text-white mb-2 uppercase tracking-tight drop-shadow-lg">
                    🎉 WINNER! 🎉
                </h2>

                <p className="text-white/90 text-lg mb-6 font-bold">
                    MATCH FINISHED!
                </p>

                {/* Amount Display */}
                <div className="bg-white/20 backdrop-blur-md rounded-2xl p-6 mb-6 border-2 border-white/30">
                    <p className="text-white/80 text-sm uppercase tracking-wider mb-2">You Won</p>
                    <div className="flex items-center justify-center gap-3">
                        <Coins className="w-8 h-8 text-white" />
                        <p className="text-6xl font-black text-white drop-shadow-lg">
                            {amount}
                        </p>
                    </div>
                    <p className="text-white/80 text-sm uppercase tracking-wider mt-2">Coins</p>
                </div>

                {/* Collect Button */}
                <button
                    onClick={onClose}
                    className="w-full py-4 bg-white hover:bg-gray-100 text-orange-600 font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-xl text-lg"
                >
                    COLLECT WINNINGS
                </button>

                {/* Confetti effect (CSS animation) */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
                    {[...Array(20)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute w-2 h-2 bg-white rounded-full animate-ping"
                            style={{
                                left: `${Math.random() * 100}%`,
                                top: `${Math.random() * 100}%`,
                                animationDelay: `${Math.random() * 2}s`,
                                animationDuration: `${1 + Math.random() * 2}s`
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default WinModal;
