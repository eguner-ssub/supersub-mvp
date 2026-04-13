import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Share2, X } from 'lucide-react';
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

    const [sharePickerGroup, setSharePickerGroup] = useState(null);
    const [selectedShareIds, setSelectedShareIds] = useState([]);

    const toggleShareId = (id) => {
        setSelectedShareIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const openSharePicker = (group) => {
        setSharePickerGroup(group);
        setSelectedShareIds(group.bets.map(b => b.id));
    };

    const closeSharePicker = () => {
        setSharePickerGroup(null);
        setSelectedShareIds([]);
    };

    const handleShareConfirm = () => {
        if (selectedShareIds.length === 0 || !sharePickerGroup) return;

        const selectedBets = sharePickerGroup.bets.filter(b => selectedShareIds.includes(b.id));
        const firstBet = selectedBets[0];

        let shareUrl;
        if (selectedShareIds.length === 1) {
            shareUrl = `${window.location.origin}/share/${firstBet.share_token}`;
        } else {
            const ids = selectedBets.map(b => b.id).join(',');
            shareUrl = `${window.location.origin}/share/${firstBet.share_token}?group=true&ids=${ids}`;
        }

        if (navigator.share) {
            navigator.share({
                title: 'My Supersub call',
                text: `I've made my calls for ${sharePickerGroup.match_title} on Supersub`,
                url: shareUrl,
            }).catch(() => {});
        } else {
            navigator.clipboard.writeText(shareUrl)
                .then(() => alert('Link copied to clipboard'))
                .catch(() => {});
        }

        closeSharePicker();
    };

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
        <>
            <div className="min-h-full bg-[#0D0D0D] px-5 py-6 space-y-16 overflow-visible">
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
                            className="relative rounded-xl bg-white/8 border border-white/10 px-4 py-6 mb-6"
                            style={{ minHeight: '160px' }}
                        >
                            {/* Cards — centred */}
                            <div className="flex items-end justify-center">
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

                            {/* Share button — bottom right of panel */}
                            <button
                                onClick={(e) => { e.stopPropagation(); openSharePicker(group); }}
                                className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 border border-white/10 text-zinc-400 hover:text-white hover:bg-black/50 transition-colors"
                            >
                                <Share2 className="w-3 h-3" />
                                <span className="text-[9px] font-bold uppercase tracking-wide">Share</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Share picker bottom sheet */}
            {sharePickerGroup && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40 bg-black/60"
                        onClick={closeSharePicker}
                    />

                    {/* Sheet */}
                    <div className="fixed inset-x-0 bottom-0 z-50 bg-zinc-900 border-t border-white/10 rounded-t-2xl p-6 pb-10">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-white font-black uppercase tracking-widest text-xs">
                                Share your calls
                            </p>
                            <button onClick={closeSharePicker} className="text-zinc-500 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-zinc-500 text-[10px] uppercase tracking-wide mb-4">
                            {sharePickerGroup.match_title}
                        </p>

                        <div className="space-y-0">
                            {sharePickerGroup.bets.map(bet => (
                                <label
                                    key={bet.id}
                                    className="flex items-center gap-3 py-3 border-b border-white/5 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedShareIds.includes(bet.id)}
                                        onChange={() => toggleShareId(bet.id)}
                                        className="w-4 h-4 accent-emerald-500 rounded"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-white text-sm font-bold block">
                                            {getCardLabel(bet.card_type)}
                                        </span>
                                        <span className="text-zinc-500 text-xs truncate block">
                                            {bet.team_name || bet.selection}
                                        </span>
                                    </div>
                                </label>
                            ))}
                        </div>

                        <button
                            onClick={handleShareConfirm}
                            disabled={selectedShareIds.length === 0}
                            className="w-full mt-5 py-3.5 bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-black uppercase tracking-widest rounded-xl transition-colors text-sm"
                        >
                            {selectedShareIds.length === 0
                                ? 'Select cards to share'
                                : `Share ${selectedShareIds.length === 1 ? 'card' : `${selectedShareIds.length} cards`}`
                            }
                        </button>
                    </div>
                </>
            )}
        </>
    );
};

export default ViewPendingGrid;
