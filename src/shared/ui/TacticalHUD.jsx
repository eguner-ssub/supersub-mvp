import React, { useState, useEffect } from 'react';

/**
 * TacticalHUD - CSS-Driven Scoreboard Component
 * 
 * Architecture: Glass-Dark surface over Void Black base
 * Design Language: Industrial Sans-Serif, All-Caps, Machined Look
 * Performance: GPU-accelerated animations only
 */
const TacticalHUD = ({ homeTeam, awayTeam, status, elapsed, date }) => {
    // initialised to null so we can distinguish "first render" from "0-0 after a goal"
    const [previousScore, setPreviousScore] = useState(null);
    const [goalAlert, setGoalAlert] = useState(false);

    // Detect score changes and trigger goal alert animation
    useEffect(() => {
        const currentHome = homeTeam.score ?? 0;
        const currentAway = awayTeam.score ?? 0;

        // First render — seed previousScore without flashing
        if (previousScore === null) {
            setPreviousScore({ home: currentHome, away: currentAway });
            return;
        }

        const scoreChanged = currentHome !== previousScore.home || currentAway !== previousScore.away;
        if (scoreChanged) {
            // Always update first so subsequent goals are tracked correctly
            setPreviousScore({ home: currentHome, away: currentAway });
            setGoalAlert(true);
            const timer = setTimeout(() => setGoalAlert(false), 1000);
            return () => clearTimeout(timer);
        }
    }, [homeTeam.score, awayTeam.score]);
    // Deliberately excludes previousScore from deps — it's internal tracking state,
    // not an external trigger. Including it would cause an infinite re-render loop.

    // Short display labels for Sportmonks developer_name status values
    const STATUS_LABEL = {
        INPLAY_1ST_HALF: '1H', HT: 'HT', INPLAY_2ND_HALF: '2H',
        INPLAY_ET: 'ET', INPLAY_ET_SECOND_HALF: 'ET', EXTRA_TIME_BREAK: 'BT',
        INPLAY_PENALTIES: 'PENS', BREAK: 'BT',
        FT: 'FT', AET: 'AET', FT_PEN: 'FT-P',
        POSTPONED: 'PST', CANCELLED: 'CANC', ABANDONED: 'ABD', AWARDED: 'AWD', WO: 'WO',
    };

    // Status badge configuration
    const getStatusConfig = () => {
        const liveStatuses = ['INPLAY_1ST_HALF', 'INPLAY_2ND_HALF', 'INPLAY_ET', 'INPLAY_ET_SECOND_HALF', 'INPLAY_PENALTIES', 'HT', 'BREAK', 'EXTRA_TIME_BREAK'];
        const postStatuses = ['FT', 'AET', 'FT_PEN', 'POSTPONED', 'CANCELLED', 'ABANDONED', 'AWARDED', 'WO'];

        const label = STATUS_LABEL[status] ?? status ?? 'NS';

        if (liveStatuses.includes(status)) {
            return {
                label,
                color: 'text-[#fbbf24]', // Warning Yellow
                border: 'border-[#39ff14]', // Toxic Green
                glow: 'shadow-[0_0_8px_rgba(57,255,20,0.3)]'
            };
        }

        if (postStatuses.includes(status)) {
            return {
                label,
                color: 'text-zinc-500',
                border: 'border-zinc-700',
                glow: ''
            };
        }

        // Pre-match (NS)
        return {
            label: 'NS',
            color: 'text-[#fbbf24]',
            border: 'border-[#39ff14]',
            glow: 'shadow-[0_0_8px_rgba(57,255,20,0.3)]'
        };
    };

    const statusConfig = getStatusConfig();

    // Display time for pre-match, score for live/post
    const getDisplayContent = () => {
        if (status === 'NS') {
            const matchDate = new Date(date);
            return matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return `${homeTeam.score}-${awayTeam.score}`;
    };

    return (
        <div className="absolute top-16 w-full z-40 px-2">
            <div className="relative w-full max-w-lg mx-auto">
                {/* Main HUD Container - Glass-Dark Architecture */}
                <div
                    className={`
            relative w-full bg-[#0a0a0a] 
            rounded-2xl overflow-hidden
            drop-shadow-[0_8px_16px_rgba(0,0,0,0.9)]
            transition-all duration-300
            ${goalAlert ? 'animate-pulse bg-[#fbbf24]/20' : ''}
          `}
                >
                    {/* Glass Overlay */}
                    <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-[12px] border border-[#1a1a1a]" />

                    {/* Content Grid - Score-Centric Horizontal Layout */}
                    <div className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-3 px-4">

                        {/* Home Team - Right Aligned towards Center */}
                        <div className="flex items-center justify-end gap-2 min-w-0">
                            <span className="text-white/90 font-black text-xs uppercase tracking-wider truncate text-right leading-tight">
                                {homeTeam.name}
                            </span>
                            <img
                                src={homeTeam.logo}
                                className="w-5 h-5 object-contain flex-shrink-0"
                                alt="Home Team Logo"
                            />
                        </div>

                        {/* Central Score Container - Dominant Anchor */}
                        <div className="flex flex-col items-center gap-1 px-4">
                            {/* Score Display */}
                            <div
                                className={`
                  text-xl font-black font-mono tracking-wide min-w-[60px] text-center
                  ${status === 'NS' ? 'text-white/80' : 'text-[#39ff14]'}
                  transition-all duration-300
                  ${goalAlert ? 'scale-110 text-[#fbbf24]' : ''}
                `}
                            >
                                {getDisplayContent()}
                            </div>

                            {/* Time/Status Badge - Small Pill Below Score */}
                            <div
                                className={`
                  px-2 py-0.5 rounded 
                  border ${statusConfig.border} ${statusConfig.glow}
                  ${statusConfig.color}
                  text-[7px] font-black uppercase tracking-widest
                  transition-all duration-300
                `}
                            >
                                {statusConfig.label}
                            </div>
                        </div>

                        {/* Away Team - Left Aligned away from Center */}
                        <div className="flex items-center gap-2 min-w-0">
                            <img
                                src={awayTeam.logo}
                                className="w-5 h-5 object-contain flex-shrink-0"
                                alt="Away Team Logo"
                            />
                            <span className="text-white/90 font-black text-xs uppercase tracking-wider truncate leading-tight">
                                {awayTeam.name}
                            </span>
                        </div>
                    </div>

                    {/* Structural Accent Lines (Industrial Detail) */}
                    <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#39ff14]/20 to-transparent" />
                </div>
            </div>
        </div>
    );
};

export default TacticalHUD;
