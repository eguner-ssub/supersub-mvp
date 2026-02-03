import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, BookOpen, Monitor, Smartphone, TrendingUp, Zap, Coins } from 'lucide-react';
import { useGame } from '../../shared/context/GameContext';

const ManagerOffice = () => {
    const navigate = useNavigate();
    const { userProfile } = useGame();

    // Safe fallback if userProfile isn't loaded yet
    const energy = userProfile?.energy || 0;
    const maxEnergy = userProfile?.max_energy || 5;
    const coins = userProfile?.coins || 0;
    const clubName = userProfile?.club_name || "Manager";

    // DEBUG TOOL: Log coordinates on click
    const handleDebugClick = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        console.log(`📍 COORD: left-[${Math.round(x)}%] top-[${Math.round(y)}%]`);
    };

    return (
        <div className="w-full h-[100dvh] bg-black flex items-center justify-center overflow-hidden font-sans select-none">
            <div
                className="relative aspect-[9/16] h-full max-h-[100dvh] w-auto shadow-2xl overflow-hidden bg-gray-900"
                onClick={handleDebugClick}
            >

                {/* LOADING SPINNER (Behind bg) */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                </div>

                {/* BACKGROUND IMAGE */}
                <img
                    src="/assets/manager-room-empty.webp"
                    alt="Manager Office"
                    className="absolute inset-0 w-full h-full object-fill z-0 transition-opacity duration-700 ease-in-out"
                />

                {/* --- HOTSPOT LAYERS --- */}

                {/* 1. TROPHY / WINDOW -> MATCH HUB */}
                <div
                    data-testid="hotspot-window"
                    onClick={() => navigate('/match-hub')}
                    className="absolute top-[10%] right-[0] w-[55%] h-[35%] z-10 cursor-pointer active:scale-95 transition-transform border border-red-500 bg-red-500/20"
                >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float">
                        <Trophy className="w-3.5 h-3.5 text-white" />
                    </div>
                </div>

                {/* 2. LEDGER / BOOKCASE -> HISTORY */}
                <div
                    data-testid="hotspot-bookcase"
                    onClick={() => navigate('/inventory?tab=ledger')}
                    className="absolute top-[15%] left-[0] w-[25%] h-[60%] z-10 cursor-pointer active:scale-95 transition-transform border border-red-500 bg-red-500/20"
                >
                    <div className="absolute top-1/2 right-4 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float delay-100">
                        <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                </div>

                {/* 3. LAPTOP -> DASHBOARD */}
                <div
                    data-testid="hotspot-laptop"
                    onClick={() => navigate('/dashboard')}
                    className="absolute bottom-[25%] left-[30%] w-[40%] h-[20%] z-10 cursor-pointer active:scale-95 transition-transform border border-red-500 bg-red-500/20"
                >
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float">
                        <Monitor className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                </div>

                {/* 4. PHONE -> MESSAGES */}
                <div
                    data-testid="hotspot-phone"
                    onClick={() => navigate('/messages')}
                    className="absolute bottom-[15%] left-[8%] w-[20%] h-[10%] z-10 cursor-pointer active:scale-95 transition-transform rotate-12 border border-red-500 bg-red-500/20"
                >
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float delay-300">
                        <Smartphone className="w-3.5 h-3.5 text-yellow-400" />
                    </div>
                </div>

                {/* 5. TABLET -> VIEW PENDING */}
                <div
                    data-testid="hotspot-tablet"
                    onClick={() => navigate('/view-pending')}
                    className="absolute bottom-[28%] right-[5%] w-[18%] h-[15%] z-10 cursor-pointer active:scale-95 transition-transform border border-red-500 bg-red-500/20"
                >
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float delay-500">
                        <TrendingUp className="w-3.5 h-3.5 text-white" />
                    </div>
                </div>

                {/* --- HUD OVERLAY --- */}
                <div className="absolute top-0 left-0 w-full p-4 pt-6 flex justify-between items-center z-50 pointer-events-none">

                    {/* ENERGY */}
                    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg pointer-events-auto">
                        <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        <span className="text-white font-bold text-sm font-mono pt-0.5">{energy}/{maxEnergy}</span>
                    </div>

                    {/* CLUB NAME */}
                    <div className="absolute left-1/2 -translate-x-1/2 text-white text-lg font-black uppercase tracking-widest drop-shadow-lg truncate max-w-[150px] text-center pointer-events-auto">
                        {clubName}
                    </div>

                    {/* COINS */}
                    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg pointer-events-auto">
                        <Coins className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        <span className="text-white font-bold text-sm font-mono pt-0.5">{coins}</span>
                    </div>

                </div>

            </div>
        </div>
    );
};

export default ManagerOffice;