import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, BookOpen, Monitor, Smartphone, TrendingUp, Globe2, Bell } from 'lucide-react';
import { useGame } from '../../shared/context/GameContext';
import { normalizeMatch } from '../../shared/utils/normalizeMatch';
import OfficeOnboarding from './OfficeOnboarding';

const ManagerOffice = () => {
    const navigate = useNavigate();
    const { userProfile, currentStreak } = useGame();
    const [notifications, setNotifications] = useState([]);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [onboardingDismissed, setOnboardingDismissed] = useState(false);

    const [anyLiveMatches, setAnyLiveMatches] = useState(false);
    // Separate loaded state for each image to enable crossfade
    const [packedLoaded, setPackedLoaded] = useState(false);
    const [emptyLoaded, setEmptyLoaded] = useState(false);

    useEffect(() => {
        if (userProfile && userProfile.onboarding_complete === false && !onboardingDismissed) {
            setShowOnboarding(true);
        }
        if (userProfile && userProfile.onboarding_complete === true) {
            setShowOnboarding(false);
        }
    }, [userProfile, onboardingDismissed]);

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

    /**
     * EFFECT: Build tablet notifications on mount
     */
    useEffect(() => {
        if (!userProfile) return;

        const build = async () => {
            const items = [];
            const now = new Date();

            // 1. energy_ready — user is below max and regen has ticked up since last update
            const maxEnergy = userProfile.max_energy || 5;
            const energy = userProfile.energy ?? 0;
            const lastUpdated = userProfile.energy_last_updated_at;
            if (energy < maxEnergy && lastUpdated) {
                const hoursSince = (now - new Date(lastUpdated)) / (1000 * 60 * 60);
                // 1 unit per 4 hours; if at least one regen tick occurred since last read, notify
                if (hoursSince >= 4) {
                    items.push({ type: 'energy_ready', message: 'Energy recharged — you\'re ready to play.' });
                }
            }

            // 2 + 4. Fetch today's matches once for both matchday_soon and intel
            try {
                const today = now.toISOString().split('T')[0];
                const res = await fetch(`/api/matches?date=${today}`);
                if (res.ok) {
                    const data = await res.json();
                    const rawMatches = data.response || data.matches || [];
                    const normalizedMatches = rawMatches.map(r => normalizeMatch(r)).filter(Boolean);

                    // matchday_soon — kicking off within 6 hours
                    const soonCount = normalizedMatches.filter(m => {
                        if (!m.fixture?.date) return false;
                        const mins = (new Date(m.fixture.date) - now) / (1000 * 60);
                        return mins > 0 && mins <= 360;
                    }).length;
                    if (soonCount > 0) {
                        items.push({ type: 'matchday_soon', message: `${soonCount} match${soonCount > 1 ? 'es' : ''} kick off in the next 6 hours.` });
                    }

                    // intel — Joseba analysis for first upcoming match within 24h
                    const intelCandidates = normalizedMatches.filter(m => {
                        if (!m.fixture?.date) return false;
                        const hours = (new Date(m.fixture.date) - now) / (1000 * 60 * 60);
                        return hours > 0 && hours <= 24;
                    }).slice(0, 3);

                    for (const match of intelCandidates) {
                        const matchId = match.fixture?.id;
                        if (!matchId) continue;
                        try {
                            const intelRes = await fetch(`/api/intel?match_id=${matchId}`);
                            if (!intelRes.ok) continue;
                            const intel = await intelRes.json();
                            if (intel?.available && intel?.analysis?.greeting) {
                                const matchName = `${match.teams?.home?.name || ''} vs ${match.teams?.away?.name || ''}`;
                                items.push({ type: 'intel', message: intel.analysis.greeting, matchId, matchName });
                                break;
                            }
                        } catch (_) { /* silent */ }
                    }
                }
            } catch (_) { /* silent */ }

            // 3. streak_warning — active streak and it's after 20:00 local, not yet trained today
            if (currentStreak > 0) {
                const today = now.toISOString().split('T')[0];
                const lastStreakDate = userProfile.last_streak_date;
                if (lastStreakDate !== today && now.getHours() >= 20) {
                    items.push({ type: 'streak_warning', message: `You haven't trained today. Your ${currentStreak}-day streak is at risk.` });
                }
            }

            setNotifications(items.slice(0, 3));
        };

        build();
    }, [userProfile, currentStreak]);

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
                        {!showOnboarding && (
                            <div className={`absolute top-[40%] right-[30%] glass-dark p-2 rounded-full shadow-office ${anyLiveMatches ? 'animate-pulse' : ''}`}>
                                <Trophy className={`w-4 h-4 ${anyLiveMatches ? 'text-yellow-400' : 'text-white'}`} />
                            </div>
                        )}
                    </div>

                    {/* B. BOOKCASE (History) — Left wall */}
                    <div
                        data-testid="hotspot-bookcase"
                        onClick={() => navigate('/history')}
                        className="absolute top-[12%] left-0 w-[32%] h-[50%] z-10 cursor-pointer active:scale-[0.98] transition-all duration-100"
                    >
                        {!showOnboarding && (
                            <div className="absolute top-[50%] left-[40%] glass-dark shadow-office-warm p-2 rounded-full">
                                <BookOpen className="w-4 h-4 text-purple-400" />
                            </div>
                        )}
                    </div>

                    {/* C. LAPTOP SCREEN (League Hub) — Desk center */}
                    <div
                        data-testid="hotspot-laptop"
                        onClick={() => navigate('/league-hub')}
                        className="absolute top-[58%] left-[28%] w-[38%] h-[18%] z-20 cursor-pointer active:scale-[0.98] transition-all duration-100"
                        style={{
                            transform: 'skewX(-2deg) skewY(1deg)',
                            transformOrigin: 'bottom left',
                        }}
                    >
                        {!showOnboarding && (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 diegetic-screen p-2 rounded-full shadow-office">
                                <Globe2 className="w-4 h-4 text-blue-400" />
                            </div>
                        )}
                    </div>

                    {/* D. TABLET STAND (Leaderboard) — Desk right */}
                    <div
                        data-testid="hotspot-tablet-office"
                        onClick={() => navigate('/leaderboard', { state: { notifications } })}
                        className="absolute top-[58%] left-[72%] w-[20%] h-[18%] z-20 cursor-pointer active:scale-[0.98] transition-all duration-100"
                        style={{
                            transform: 'skewY(-3deg)',
                            transformOrigin: 'bottom right',
                        }}
                    >
                        {!showOnboarding && (
                            <div className="relative">
                                <div className="absolute top-0 right-[30%] diegetic-screen p-2 rounded-full shadow-office">
                                    <TrendingUp className="w-4 h-4 text-green-400" />
                                </div>
                                {notifications.length > 0 && (
                                    <div className="absolute -top-2 right-[20%] bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-lg z-30">
                                        {notifications.length}
                                    </div>
                                )}
                            </div>
                        )}
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
                        {!showOnboarding && (
                            <div className="absolute top-[-10%] right-[20%] diegetic-screen shadow-office-warm p-2 rounded-full">
                                <Smartphone className="w-4 h-4 text-yellow-400" />
                            </div>
                        )}
                    </div>

                </div>

                {/* HUD provided by NavigationShell > GameHeader */}

                {showOnboarding && (
                    <OfficeOnboarding onComplete={() => {
                        setShowOnboarding(false);
                        setOnboardingDismissed(true);
                    }} />
                )}
            </div>
        </div>
    );
};

export default ManagerOffice;
