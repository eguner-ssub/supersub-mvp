import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { usePredictions } from '../../shared/hooks/usePredictions';
import CardBase from '../../shared/ui/CardBase';
import ShareCardButton from '../../shared/ui/ShareCardButton';

// ─── formatBetSelection ───────────────────────────────────────────────────────
// Ported from ViewLedger — formats a raw prediction into a readable label.
const formatBetSelection = (bet) => {
    if (bet.selection === 'DRAW') return 'Draw';
    if (bet.selection === 'HOME_WIN' || bet.selection === 'AWAY_WIN') {
        const teams = bet.team_name?.split(' vs ');
        if (bet.selection === 'HOME_WIN' && teams?.[0]) return `${teams[0]} to Win`;
        if (bet.selection === 'AWAY_WIN' && teams?.[1]) return `${teams[1]} to Win`;
    }
    return bet.selection?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
};

// ─── Tier helpers ─────────────────────────────────────────────────────────────

const getTier = (predictions) => {
    if (predictions.some(p => p.card_type === 'c_supersub')) return 'legendary';
    if (predictions.some(p => p.card_type === 'c_player_score')) return 'expert';
    return 'tactical';
};

const SHELF_TIERS = ['legendary', 'expert', 'tactical'];

const TIER_LABEL = {
    legendary: '⬡ Legendary',
    expert:    '◈ Expert',
    tactical:  '◇ Tactical',
};

const TIER_LABEL_COLOR = {
    legendary: 'text-yellow-500',
    expert:    'text-zinc-300',
    tactical:  'text-amber-700',
};

