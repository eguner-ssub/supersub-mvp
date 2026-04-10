import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { usePredictions } from '../../shared/hooks/usePredictions';
import CardBase from '../../shared/ui/CardBase';

/**
 * Fan rotation configs per slot index within a match group.
 * Each entry: { rotate, translateY, translateX }
 */
const FAN_SLOTS = [
    { rotate: '-4deg',  translateY: '0px',   translateX: '-6px'  },
    { rotate: '1deg',   translateY: '-8px',  translateX: '0px'   },
    { rotate: '5deg',   translateY: '0px',   translateX: '6px'   },
    { rotate: '-2deg',  translateY: '-4px',  translateX: '10px'  },
];

/**
 * Helper to map card_type IDs to display labels.
 */
const getCardLabel = (type) => {
    const labelMap = {
        'c_match_result': 'MATCH RESULT',
        'c_total_goals':  'TOTAL GOALS',
        'c_player_score': 'GOALSCORER',
        'c_supersub':     'SUPERSUB',
    };
    return labelMap[type] || 'BET';
};

/**
 * Format a kickoff ISO timestamp to e.g. "SAT 18 APR · 17:30"
 */
const formatKickoff = (isoDate) => {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const day = days[d.getDay()];
    const date = d.getDate();
    const month = months[d.getMonth()];
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${date} ${month} · ${hh}:${mm}`;
};

const ViewPendingGrid = () => {
    const navigate = useNavigate();
    const { predictions: pendingBets, loading } = usePredictions('PENDING');

    // Group predictions by match_id, sorted by kickoff ascending
    const matchGroups = useMemo(() => {
        if (!pendingBets || pendingBets.length === 0) return [];

        const groupMap = {};
        for (const bet of pendingBets) {
            const key = bet.match_id;
            if (!groupMap[key]) {
                groupMap[key] = {
                    match_id: key,
                    match_title: bet.match_title || '',
                    kickoff_time: bet.kickoff_time || bet.created_at,
                    bets: [],
                };
            }
            groupMap[key].bets.push(bet);
        }

        return Object.values(groupMap).sort((a, b) => {
            const ta = a.kickoff_time ? new Date(a.kickoff_time).getTime() : 0;
            const tb = b.kickoff_time ? new Date(b.kickoff_time).getTime() : 0;
            return ta - tb;
        });
    }, [pendingBets]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <p className="text-gray-400 text-lg animate-pulse">Loading Whiteboard...</p>
            </div>
        );
    }

    if (pendingBets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50 min-h-[60vh]">
                <ClipboardList className="w-10 h-10 text-zinc-600" />
                <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">Nothing on the board yet, Boss.</p>
            </div>
        );
    }

    return (
        <div className="min-h-full bg-[#0D0D0D] px-5 py-4 space-y-8">
            {matchGroups.map((group) => (
                <div key={group.match_id}>
                    {/* Match label row */}
                    <div className="flex items-center gap-3 mb-4">
                        <span
                            className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 whitespace-nowrap"
                            style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}
                        >
                            {formatKickoff(group.kickoff_time)}
                        </span>
                        <div className="flex-1 h-px bg-white/10" />
                    </div>

                    {/* Fan panel */}
                    <div
                        className="relative rounded-xl bg-white/5 px-4 py-6 flex items-end"
                        style={{ minHeight: '11rem' }}
                    >
                        {/* Cards in fan arrangement */}
                        <div className="flex items-end" style={{ marginLeft: '0.5rem' }}>
                            {group.bets.slice(0, 4).map((bet, idx) => {
                                const slot = FAN_SLOTS[idx] || FAN_SLOTS[FAN_SLOTS.length - 1];
                                return (
                                    <div
                                        key={bet.id}
                                        onClick={() => navigate(`/match/${bet.match_id}`)}
                                        className="cursor-pointer drop-shadow-xl transition-transform duration-200 hover:scale-105 active:scale-95"
                                        style={{
                                            transform: `rotate(${slot.rotate}) translateY(${slot.translateY}) translateX(${slot.translateX})`,
                                            marginLeft: idx === 0 ? '0' : '-1.5rem',
                                            zIndex: idx + 1,
                                            position: 'relative',
                                        }}
                                    >
                                        <CardBase
                                            type={bet.card_type}
                                            label={getCardLabel(bet.card_type)}
                                            selection={bet.team_name || bet.selection?.replace(/_/g, ' ')}
                                            status="pending"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ViewPendingGrid;