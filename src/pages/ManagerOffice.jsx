import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { Zap, Coins, Monitor, Tablet, Smartphone, BookOpen } from 'lucide-react';

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
        <div className="relative w-full h-[100dvh] bg-black overflow-hidden md:max-w-[480px] md:mx-auto md:h-screen md:border-x md:border-gray-800 select-none font-sans">

            {/* ============================================================================ */}
            {/* LAYER 0: DYNAMIC BACKGROUND (EMPTY vs PACKED)                             */}
            {/* ============================================================================ */}

            {/* A. Placeholder (Instant Dark Load) */}
            <div className={`absolute inset-0 bg-gray-900 transition-opacity duration-1000 ${imageLoaded ? 'opacity-0' : 'opacity-100'}`} />

            {/* B. Dynamic Asset - GEOMETRY LOCK: object-[65%_bottom] preserved */}
            <img
                key={bgImage} // Forces clean re-render when state changes
                src={bgImage}
                alt="Manager Office"
                onLoad={() => setImageLoaded(true)}
                className={`absolute inset-0 w-full h-full object-cover object-[65%_bottom] z-0 transition-opacity duration-700 ease-in-out ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            />

            {/* ============================================================================ */}
            {/* LAYER 1: DIEGETIC MICRO-HUD (Dashboard Style)                             */}
            {/* ============================================================================ */}

            {/* A. LAPTOP (Workstation) */}
            <div
                onClick={() => navigate('/dashboard')}
                className="absolute bottom-[15%] left-[50%] -translate-x-1/2 w-[40%] h-[25%] z-10 cursor-pointer active:scale-95 transition-transform"
                data-testid="hotspot-laptop"
            >
                {/* Badge: Blue to signify Work/Dashboard */}
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float">
                    <Monitor className="w-3.5 h-3.5 text-blue-400" />
                </div>
            </div>

            {/* B. TABLET (Live Ops) */}
            <div
                onClick={() => navigate('/view-pending')}
                className="absolute bottom-[20%] right-[5%] w-[25%] h-[20%] z-10 cursor-pointer active:scale-95 transition-transform"
                data-testid="hotspot-tablet"
            >
                {/* Badge: Staggered Float Delay */}
                <div
                    className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float"
                    style={{ animationDelay: '0.7s' }}
                >
                    <Tablet className={`w-3.5 h-3.5 ${hasLiveMatches ? 'text-green-400' : 'text-white'}`} />
                </div>

                {/* Status Indicator: "Live" Pulse (Like Dashboard's Live Bet Count) */}
                {hasLiveMatches && (
                    <div className="absolute -top-5 -right-2 rotate-6 bg-green-500 text-black font-black text-[9px] px-1.5 py-0.5 shadow-lg border border-black/10 rounded-sm animate-pulse">
                        LIVE
                    </div>
                )}
            </div>

            {/* C. PHONE (Intel/Messages) */}
            <div
                onClick={() => navigate('/messages')}
                className="absolute bottom-[10%] left-[5%] w-[25%] h-[15%] z-10 cursor-pointer active:scale-95 transition-transform"
                data-testid="hotspot-phone"
            >
                <div
                    className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float"
                    style={{ animationDelay: '0.3s' }}
                >
                    <Smartphone className="w-3.5 h-3.5 text-yellow-400" />
                </div>
            </div>

            {/* D. BOOKCASE (Archives) */}
            <div
                onClick={() => navigate('/history')}
                className="absolute top-[30%] left-0 w-[20%] h-[30%] z-10 cursor-pointer active:scale-95 transition-transform"
                data-testid="hotspot-bookcase"
            >
                {/* Anchored to Right Edge of Hitbox for visibility */}
                <div
                    className="absolute top-1/2 right-2 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl pointer-events-none animate-float"
                    style={{ animationDelay: '1.2s' }}
                >
                    <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                </div>
            </div>

            {/* ============================================================================ */}
            {/* LAYER 2: HUD (Consistent with Dashboard)                                  */}
            {/* ============================================================================ */}

            <div className="absolute top-0 left-0 w-full p-4 pt-6 flex justify-between items-center z-50 pointer-events-none">
                {/* Energy */}
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg pointer-events-auto">
                    <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="text-white font-bold text-sm font-mono pt-0.5">
                        {userProfile?.energy}/{userProfile?.max_energy || 3}
                    </span>
                </div>

                {/* Manager Name */}
                <div className="absolute left-1/2 -translate-x-1/2 text-white text-lg font-black uppercase tracking-widest drop-shadow-lg truncate max-w-[150px] text-center pointer-events-auto">
                    {userProfile?.club_name || userProfile?.name}
                </div>

                {/* Coins */}
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg pointer-events-auto">
                    <Coins className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="text-white font-bold text-sm font-mono pt-0.5">{userProfile?.coins}</span>
                </div>
            </div>

        </div>
    );
}
