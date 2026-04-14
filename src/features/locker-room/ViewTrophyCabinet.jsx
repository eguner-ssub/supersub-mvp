import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { usePredictions } from '../../shared/hooks/usePredictions';
import { useGame } from '../../shared/context/GameContext';
import CardBase from '../../shared/ui/CardBase';
import ShareCardButton from '../../shared/ui/ShareCardButton';

// ─── formatBetSelection ───────────────────────────────────────────────────────
const formatBetSelection = (bet) => {
    if (bet.selection === 'DRAW') return 'Draw';
    if (bet.selection === 'HOME_WIN' || bet.selection === 'AWAY_WIN') {
        const teams = bet.team_name?.split(' vs ');
        if (bet.selection === 'HOME_WIN' && teams?.[0]) return `${teams[0]} to Win`;
        if (bet.selection === 'AWAY_WIN' && teams?.[1]) return `${teams[1]} to Win`;
    }
    return bet.selection?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
};

// ─── normaliseCardType ────────────────────────────────────────────────────────
const normaliseCardType = (type) => {
    if (!type) return 'c_match_result';
    return type.startsWith('c_') ? type : `c_${type}`;
};

// ─── getCardLabel ─────────────────────────────────────────────────────────────
const getCardLabel = (type) => ({
    'c_match_result': 'MATCH RESULT',
    'c_total_goals':  'TOTAL GOALS',
    'c_player_score': 'PLAYER SCORE',
    'c_supersub':     'SUPERSUB',
}[normaliseCardType(type)] || 'PREDICTION');


// ─── WinEntry ─────────────────────────────────────────────────────────────────

const NewBadge = () => (
    <div className="absolute -top-1 -right-1 z-30 bg-emerald-500 text-black text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full shadow-lg">
        New
    </div>
);

const WinEntry = ({ matchId, predictions, unseenIdsOnEntry }) => {
    const navigate = useNavigate();

    if (predictions.length === 1) {
        const p = predictions[0];
        const isNew = unseenIdsOnEntry.has(p.id);
        return (
            <div
                onClick={() => navigate(`/match/${matchId}`)}
                className="flex flex-col items-center gap-2 cursor-pointer active:scale-95 transition-transform"
            >
                <div className="w-28 overflow-hidden drop-shadow-[0_8px_24px_rgba(0,0,0,0.8)] relative">
                    {isNew && <NewBadge />}
                    <CardBase
                        type={normaliseCardType(p.card_type)}
                        label={getCardLabel(p.card_type)}
                        selection={p.team_name}
                        status="won"
                    />
                </div>
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide text-center max-w-[112px] leading-tight">
                    {p.match_title}
                </p>
            </div>
        );
    }

    // Multiple wins — flex overlap fan stack
    const stackHasNew = predictions.some(p => unseenIdsOnEntry.has(p.id));
    return (
        <div
            onClick={() => navigate(`/match/${matchId}`)}
            className="flex flex-col items-center gap-2 cursor-pointer active:scale-95 transition-transform"
        >
            <div className="relative">
                {stackHasNew && <NewBadge />}
                <div className="flex items-start justify-center">
                    {predictions.slice(0, 4).map((p, i) => {
                        const rotations = [-6, 2, -3, 5];
                        const yOffsets  = [0, -8, 0, -4];
                        return (
                            <div
                                key={p.id}
                                className="flex-shrink-0 drop-shadow-[0_8px_20px_rgba(0,0,0,0.7)]"
                                style={{
                                    width: '6rem',
                                    transform: `rotate(${rotations[i]}deg) translateY(${yOffsets[i]}px)`,
                                    marginLeft: i === 0 ? 0 : '-1.5rem',
                                    zIndex: i,
                                    position: 'relative',
                                }}
                            >
                                <CardBase
                                    type={normaliseCardType(p.card_type)}
                                    label={getCardLabel(p.card_type)}
                                    selection={p.team_name}
                                    status="won"
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide text-center max-w-[140px] leading-tight">
                {predictions[0].match_title}
            </p>
            {predictions.length > 4 && (
                <p className="text-[9px] text-zinc-600 uppercase tracking-widest">
                    +{predictions.length - 4} more
                </p>
            )}
        </div>
    );
};

// ─── CSS Shelf ────────────────────────────────────────────────────────────────

const Shelf = ({ groups, unseenIdsOnEntry }) => {
    if (!groups || groups.length === 0) return null;
    return (
        <div className="relative z-10 mb-8 px-4">
            {/* Cards sitting on this shelf */}
            <div className="flex flex-row flex-wrap gap-6 justify-start pb-6 px-6">
                {groups.map(([matchId, predictions]) => (
                    <WinEntry
                        key={matchId}
                        matchId={matchId}
                        predictions={predictions}
                        unseenIdsOnEntry={unseenIdsOnEntry}
                    />
                ))}
            </div>
            {/* CSS shelf edge — amber LED glow */}
            <div
                className="h-[2px] w-full rounded-full mt-4"
                style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,200,80,0.5) 15%, rgba(255,215,100,0.85) 50%, rgba(255,200,80,0.5) 85%, transparent 100%)',
                    boxShadow: '0 3px 20px rgba(255,180,60,0.4), 0 -2px 10px rgba(255,180,60,0.2)',
                }}
            />
        </div>
    );
};

