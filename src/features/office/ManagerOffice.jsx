import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, BookOpen, Monitor, Smartphone, TrendingUp, Zap, Coins } from 'lucide-react';
import { useGame } from '../../shared/context/GameContext';
import { normalizeMatch } from '../../shared/utils/normalizeMatch';

const ManagerOffice = () => {
    const navigate = useNavigate();
    const { userProfile } = useGame();

    // State to track if any matches are currently live globally
    const [anyLiveMatches, setAnyLiveMatches] = useState(false);

    const energy = userProfile?.energy || 0;
    const maxEnergy = userProfile?.max_energy || 5;
    const coins = userProfile?.coins || 0;
    const clubName = userProfile?.club_name || "Manager";

    /**
     * EFFECT: Global Live Match Check
     * Hits the match API to check for live statuses across supported leagues
     */
    useEffect(() => {
        const checkGlobalLiveStatus = async () => {
            try {
                // Fetch today's matches (defaults to current date if no param provided)
                const res = await fetch('/api/matches');
                const data = await res.json();

                if (data.response && Array.isArray(data.response)) {
                    // Define live statuses based on MatchHub logic
                    const liveStatuses = ['1H', 'HT', '2H', 'ET', 'P', 'LIVE'];

                    // Check if at least one match is currently active
                    const isAnyMatchLive = data.response.some(raw => {
                        const match = normalizeMatch(raw);
                        return liveStatuses.includes(match?.fixture?.status?.short);
                    });

                    setAnyLiveMatches(isAnyMatchLive);
                }
            } catch (err) {
                console.error("Failed to check global live status:", err);
            }
        };

        checkGlobalLiveStatus();

        // Optional: Refresh every 5 minutes to stay updated with real-time match shifts
        const interval = setInterval(checkGlobalLiveStatus, 300000);
        return () => clearInterval(interval);
    }, []);

    // Dynamic Asset Selection
    const roomBackground = anyLiveMatches
        ? "/assets/manager-room-packed.webp"
        : "/assets/manager-room-empty.webp";

    return (
        <div className="w-full h-[100dvh] bg-black flex items-center justify-center overflow-hidden font-sans select-none">
            <div className="relative aspect-[9/16] h-full max-h-[100dvh] w-auto shadow-2xl overflow-hidden bg-gray-900">

                {/* BACKGROUND IMAGE - Swaps based on global live state */}
                <img
                    src={roomBackground}
                    alt="Manager Office"
                    className="absolute inset-0 w-full h-full object-fill z-0 transition-opacity duration-700"
                />

                {/* --- HITBOXES --- */}
                <div
                    data-testid="hotspot-window"
                    onClick={() => navigate('/match-hub')}
                    className="absolute top-[10%] left-[45%] w-[55%] h-[40%] z-10 cursor-pointer active:scale-95 transition-transform"
                >
                    <div className={`absolute top-[40%] right-[30%] bg-black/40 backdrop-blur-md p-2 rounded-full border border-white/10 shadow-xl ${anyLiveMatches ? 'animate-pulse' : ''}`}>
                        <Trophy className={`w-4 h-4 ${anyLiveMatches ? 'text-yellow-400' : 'text-white'}`} />
                    </div>
                </div>

                <div
                    data-testid="hotspot-bookcase"
                    onClick={() => navigate('/inventory?tab=ledger')}
                    className="absolute top-[15%] left-0 w-[30%] h-[55%] z-10 cursor-pointer active:scale-95 transition-transform"
                >
                    <div className="absolute top-[50%] left-[40%] bg-black/40 backdrop-blur-md p-2 rounded-full border border-white/10 shadow-xl">
                        <BookOpen className="w-4 h-4 text-purple-400" />
                    </div>
                </div>

                <div
                    data-testid="hotspot-laptop"
                    onClick={() => navigate('/stats')}
                    className="absolute top-[60%] left-[28%] w-[44%] h-[25%] z-20 cursor-pointer active:scale-95 transition-transform"
                >
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md p-2 rounded-full border border-white/10 shadow-xl">
                        <Monitor className="w-4 h-4 text-blue-400" />
                    </div>
                </div>

                <div
                    data-testid="hotspot-tablet"
                    onClick={() => navigate('/leaderboard')}
                    className="absolute top-[62%] left-[75%] w-[25%] h-[25%] z-20 cursor-pointer active:scale-95 transition-transform"
                >
                    <div className="absolute top-0 right-[30%] bg-black/40 backdrop-blur-md p-2 rounded-full border border-white/10 shadow-xl">
                        <TrendingUp className="w-4 h-4 text-green-400" />
                    </div>
                </div>

                <div
                    data-testid="hotspot-phone"
                    onClick={() => navigate('/inbox')}
                    className="absolute top-[75%] left-[5%] w-[25%] h-[15%] z-20 cursor-pointer active:scale-95 transition-transform"
                >
                    <div className="absolute top-[-10%] right-[20%] bg-black/40 backdrop-blur-md p-2 rounded-full border border-white/10 shadow-xl">
                        <Smartphone className="w-4 h-4 text-yellow-400" />
                    </div>
                </div>

                {/* --- HUD --- */}
                <div className="absolute top-0 left-0 w-full p-4 pt-6 flex justify-between items-center z-50 pointer-events-none">
                    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg">
                        <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        <span className="text-white font-bold text-sm font-mono pt-0.5">{energy}/{maxEnergy}</span>
                    </div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-white text-lg font-black uppercase tracking-widest drop-shadow-lg truncate max-w-[150px] text-center">
                        {clubName}
                    </div>
                    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg">
                        <Coins className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        <span className="text-white font-bold text-sm font-mono pt-0.5">{coins}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManagerOffice;