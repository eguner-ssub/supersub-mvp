import React, { useState, useEffect } from 'react';
import { usePredictions } from '../../shared/hooks/usePredictions';
import { useGame } from '../../shared/context/GameContext';
import { Activity } from 'lucide-react';
import CardBase from '../../shared/ui/CardBase';
import { formatTeamName } from '../../shared/utils/formatTeamName';

// Copied exactly from ViewPendingGrid.jsx
const FAN_SLOTS = [
    { rotate: '-4deg',  translateY: '0px',   translateX: '-6px'  },
    { rotate: '1deg',   translateY: '-8px',  translateX: '0px'   },
    { rotate: '5deg',   translateY: '0px',   translateX: '6px'   },
    { rotate: '-2deg',  translateY: '-4px',  translateX: '10px'  },
];

const getCardLabel = (type) => ({
    c_match_result: 'MATCH RESULT',
    c_total_goals:  'TOTAL GOALS',
    c_player_score: 'GOALSCORER',
    c_supersub:     'SUPERSUB',
}[type] ?? type);

const ViewLive = () => {
    const { predictions: liveBets, loading } = usePredictions('LIVE');
    const { supabase } = useGame();

    const [matchData, setMatchData] = useState({});

    // 30-second polling loop — extended to also fetch team names + logos
    useEffect(() => {
        if (!liveBets || liveBets.length === 0) return;

        const matchIds = [...new Set(liveBets.map(b => b.match_id))];

        const fetchScores = async () => {
            const { data, error } = await supabase
                .from('matches')
                .select('id, home_score, away_score, home_team, away_team, home_logo, away_logo')
                .in('id', matchIds);

            if (!error && data) {
                const map = {};
                data.forEach(match => { map[match.id] = match; });
                setMatchData(map);
            } else if (error) {
                console.error("Scoreboard Poll Error:", error.message);
            }
        };

        fetchScores();
        const pollInterval = setInterval(fetchScores, 30000);
        return () => clearInterval(pollInterval);
    }, [liveBets, supabase]);

    const formatBetSelection = (bet) => {
        if (bet.selection === 'DRAW') return 'Draw';
        if (bet.selection === 'HOME_WIN' || bet.selection === 'AWAY_WIN') {
            const teams = bet.match_title?.split(' vs ');
            if (bet.selection === 'HOME_WIN') return `${teams[0]} to Win`;
            if (bet.selection === 'AWAY_WIN') return `${teams[1]} to Win`;
        }
        return bet.team_name || bet.selection?.replace(/_/g, ' ');
    };

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <p className="text-gray-400 animate-pulse font-bold uppercase tracking-widest">Scanning Live Feed...</p>
        </div>
    );

    if (liveBets.length === 0) return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-40">
            <Activity className="w-12 h-12 text-zinc-600 mb-4" />
            <p className="text-white text-lg font-bold mb-2 uppercase tracking-widest">No Active Plays</p>
            <p className="text-gray-500 text-xs">Live tracking begins at kickoff</p>
        </div>
    );

    // Group predictions by match_id
    const matchGroups = liveBets.reduce((acc, bet) => {
        if (!acc[bet.match_id]) acc[bet.match_id] = [];
        acc[bet.match_id].push(bet);
        return acc;
    }, {});

    return (
        <div className="h-full overflow-y-auto scrollbar-hide p-4 pb-32">

            {/* Match containers */}
            <div className="space-y-4 max-w-lg mx-auto">
                {Object.entries(matchGroups).map(([matchId, bets]) => {
                    const md = matchData[matchId];
                    const firstBet = bets[0];

                    // Score — null-safe placeholder until poll resolves
                    const hasScore = md?.home_score != null && md?.away_score != null;
                    const scoreDisplay = hasScore ? `${md.home_score} — ${md.away_score}` : '— — —';

                    // Team identifiers — prefer polled data, fall back to match_title parse
                    const titleParts = firstBet.match_title?.split(' vs ') ?? ['', ''];
                    const homeName = formatTeamName(md?.home_team ?? titleParts[0], md?.home_team_short_code) || '?';
                    const awayName = formatTeamName(md?.away_team ?? titleParts[1], md?.away_team_short_code) || '?';
                    const homeLogo = md?.home_logo;
                    const awayLogo = md?.away_logo;

                    // Sum potential rewards
                    const totalReward = bets.reduce((sum, b) => sum + (b.potential_reward ?? 0), 0);

                    return (
                        <div
                            key={matchId}
                            className="bg-zinc-900 border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-xl"
                        >
                            {/* ── HEADER: Broadcaster Scoreboard ── */}
                            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/5 flex-shrink-0">
                                {/* Home */}
                                <div className="flex flex-col items-center gap-1 w-16">
                                    {homeLogo
                                        ? <img src={homeLogo} alt={homeName} className="w-8 h-8 object-contain" loading="lazy" />
                                        : <span className="text-white font-black text-xs uppercase">{homeName.slice(0, 3)}</span>
                                    }
                                    <span className="text-zinc-400 text-[8px] font-bold uppercase tracking-wide leading-tight text-center line-clamp-2">{homeName}</span>
                                </div>

                                {/* Score + LIVE capsule */}
                                <div className="flex flex-col items-center gap-1.5">
                                    <span className="text-white font-black text-2xl tracking-tighter font-mono">{scoreDisplay}</span>
                                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        <span className="text-emerald-400 text-[9px] font-black uppercase tracking-widest">Live</span>
                                    </span>
                                </div>

                                {/* Away */}
                                <div className="flex flex-col items-center gap-1 w-16">
                                    {awayLogo
                                        ? <img src={awayLogo} alt={awayName} className="w-8 h-8 object-contain" loading="lazy" />
                                        : <span className="text-white font-black text-xs uppercase">{awayName.slice(0, 3)}</span>
                                    }
                                    <span className="text-zinc-400 text-[9px] font-bold uppercase tracking-wide leading-none text-center line-clamp-1">{awayName}</span>
                                </div>
                            </div>

                            {/* ── BODY: Fan layout (mirrored from ViewPendingGrid, 62% scale) ── */}
                            <div
                                className="relative bg-white/5 px-4 py-4 flex items-end flex-shrink-0"
                                style={{ minHeight: '100px' }}
                            >
                                <div className="flex items-end" style={{ marginLeft: '0.5rem' }}>
                                    {bets.slice(0, 4).map((bet, idx) => {
                                        const slot = FAN_SLOTS[idx] || FAN_SLOTS[FAN_SLOTS.length - 1];
                                        return (
                                            <div
                                                key={bet.id}
                                                className="drop-shadow-xl"
                                                style={{
                                                    transform: `rotate(${slot.rotate}) translateY(${slot.translateY}) translateX(${slot.translateX})`,
                                                    marginLeft: idx === 0 ? '0' : '-1.5rem',
                                                    zIndex: idx + 1,
                                                    position: 'relative',
                                                    // Collapse layout footprint to scaled dimensions
                                                    width: '4rem',
                                                    height: '6.2rem',
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <div style={{
                                                    transform: 'scale(0.62)',
                                                    transformOrigin: 'top left',
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                }}>
                                                    <CardBase
                                                        type={bet.card_type}
                                                        label={getCardLabel(bet.card_type)}
                                                        selection={formatBetSelection(bet)}
                                                        status="active"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* ── FOOTER: Potential Reward ── */}
                            <div className="flex-shrink-0 px-5 py-3 border-t border-white/5 flex items-center justify-between">
                                <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Potential Reward</span>
                                <span className="font-black text-xl" style={{ color: '#00e5ff' }}>+{totalReward}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ViewLive;
