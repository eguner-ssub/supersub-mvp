import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { ArrowLeft, TrendingUp, Flame } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/* ─────────────────────────────────────────────
   DESIGN TOKENS
   ───────────────────────────────────────────── */
const COLORS = {
    bg: '#0a0a0f',
    glass: 'rgba(0,0,0,0.40)',
    cardBg: 'rgba(255,255,255,0.04)',
    cardBorder: 'rgba(255,255,255,0.06)',
    white: '#FFFFFF',
    grey: '#8892a4',
    greyLight: '#b0b8c4',
    amberGold: '#F5A623',
    electricCyan: '#00E5FF',
    emerald: '#34D399',
    cyanDim: 'rgba(0,229,255,0.15)',
    cyanGlow: 'rgba(0,229,255,0.30)',
    heatTrack: 'rgba(255,255,255,0.08)',
};

const FONT = "'Montserrat', sans-serif";

/* ─────────────────────────────────────────────
   SKELETON
   ───────────────────────────────────────────── */
const SkeletonCard = () => (
    <div
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '12px 14px',
            background: COLORS.cardBg,
            borderRadius: 14,
            border: `1px solid ${COLORS.cardBorder}`,
        }}
    >
        <div style={{ width: 56, height: 56, borderRadius: 10, background: '#1a1a24', animation: 'fplPulse 1.4s ease infinite' }} />
        <div style={{ flex: 1 }}>
            <div style={{ width: '55%', height: 12, borderRadius: 4, background: '#1a1a24', marginBottom: 8, animation: 'fplPulse 1.4s ease infinite' }} />
            <div style={{ width: '35%', height: 10, borderRadius: 4, background: '#1a1a24', animation: 'fplPulse 1.4s ease infinite' }} />
        </div>
        <div style={{ width: 60, height: 28, borderRadius: 6, background: '#1a1a24', animation: 'fplPulse 1.4s ease infinite' }} />
    </div>
);

/* ─────────────────────────────────────────────
   MARKET CARD
   ───────────────────────────────────────────── */
