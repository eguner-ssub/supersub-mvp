import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { Zap, Coins, Monitor, Tablet, Smartphone, BookOpen, Trophy, TrendingUp } from 'lucide-react';

export default function ManagerOffice() {
    const navigate = useNavigate();
    const { userProfile } = useGame();

    // ============================================================================
    // DYNAMIC STATE: Live Match Detection
    // ============================================================================
    // TODO: Replace with real hook like useLiveMatches() when available
    const liveMatches = []; // Populate this array to test "Packed" state
    const hasLiveMatches = liveMatches.length > 0;

    // ASSET SELECTION: Switch between Empty (Quiet) and Packed (Live Energy)
    const bgImage = hasLiveMatches
        ? '/assets/manager-room-packed.webp'
        : '/assets/manager-room-empty.webp';

    // PERFORMANCE: Progressive Loading State
    const [imageLoaded, setImageLoaded] = useState(false);

    return (
        // 1. OUTER WRAPPER: Handles the black bars on wide screens (iPad/Desktop)
        <div className="w-full h-[100dvh] bg-black flex items-center justify-center overflow-hidden font-sans select-none">

            {/* 2. THE GAME VIEWPORT: Rigid 9:16 Aspect Ratio */}
            {/* This div is the "World". Everything inside stays perfectly aligned. */}
            <div className="relative aspect-[9/16] h-full max-h-[100dvh] w-auto shadow-2xl overflow-hidden">

                {/* ============================================================================ */}
                {/* LAYER 0: DYNAMIC BACKGROUND                                               */}
                {/* ============================================================================ */}

                {/* Placeholder */}
                <div className={`absolute inset-0 bg-gray-900 transition-opacity duration-1000 ${imageLoaded ? 'opacity-0' : 'opacity-100'}`} />

                {/* The Asset - NOW LOCKED TO THE VIEWPORT */}
                <img
                    key={bgImage}
                    src={bgImage}
                    alt="Manager Office"
                    onLoad={() => setImageLoaded(true)}
                    // CHANGE: object-fill ensures 1:1 pixel mapping with the container.
                    // No more 'object-cover' or 'object-[65%]' causing drift.
                    className={`absolute inset-0 w-full h-full object-fill z-0 transition-opacity duration-700 ease-in-out ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                />

                {/* ============================================================================ */}
                {/* LAYER 1: DIEGETIC MICRO-HUD (Spatial Mapping)                             */}
                {/* ============================================================================ */}
                {/* NOTE: These coordinates now map 100% correctly to the 9:16 image asset. */}

                {/* 1. STADIUM WINDOW (Matches) */}
                <div
                    onClick={() => navigate('/match-hub')}
                    className="absolute top-[10%] right-[0] w-[55%] h-[35%] z-10 cursor-pointer active:scale-95 transition-transform"
                    data-testid="hotspot-window"
                >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float">
                        <Trophy className="w-3.5 h-3.5 text-white" />
                    </div>
                </div>

                {/* 2. BOOKCASE (History) */}
                <div
                    onClick={() => navigate('/inventory?tab=ledger')}
                    className="absolute top-[15%] left-[0] w-[25%] h-[60%] z-10 cursor-pointer active:scale-95 transition-transform"
                    data-testid="hotspot-bookcase"
                >
                    <div
                        className="absolute top-1/2 right-4 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float"
                        style={{ animationDelay: '1.2s' }}
                    >
                        <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                </div>

                {/* 3. LAPTOP (Scouting) */}
                <div
                    onClick={() => navigate('/stats')}
                    className="absolute bottom-[25%] left-[30%] w-[40%] h-[20%] z-10 cursor-pointer active:scale-95 transition-transform"
                    data-testid="hotspot-laptop"
                >
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float">
                        <Monitor className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                </div>

                {/* 4. PHONE (Inbox) */}
                <div
                    onClick={() => navigate('/inbox')}
                    className="absolute bottom-[15%] left-[8%] w-[20%] h-[10%] z-10 cursor-pointer active:scale-95 transition-transform rotate-12"
                    data-testid="hotspot-phone"
                >
                    <div
                        className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float"
                        style={{ animationDelay: '0.3s' }}
                    >
                        <Smartphone className="w-3.5 h-3.5 text-yellow-400" />
                    </div>
                </div>

                {/* 5. TABLET (Leaderboard) */}
                <div
                    onClick={() => navigate('/leaderboard')}
                    className="absolute bottom-[28%] right-[5%] w-[18%] h-[15%] z-10 cursor-pointer active:scale-95 transition-transform"
                    data-testid="hotspot-tablet"
                >
                    <div
                        className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float"
                        style={{ animationDelay: '0.7s' }}
                    >
                        <TrendingUp className={`w-3.5 h-3.5 ${hasLiveMatches ? 'text-green-400' : 'text-white'}`} />
                    </div>
                </div>

                {/* ============================================================================ */}
                {/* LAYER 2: HUD                                                              */}
                {/* ============================================================================ */}

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