const TIER_SHELF_STYLE = {
    legendary: {
        background: 'linear-gradient(180deg, rgba(234,179,8,0.08) 0%, rgba(0,0,0,0) 100%)',
        borderTop: '1px solid rgba(234,179,8,0.15)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    },
    expert: {
        background: 'linear-gradient(180deg, rgba(161,161,170,0.06) 0%, rgba(0,0,0,0) 100%)',
        borderTop: '1px solid rgba(161,161,170,0.1)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    },
    tactical: {
        background: 'linear-gradient(180deg, rgba(120,80,40,0.08) 0%, rgba(0,0,0,0) 100%)',
        borderTop: '1px solid rgba(120,80,40,0.12)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    },
};

const TIER_FRAME_BORDER = {
    legendary: 'border-yellow-500/60',
    expert:    'border-zinc-400/40',
    tactical:  'border-amber-800/40',
};

// Card type badge colours
const CARD_TYPE_COLOR = {
    c_match_result: 'bg-purple-700',
    c_total_goals:  'bg-emerald-700',
    c_player_score: 'bg-amber-700',
    c_supersub:     'bg-slate-600',
};

const CARD_TYPE_LETTER = {
    c_match_result: 'M',
    c_total_goals:  'G',
    c_player_score: 'P',
    c_supersub:     'S',
};

// ─── Easel stand ──────────────────────────────────────────────────────────────

const EaselStand = () => (
    <div className="flex justify-center mt-1 pointer-events-none">
        <div
            style={{
                width: 16,
                height: 8,
                borderLeft:   '1px solid rgba(255,255,255,0.15)',
                borderRight:  '1px solid rgba(255,255,255,0.15)',
                clipPath: 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)',
            }}
        />
    </div>
);

// ─── MatchItem ────────────────────────────────────────────────────────────────

const MatchItem = ({ predictions, tier, navigate }) => {
    const matchId   = predictions[0].match_id;
    const isMulti   = predictions.length > 1;

    if (!isMulti) {
        const p = predictions[0];
        return (
            <div
                className="flex flex-col items-center cursor-pointer active:scale-95 transition-transform"
                onClick={() => navigate(`/match/${matchId}`)}
            >
                <div className="w-24">
                    <CardBase
                        type={p.card_type}
                        selection={p.team_name || p.selection?.replace(/_/g, ' ')}
                        status="won"
                    />
                </div>
                <EaselStand />
            </div>
        );
    }

    // Multi-win frame
    return (
        <div
            className={`flex flex-col items-center cursor-pointer active:scale-95 transition-transform`}
            onClick={() => navigate(`/match/${matchId}`)}
        >
            <div
                className={`border rounded-lg p-3 ${TIER_FRAME_BORDER[tier]}`}
                style={{ minWidth: 96, maxWidth: 140 }}
            >
                {/* Match title */}
                <p className="text-[9px] font-black text-white uppercase tracking-wide leading-tight mb-2 text-center">
                    {predictions[0].match_title || 'Match'}
                </p>

                {/* Card type badges */}
                <div className="flex flex-wrap gap-1 justify-center">
                    {predictions.map((p) => (
                        <div
                            key={p.id}
                            className={`w-5 h-5 rounded-sm flex items-center justify-center ${CARD_TYPE_COLOR[p.card_type] || 'bg-zinc-700'}`}
                        >
                            <span className="text-[8px] font-black text-white">
                                {CARD_TYPE_LETTER[p.card_type] || '?'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
            <EaselStand />
        </div>
    );
};

// ─── Won sub-tab ─────────────────────────────────────────────────────────────

const WonContent = ({ wonPredictions, navigate }) => {
    const { predictions: liveBets }    = usePredictions('LIVE');
    const { predictions: pendingBets } = usePredictions('PENDING');

    const grouped = useMemo(() => {
        return wonPredictions.reduce((acc, p) => {
            if (!acc[p.match_id]) acc[p.match_id] = [];
            acc[p.match_id].push(p);
            return acc;
        }, {});
    }, [wonPredictions]);

    // Build shelf groups: { tier -> [{ match_id, predictions }] }
    const shelfMap = useMemo(() => {
        const map = { legendary: [], expert: [], tactical: [] };
        for (const [matchId, preds] of Object.entries(grouped)) {
            const tier = getTier(preds);
            map[tier].push({ match_id: matchId, predictions: preds });
        }
        return map;
    }, [grouped]);

    return (
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-8">
            {/* Status pills */}
            {(liveBets.length > 0 || pendingBets.length > 0) && (
                <div className="flex flex-wrap gap-2 px-4 pt-4 pb-2">
                    {liveBets.length > 0 && (
                        <button
                            onClick={() => navigate('/inventory?tab=live')}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-[10px] font-black uppercase tracking-wider text-red-400 hover:text-red-300 transition-colors"
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            {liveBets.length} LIVE
                        </button>
                    )}
                    {pendingBets.length > 0 && (
                        <button
                            onClick={() => navigate('/inventory?tab=pending')}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800 border border-white/10 text-[10px] font-black uppercase tracking-wider text-zinc-400 hover:text-white transition-colors"
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                            {pendingBets.length} PENDING
                        </button>
                    )}
                </div>
            )}

            {/* Empty state */}
            {wonPredictions.length === 0 && (
                <div className="flex flex-col items-center justify-center flex-1 gap-4 opacity-50 py-20">
                    <Trophy className="w-12 h-12 text-zinc-700" />
                    <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest text-center px-8">
                        Nothing in here yet, Boss. Go win some points first.
                    </p>
                </div>
            )}

            {/* Shelves */}
            {wonPredictions.length > 0 && SHELF_TIERS.map((tier) => {
                const groups = shelfMap[tier];
                if (!groups || groups.length === 0) return null;

                return (
                    <div key={tier} className="mb-6 pt-4">
                        {/* Shelf label */}
                        <div className="flex items-center gap-2 px-4 mb-3">
                            <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${TIER_LABEL_COLOR[tier]}`}>
                                {TIER_LABEL[tier]}
                            </span>
                            <div className="flex-1 h-[1px] bg-white/5" />
                        </div>

                        {/* Shelf surface */}
                        <div
                            className="mx-4 rounded-lg px-4 py-5 flex flex-row flex-wrap gap-4"
                            style={TIER_SHELF_STYLE[tier]}
                        >
                            {groups.map((group) => (
                                <MatchItem
                                    key={group.match_id}
                                    predictions={group.predictions}
                                    tier={tier}
                                    navigate={navigate}
                                />
                            ))}
                        </div>

                        {/* Shelf edge */}
                        <div className="mx-4 h-[3px] rounded-b-sm bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    </div>
                );
            })}
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
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-8">
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
    const navigate = useNavigate();
    const { predictions: allSettled, loading } = usePredictions('SETTLED');
    const [activeSubTab, setActiveSubTab] = useState('won');

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
        <div className="flex flex-col min-h-full">
            {/* Sub-tab bar */}
            <div className="flex border-b border-white/10">
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
                <WonContent wonPredictions={wonPredictions} navigate={navigate} />
            ) : (
                <HistoryContent allSettled={allSettled} />
            )}
        </div>
    );
};

export default ViewTrophyCabinet;