const MarketCard = ({ player, rank, maxTransfers }) => {
    const heatPercent = maxTransfers > 0 ? (player.transfers_in_event / maxTransfers) * 100 : 0;
    const isHotForm = parseFloat(player.form) > 7.0;

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '12px 14px',
                background: COLORS.cardBg,
                borderRadius: 14,
                border: `1px solid ${COLORS.cardBorder}`,
                backdropFilter: 'blur(8px)',
                transition: 'background 0.2s',
            }}
        >
            {/* ── LEFT: Headshot + Rank ── */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
                <img
                    src={player.photo_url}
                    alt={player.web_name}
                    style={{
                        width: 56,
                        height: 56,
                        borderRadius: 10,
                        objectFit: 'cover',
                        background: '#1a1a24',
                    }}
                    loading="lazy"
                />
                <span
                    style={{
                        position: 'absolute',
                        top: -6,
                        left: -6,
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: COLORS.amberGold,
                        color: '#000',
                        fontFamily: FONT,
                        fontWeight: 900,
                        fontSize: 11,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(245,166,35,0.4)',
                    }}
                >
                    {rank}
                </span>
            </div>

            {/* ── CENTER: Identity ── */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                        style={{
                            fontFamily: FONT,
                            fontWeight: 700,
                            fontSize: 14,
                            color: COLORS.white,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {player.web_name}
                    </span>
                    <span
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: isHotForm ? COLORS.emerald : COLORS.grey,
                            flexShrink: 0,
                            boxShadow: isHotForm ? '0 0 6px rgba(52,211,153,0.6)' : 'none',
                        }}
                    />
                </div>
                <span
                    style={{
                        fontFamily: FONT,
                        fontWeight: 500,
                        fontSize: 11,
                        color: COLORS.grey,
                        marginTop: 2,
                        display: 'block',
                    }}
                >
                    {player.team_name}
                </span>
                <span
                    style={{
                        fontFamily: FONT,
                        fontWeight: 600,
                        fontSize: 10,
                        color: COLORS.greyLight,
                        marginTop: 3,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                    }}
                >
                    {player.total_points} pts · £{player.now_cost}m
                </span>
            </div>

            {/* ── RIGHT: Transfers + Heat Bar ── */}
            <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 80 }}>
                <div
                    style={{
                        fontFamily: FONT,
                        fontWeight: 800,
                        fontSize: 18,
                        color: COLORS.electricCyan,
                        lineHeight: 1,
                        textShadow: `0 0 12px ${COLORS.cyanGlow}`,
                    }}
                >
                    {(player.transfers_in_event ?? 0).toLocaleString()}
                </div>
                <span
                    style={{
                        fontFamily: FONT,
                        fontWeight: 600,
                        fontSize: 9,
                        color: COLORS.grey,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                    }}
                >
                    transfers in
                </span>
                <div
                    style={{
                        marginTop: 6,
                        height: 4,
                        borderRadius: 2,
                        background: COLORS.heatTrack,
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            width: `${heatPercent}%`,
                            height: '100%',
                            borderRadius: 2,
                            background: `linear-gradient(90deg, ${COLORS.electricCyan}, ${COLORS.amberGold})`,
                            transition: 'width 0.6s ease',
                            boxShadow: `0 0 8px ${COLORS.cyanGlow}`,
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────────
   FPL MARKET PAGE
   ───────────────────────────────────────────── */
const FPLMarket = () => {
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchPlayers = async () => {
            try {
                const { data, error } = await supabase
                    .from('fpl_transfers')
                    .select('*')
                    .order('transfers_in_event', { ascending: false })
                    .limit(20);

                if (error) throw error;
                setPlayers(data || []);
            } catch (err) {
                console.error('[FPLMarket] Fetch error:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchPlayers();
    }, []);

    const maxTransfers = players.length > 0 ? players[0].transfers_in_event : 1;

    return (
        <div
            style={{
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                background: COLORS.bg,
                overflow: 'hidden',
            }}
        >
            {/* ── Pulse Keyframe ── */}
            <style>{`
                @keyframes fplPulse {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 0.8; }
                }
            `}</style>

            {/* ── Sticky Header: Back Button + Title + Assistant ── */}
            <div
                style={{
                    flexShrink: 0,
                    zIndex: 50,
                    background: COLORS.bg,
                    padding: '0 16px',
                }}
            >
                {/* Top Bar */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '16px 2px 10px',
                    }}
                >
                    <button
                        onClick={() => navigate('/manager-office')}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: COLORS.electricCyan,
                            cursor: 'pointer',
                            padding: 4,
                            display: 'flex',
                        }}
                        aria-label="Back to Office"
                    >
                        <ArrowLeft size={22} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <TrendingUp size={18} color={COLORS.electricCyan} />
                        <span
                            style={{
                                fontFamily: FONT,
                                fontWeight: 800,
                                fontSize: 16,
                                color: COLORS.white,
                                letterSpacing: '0.5px',
                            }}
                        >
                            FPL Market
                        </span>
                    </div>
                    <Flame
                        size={16}
                        color={COLORS.amberGold}
                        style={{ marginLeft: 'auto', opacity: 0.7 }}
                    />
                </div>

                {/* Assistant Manager Dialogue */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        marginBottom: 12,
                        padding: '10px 14px',
                        background: '#f5f0e8',
                        borderRadius: 14,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2)',
                    }}
                >
                    <img
                        src="/assets/assistant-head.png"
                        alt="Tactical Expert"
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            flexShrink: 0,
                            border: '2px solid rgba(0,0,0,0.08)',
                        }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <span
                            style={{
                                fontFamily: FONT,
                                fontWeight: 700,
                                fontSize: 9,
                                color: '#888',
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                            }}
                        >
                            Tactical Expert
                        </span>
                        <p
                            style={{
                                fontFamily: FONT,
                                fontWeight: 700,
                                fontSize: 12,
                                color: '#121212',
                                margin: '3px 0 0',
                                lineHeight: 1.35,
                            }}
                        >
                            Hi Boss. The market is moving fast. These are the names everyone is chasing today.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Scrollable Content ── */}
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    padding: '0 16px',
                }}
            >
                {/* Tactical Glass Container */}
                <div
                    style={{
                        background: COLORS.glass,
                        backdropFilter: 'blur(20px)',
                        borderRadius: 18,
                        border: `1px solid rgba(255,255,255,0.06)`,
                        padding: '14px 12px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    }}
                >
                    {/* Section Title */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginBottom: 14,
                            paddingLeft: 4,
                        }}
                    >
                        <Flame size={14} color={COLORS.amberGold} />
                        <span
                            style={{
                                fontFamily: FONT,
                                fontWeight: 700,
                                fontSize: 11,
                                color: COLORS.grey,
                                textTransform: 'uppercase',
                                letterSpacing: '1.2px',
                            }}
                        >
                            Scouting List — Most Transferred In
                        </span>
                    </div>

                    {/* Player Cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {loading
                            ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
                            : players.map((p, i) => (
                                <MarketCard
                                    key={p.player_id}
                                    player={p}
                                    rank={i + 1}
                                    maxTransfers={maxTransfers}
                                />
                            ))
                        }
                        {!loading && players.length === 0 && (
                            <div
                                style={{
                                    textAlign: 'center',
                                    padding: '40px 20px',
                                    fontFamily: FONT,
                                    fontSize: 13,
                                    color: COLORS.grey,
                                }}
                            >
                                No market data yet. The next sync will populate this list.
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom padding so last card isn't clipped */}
                <div style={{ height: 40, flexShrink: 0 }} />
            </div>
        </div>
    );
};

export default FPLMarket;
