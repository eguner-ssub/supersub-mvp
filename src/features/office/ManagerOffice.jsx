import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, BookOpen, Monitor, Smartphone, TrendingUp, Zap, Coins, ArrowLeft } from 'lucide-react';
import { useGame } from '../../shared/context/GameContext';
import { normalizeMatch } from '../../shared/utils/normalizeMatch';

const ManagerOffice = () => {
    const navigate = useNavigate();
    const { userProfile } = useGame();

    // State to track if any matches are currently live globally
    const [anyLiveMatches, setAnyLiveMatches] = useState(false);

    const energy = userProfile?.energy || 0;
    const maxEnergy = userProfile?.max_energy || 3;
    const coins = userProfile?.coins || 0;
    const clubName = userProfile?.club_name || userProfile?.name || "Manager";

    /**
     * EFFECT: Global Live Match Check
     */
    useEffect(() => {
        const checkGlobalLiveStatus = async () => {
            try {
                const res = await fetch('/api/matches');
                const data = await res.json();

                if (data.response && Array.isArray(data.response)) {
                    const liveStatuses = ['1H', 'HT', '2H', 'ET', 'P', 'LIVE'];

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

                {/* BACKGROUND IMAGE */}
                <img
                    src={roomBackground}
                    alt="Manager Office"
                    className="absolute inset-0 w-full h-full object-fill z-0 transition-opacity duration-700"
                />

                {/* ── PERSPECTIVE SCENE ── */}
                <div className="absolute inset-0 perspective-office">

                    {/* A. STADIUM WINDOW (Match Hub) — Upper-right, flat against window */}
                    <div
                        data-testid="hotspot-window"
                        onClick={() => navigate('/match-hub')}
                        className="absolute top-[8%] left-[42%] w-[58%] h-[42%] z-10 cursor-pointer active:scale-[0.98] transition-all duration-100"
                    >
                        <div className={`absolute top-[40%] right-[30%] glass-dark p-2 rounded-full shadow-office ${anyLiveMatches ? 'animate-pulse' : ''}`}>
                            <Trophy className={`w-4 h-4 ${anyLiveMatches ? 'text-yellow-400' : 'text-white'}`} />
                        </div>
                    </div>

                    {/* B. BOOKCASE (History) — Left wall, no perspective warp */}
                    <div
                        data-testid="hotspot-bookcase"
                        onClick={() => navigate('/history')}
                        className="absolute top-[12%] left-0 w-[32%] h-[50%] z-10 cursor-pointer active:scale-[0.98] transition-all duration-100"
                    >
                        <div className="absolute top-[50%] left-[40%] glass-dark shadow-office-warm p-2 rounded-full">
                            <BookOpen className="w-4 h-4 text-purple-400" />
                        </div>
                    </div>

                    {/* C. LAPTOP SCREEN (Scouting) — Desk center, skewed to match camera angle */}
                    <div
                        data-testid="hotspot-laptop"
                        onClick={() => navigate('/scouting')}
                        className="absolute top-[58%] left-[28%] w-[38%] h-[18%] z-20 cursor-pointer active:scale-[0.98] transition-all duration-100"
                        style={{
                            transform: 'skewX(-2deg) skewY(1deg)',
                            transformOrigin: 'bottom left',
                        }}
                    >
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 diegetic-screen p-2 rounded-full shadow-office">
                            <Monitor className="w-4 h-4 text-blue-400" />
                        </div>
                    </div>

                    {/* D. TABLET STAND (Leaderboard) — Desk right, slight skew */}
                    <div
                        data-testid="hotspot-tablet-office"
                        onClick={() => navigate('/leaderboard')}
                        className="absolute top-[58%] left-[72%] w-[20%] h-[18%] z-20 cursor-pointer active:scale-[0.98] transition-all duration-100"
                        style={{
                            transform: 'skewY(-3deg)',
                            transformOrigin: 'bottom right',
                        }}
                    >
                        <div className="absolute top-0 right-[30%] diegetic-screen p-2 rounded-full shadow-office">
                            <TrendingUp className="w-4 h-4 text-green-400" />
                        </div>
                    </div>

                    {/* E. PHONE ON PAPERS (Inbox) — Desk bottom-left, warm lighting */}
                    <div
                        data-testid="hotspot-phone"
                        onClick={() => navigate('/inbox')}
                        className="absolute top-[72%] left-[5%] w-[22%] h-[15%] z-20 cursor-pointer active:scale-[0.98] transition-all duration-100"
                        style={{
                            transform: 'skewX(5deg)',
                            transformOrigin: 'bottom left',
                        }}
                    >
                        <div className="absolute top-[-10%] right-[20%] diegetic-screen shadow-office-warm p-2 rounded-full">
                            <Smartphone className="w-4 h-4 text-yellow-400" />
                        </div>
                    </div>

                </div>

                {/* ── HUD ── */}
                <div className="absolute top-0 left-0 w-full p-4 pt-6 flex justify-between items-center z-50 pointer-events-none">
                    {/* Back Button + Energy */}
                    <div className="flex items-center gap-2">
                        <button
                            data-testid="nav-dressing-room"
                            onClick={() => navigate('/dashboard')}
                            className="pointer-events-auto glass-dark shadow-office p-2 rounded-full active:scale-95 transition-transform"
                        >
                            <ArrowLeft className="w-4 h-4 text-white" />
                        </button>
                        <div className="pointer-events-auto flex items-center gap-2 glass-dark px-4 py-2 rounded-full shadow-office">
                            <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                            <span className="text-white font-bold text-sm font-mono pt-0.5">{energy}/{maxEnergy}</span>
                        </div>
                    </div>

                    {/* Club Name */}
                    <div className="absolute left-1/2 -translate-x-1/2 text-white text-lg font-black uppercase tracking-widest drop-shadow-lg truncate max-w-[150px] text-center">
                        {clubName}
                    </div>

                    {/* Coins */}
                    <div className="pointer-events-auto flex items-center gap-2 glass-dark px-4 py-2 rounded-full shadow-office">
                        <Coins className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        <span className="text-white font-bold text-sm font-mono pt-0.5">{coins}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManagerOffice;