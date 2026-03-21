import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, BookOpen, Monitor, Smartphone, TrendingUp } from 'lucide-react';
import { useGame } from '../../shared/context/GameContext';
import { normalizeMatch } from '../../shared/utils/normalizeMatch';

const ManagerOffice = () => {
    const navigate = useNavigate();
    const { userProfile } = useGame();

    const [anyLiveMatches, setAnyLiveMatches] = useState(false);
    // Separate loaded state for each image to enable crossfade
    const [packedLoaded, setPackedLoaded] = useState(false);
    const [emptyLoaded, setEmptyLoaded] = useState(false);

    /**
     * EFFECT: Global Live Match Check
     */
    useEffect(() => {
        const checkGlobalLiveStatus = async () => {
            try {
                const res = await fetch('/api/matches');

                if (!res.ok) {
                    console.error(`Live match check failed: ${res.status} ${res.statusText}`);
                    return;
                }

                const data = await res.json();

                if (data.response && Array.isArray(data.response)) {
                    const liveStatuses = ['INPLAY_1ST_HALF', 'INPLAY_2ND_HALF', 'INPLAY_ET', 'INPLAY_ET_SECOND_HALF', 'INPLAY_PENALTIES', 'HT', 'BREAK', 'EXTRA_TIME_BREAK'];

                    const isAnyMatchLive = data.response.some(raw => {
                        const match = normalizeMatch(raw);
                        // Guard against null/undefined from normalizeMatch
                        if (!match?.fixture?.status?.short) return false;
                        return liveStatuses.includes(match.fixture.status.short);
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

    return (
        <div className="w-full h-[100dvh] bg-black flex items-center justify-center overflow-hidden font-sans select-none">
            <div className="relative aspect-[9/16] h-full max-h-[100dvh] w-auto shadow-2xl overflow-hidden bg-gray-900">

                {/* BACKGROUND IMAGES — layered for crossfade */}
                <img
                    src="/assets/manager-room-empty.webp"
                    alt=""
                    aria-hidden="true"
                    onLoad={() => setEmptyLoaded(true)}
                    className="absolute inset-0 w-full h-full object-fill z-0 transition-opacity duration-700"
                    style={{ opacity: emptyLoaded && !anyLiveMatches ? 1 : 0 }}
                />
                <img
                    src="/assets/manager-room-packed.webp"
                    alt="Manager Office"
                    onLoad={() => setPackedLoaded(true)}
                    className="absolute inset-0 w-full h-full object-fill z-0 transition-opacity duration-700"
                    style={{ opacity: packedLoaded && anyLiveMatches ? 1 : 0 }}
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

                    {/* B. BOOKCASE (History) — Left wall */}
                    <div
                        data-testid="hotspot-bookcase"
                        onClick={() => navigate('/history')}
                        className="absolute top-[12%] left-0 w-[32%] h-[50%] z-10 cursor-pointer active:scale-[0.98] transition-all duration-100"
                    >
                        <div className="absolute top-[50%] left-[40%] glass-dark shadow-office-warm p-2 rounded-full">
                            <BookOpen className="w-4 h-4 text-purple-400" />
                        </div>
                    </div>

                    {/* C. LAPTOP SCREEN (Scouting) — Desk center */}
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

                    {/* D. TABLET STAND (Leaderboard) — Desk right */}
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

                    {/* E. PHONE ON PAPERS (Inbox) — Desk bottom-left */}
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

                {/* HUD provided by NavigationShell > GameHeader */}
            </div>
        </div>
    );
};

export default ManagerOffice;
