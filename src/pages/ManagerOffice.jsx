import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { Zap, Coins, Monitor, Tablet, Smartphone, BookOpen, Trophy, TrendingUp, AlertTriangle } from 'lucide-react';

export default function ManagerOffice() {
    const navigate = useNavigate();
    const { userProfile } = useGame();

    // DYNAMIC STATE
    const liveMatches = [];
    const hasLiveMatches = liveMatches.length > 0;

    // ASSETS
    const bgImage = hasLiveMatches
        ? '/assets/manager-room-packed.webp'
        : '/assets/manager-room-empty.webp';

    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false); // New Error State

    return (
        <div className="w-full h-[100dvh] bg-black flex items-center justify-center overflow-hidden font-sans select-none">
            <div className="relative aspect-[9/16] h-full max-h-[100dvh] w-auto shadow-2xl overflow-hidden bg-gray-900">

                {/* --- DYNAMIC BACKGROUND --- */}

                {/* 1. Placeholder / Loading State */}
                {!imageLoaded && !imageError && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}

                {/* 2. Error State (If assets are missing) */}
                {imageError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 bg-zinc-900">
                        <AlertTriangle className="w-12 h-12 mb-2 text-red-500" />
                        <p className="text-xs uppercase tracking-widest">Asset Missing</p>
                        <p className="text-[9px] font-mono mt-1">{bgImage}</p>
                    </div>
                )}

                {/* 3. The Asset */}
                <img
                    key={bgImage}
                    src={bgImage}
                    alt="Manager Office"
                    onLoad={() => setImageLoaded(true)}
                    onError={() => {
                        setImageLoaded(true); // Reveal the broken image icon at least
                        setImageError(true);
                        console.error(`❌ Background Asset Failed: ${bgImage}`);
                    }}
                    // FIX: Removed opacity-0 dependency if error occurs
                    className={`absolute inset-0 w-full h-full object-fill z-0 transition-opacity duration-700 ease-in-out ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                />

                {/* --- INTERACTIVE LAYER (HOTSPOTS) --- */}
                {/* Note: Hotspots remain clickable even if BG fails */}

                {/* 1. MATCH HUB (Trophy) */}
                <div onClick={() => navigate('/match-hub')} className="absolute top-[10%] right-[0] w-[55%] h-[35%] z-10 cursor-pointer active:scale-95 transition-transform">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float">
                        <Trophy className="w-3.5 h-3.5 text-white" />
                    </div>
                </div>

                {/* 2. INVENTORY (Book) */}
                <div onClick={() => navigate('/inventory?tab=ledger')} className="absolute top-[15%] left-[0] w-[25%] h-[60%] z-10 cursor-pointer active:scale-95 transition-transform">
                    <div className="absolute top-1/2 right-4 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float delay-100">
                        <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                </div>

                {/* 3. STATS (Monitor) */}
                <div onClick={() => navigate('/stats')} className="absolute bottom-[25%] left-[30%] w-[40%] h-[20%] z-10 cursor-pointer active:scale-95 transition-transform">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float">
                        <Monitor className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                </div>

                {/* 4. INBOX (Phone) */}
                <div onClick={() => navigate('/inbox')} className="absolute bottom-[15%] left-[8%] w-[20%] h-[10%] z-10 cursor-pointer active:scale-95 transition-transform rotate-12">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float delay-300">
                        <Smartphone className="w-3.5 h-3.5 text-yellow-400" />
                    </div>
                </div>

                {/* 5. LEADERBOARD (Tablet) */}
                <div onClick={() => navigate('/leaderboard')} className="absolute bottom-[28%] right-[5%] w-[18%] h-[15%] z-10 cursor-pointer active:scale-95 transition-transform">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float delay-500">
                        <TrendingUp className={`w-3.5 h-3.5 ${hasLiveMatches ? 'text-green-400' : 'text-white'}`} />
                    </div>
                </div>

                {/* --- HUD LAYER --- */}
                <div className="absolute top-0 left-0 w-full p-4 pt-6 flex justify-between items-center z-50 pointer-events-none">
                    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg pointer-events-auto">
                        <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        <span className="text-white font-bold text-sm font-mono pt-0.5">
                            {userProfile?.energy}/{userProfile?.max_energy || 3}
                        </span>
                    </div>

                    <div className="absolute left-1/2 -translate-x-1/2 text-white text-lg font-black uppercase tracking-widest drop-shadow-lg truncate max-w-[150px] text-center pointer-events-auto">
                        {userProfile?.club_name || userProfile?.name}
                    </div>

                    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg pointer-events-auto">
                        <Coins className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        <span className="text-white font-bold text-sm font-mono pt-0.5">{userProfile?.coins}</span>
                    </div>
                </div>

            </div>
        </div>
    );
}