// ─── Won sub-tab ─────────────────────────────────────────────────────────────

const GROUPS_PER_SHELF = 2;

const WonContent = ({ wonPredictions, unseenIdsOnEntry }) => {

    const sortedGroups = useMemo(() => {
        const grouped = wonPredictions.reduce((acc, p) => {
            if (!acc[p.match_id]) acc[p.match_id] = [];
            acc[p.match_id].push(p);
            return acc;
        }, {});

        return Object.entries(grouped).sort(([, a], [, b]) =>
            new Date(b[0].updated_at) - new Date(a[0].updated_at)
        );
    }, [wonPredictions]);

    // Distribute groups across up to 3 shelves, max GROUPS_PER_SHELF per shelf
    const shelves = useMemo(() => {
        const result = [];
        for (let i = 0; i < sortedGroups.length; i += GROUPS_PER_SHELF) {
            result.push(sortedGroups.slice(i, i + GROUPS_PER_SHELF));
            if (result.length === 3) break;
        }
        return result;
    }, [sortedGroups]);

    return (
        <div className="relative flex-1 overflow-y-auto scrollbar-hide">
            {/* Background */}
            <img
                src="/assets/bg-trophy-cabinet.webp"
                alt=""
                className="fixed inset-0 w-full h-full object-cover z-0"
            />

            {/* Empty state */}
            {wonPredictions.length === 0 && (
                <div className="flex flex-col items-center justify-center py-32 gap-4 relative z-10">
                    <Trophy className="w-12 h-12 text-yellow-400 drop-shadow-[0_2px_8px_rgba(250,204,21,0.4)]" />
                    <p className="text-white text-sm font-bold uppercase tracking-widest text-center px-8">
                        Nothing in here yet, go{' '}
                        <Link to="/match-hub" className="underline underline-offset-2 text-yellow-400 hover:text-yellow-300 transition-colors">
                            make predictions
                        </Link>
                        {' '}for winning moments!
                    </p>
                </div>
            )}

            {/* Shelves */}
            {wonPredictions.length > 0 && (
                <div className="relative z-10 pt-4 pb-48">
                    {shelves.map((shelfGroups, idx) => (
                        <Shelf key={idx} groups={shelfGroups} unseenIdsOnEntry={unseenIdsOnEntry} />
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── History sub-tab ─────────────────────────────────────────────────────────

const HistoryContent = ({ allSettled }) => {
    if (allSettled.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 opacity-40">
                <p className="text-zinc-500 text-sm uppercase tracking-widest">No settled predictions yet.</p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-40">
            {allSettled.map((bet) => {
                const isWon = bet.settled_status === 'WON';
                return (
                    <div
                        key={bet.id}
                        className="flex items-center justify-between px-4 py-3 border-b border-white/5"
                    >
                        <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-bold truncate">{bet.match_title}</p>
                            <p className="text-zinc-500 text-xs uppercase tracking-wide mt-0.5">{formatBetSelection(bet)}</p>
                        </div>
                        <div className="flex items-center gap-3 ml-3">
                            <span className="text-zinc-400 text-xs font-mono">{bet.points_awarded ?? bet.potential_reward} pts</span>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                isWon
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : 'bg-red-500/10 text-red-400'
                            }`}>
                                {bet.settled_status}
                            </span>
                            {isWon && bet.share_token && (
                                <ShareCardButton prediction={bet} variant="won" />
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────

const ViewTrophyCabinet = () => {
    const { predictions: allSettled, loading } = usePredictions('SETTLED');
    const [activeSubTab, setActiveSubTab] = useState('won');

    const { unseenSettlements } = useGame();
    // Snapshot on mount — LockerRoom marks wins seen as soon as the Cabinet tab
    // opens, which would clear `unseenSettlements` mid-render and make badges
    // flash. Freezing the set for the component's lifetime keeps "New" badges
    // stable for the whole viewing session.
    const [unseenIdsOnEntry] = useState(() =>
        new Set(
            unseenSettlements
                .filter(p => p.settled_status === 'WON')
                .map(p => p.id)
        )
    );

    const wonPredictions = useMemo(
        () => allSettled.filter(p => p.settled_status === 'WON'),
        [allSettled]
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <p className="text-gray-400 text-sm font-bold uppercase tracking-widest animate-pulse">
                    Loading Cabinet…
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Sub-tab bar */}
            <div className="flex border-b border-white/10 flex-shrink-0 sticky top-0 z-20 bg-black/80 backdrop-blur-md">
                <button
                    onClick={() => setActiveSubTab('won')}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-colors ${
                        activeSubTab === 'won'
                            ? 'text-yellow-400 border-b-2 border-yellow-400'
                            : 'text-zinc-500'
                    }`}
                >
                    Won
                </button>
                <button
                    onClick={() => setActiveSubTab('history')}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-colors ${
                        activeSubTab === 'history'
                            ? 'text-white border-b-2 border-white'
                            : 'text-zinc-500'
                    }`}
                >
                    History
                </button>
            </div>

            {/* Content */}
            {activeSubTab === 'won' ? (
                <WonContent wonPredictions={wonPredictions} unseenIdsOnEntry={unseenIdsOnEntry} />
            ) : (
                <HistoryContent allSettled={allSettled} />
            )}
        </div>
    );
};

export default ViewTrophyCabinet;
