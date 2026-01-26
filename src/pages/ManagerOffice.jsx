import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { Zap, Coins } from 'lucide-react';

export default function ManagerOffice() {
    const navigate = useNavigate();
    const { userProfile } = useGame();

    // PERFORMANCE: Progressive Loading State
    const [imageLoaded, setImageLoaded] = useState(false);

    // NAVIGATION: Back to Dressing Room
    const goBack = () => navigate('/dashboard');

    return (
        <div className="relative w-full h-[100dvh] bg-black overflow-hidden md:max-w-[480px] md:mx-auto md:h-screen md:border-x md:border-gray-800 select-none font-sans">

            {/* ============================================================================ */}
            {/* LAYER 0: PROGRESSIVE BACKGROUND (BLUR-UP STRATEGY)                        */}
            {/* ============================================================================ */}

            {/* A. Placeholder (Instant Dark Load) */}
            <div className={`absolute inset-0 bg-gray-900 transition-opacity duration-1000 ${imageLoaded ? 'opacity-0' : 'opacity-100'}`} />

            {/* B. Master Asset (.webp) */}
            <img
                src="/assets/manager-room.webp"
                alt="Manager Office"
                onLoad={() => setImageLoaded(true)}
                className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700 ease-in-out ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            />

            {/* ============================================================================ */}
            {/* LAYER 1: TACTILE HITBOXES (THE COMMAND CENTER)                            */}
            {/* ============================================================================ */}

            {/* A. WINDOW (Match List / Play) - The "Hero" Action */}
            <div
                onClick={() => navigate('/match-hub')}
                className="absolute top-[10%] left-[20%] w-[60%] h-[35%] z-20 cursor-pointer 
                   bg-transparent rounded-lg
                   active:scale-95 active:backdrop-brightness-125
                   transition-all duration-100 ease-out"
                data-testid="hotspot-window"
            >
                {/* Optional: 'Next Match' Pulse Indicator can go here */}
            </div>

            {/* B. LAPTOP (Scouting / Insights) - Center Desk */}
            <div
                onClick={() => navigate('/scouting')}
                className="absolute bottom-[20%] left-[28%] w-[44%] h-[25%] z-20 cursor-pointer 
                   bg-transparent rounded-xl rotate-1
                   active:scale-95 active:backdrop-brightness-125
                   transition-all duration-100 ease-out"
                data-testid="hotspot-laptop"
            />

            {/* C. TABLET (Leaderboard) - Right Desk */}
            <div
                onClick={() => navigate('/leaderboard')}
                className="absolute bottom-[28%] right-[5%] w-[20%] h-[18%] z-20 cursor-pointer 
                   bg-transparent rounded-lg -rotate-2
                   active:scale-95 active:backdrop-brightness-125
                   transition-all duration-100 ease-out"
                data-testid="hotspot-tablet-office"
            />

            {/* D. PHONE (Inbox/Social) - Left Desk */}
            <div
                onClick={() => navigate('/inbox')}
                className="absolute bottom-[18%] left-[8%] w-[12%] h-[12%] z-20 cursor-pointer 
                   bg-transparent rounded-lg rotate-12
                   active:scale-95 active:backdrop-brightness-125
                   transition-all duration-100 ease-out"
                data-testid="hotspot-phone"
            />

            {/* E. BOOKCASE (Bet History/Ledger) - Left Wall */}
            <div
                onClick={() => navigate('/history')}
                className="absolute top-[10%] left-0 w-[18%] h-[50%] z-20 cursor-pointer 
                   bg-transparent 
                   active:brightness-110
                   transition-all duration-100 ease-out"
                data-testid="hotspot-bookcase"
            />

            {/* F. NAVIGATION: Back to Dressing Room (Left Edge) */}
            <div
                onClick={goBack}
                className="absolute top-1/2 left-2 -translate-y-1/2 z-40 p-4 cursor-pointer opacity-50 hover:opacity-100 active:scale-90 transition-all"
                data-testid="nav-dressing-room"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-lg"><path d="m15 18-6-6 6-6" /></svg>
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
