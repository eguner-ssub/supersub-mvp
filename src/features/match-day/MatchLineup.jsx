import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   FORMATION GRID ENGINE
   Converts API-Football grid strings ("row:col") into
   percentage-based CSS positions on each team's half.
   ───────────────────────────────────────────────────────────── */

/**
 * Parse the formation string (e.g. "4-3-3") into an array of row counts.
 * GK is always row 1, so "4-3-3" → [1, 4, 3, 3]  (keeper + outfield rows)
 */
const parseFormation = (formation) => {
    if (!formation) return [1, 4, 4, 2]; // fallback 4-4-2
    return [1, ...formation.split('-').map(Number)];
};

/**
 * Convert a grid string like "3:2" into { row, col }.
 * row = vertical rank (1 = GK), col = horizontal position within that row
 */
const parseGrid = (gridStr) => {
    if (!gridStr) return null;
    const [row, col] = gridStr.split(':').map(Number);
    return { row, col };
};

/**
 * Map a team's startXI into positioned array.
 * Returns [{ player, top%, left% }]
 *
 * @param {Array} startXI  - API array: [{ player: { id, name, number, pos, grid }}]
 * @param {string} formation - e.g. "4-3-3"
 * @param {boolean} inverted - true for Away team (flipped vertically)
 */
const mapFormation = (startXI, formation, inverted = false) => {
    const rows = parseFormation(formation);
    const totalRows = rows.length;

    return startXI.map((entry) => {
        const p = entry.player;
        const grid = parseGrid(p.grid);

        if (!grid) {
            return { player: p, top: 50, left: 50 }; // center fallback
        }

        const { row, col } = grid;
        const colsInRow = rows[row - 1] || 1;

        // Vertical position — spread rows evenly within the team's half (0-100%)
        const topRatio = (row - 0.5) / totalRows;
        let top = topRatio * 100;

        // Horizontal position — spread columns evenly
        const left = (col / (colsInRow + 1)) * 100;

        if (inverted) {
            top = 100 - top; // Flip for away team half
        }

        return { player: p, top, left };
    });
};


/* ─────────────────────────────────────────────────────────────
   PITCH STYLES — all inline to keep this self-contained.
   Deep Slate-Green, desaturated, matte cardstock feel.
   ───────────────────────────────────────────────────────────── */

const PITCH_BG = '#1a2e1a';

const pitchContainerStyle = {
    position: 'relative',
    width: '100%',
    aspectRatio: '3 / 5',
    background: PITCH_BG,
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: 'inset 0 0 40px rgba(0,0,0,0.5)',
    filter: 'saturate(0.7)',  /* 30% desaturation */
};

/* Paper-grain overlay — multiply blend on matte cardstock */
const grainOverlayStyle = {
    position: 'absolute',
    inset: 0,
    zIndex: 1,
    opacity: 0.10,
    mixBlendMode: 'multiply',
    pointerEvents: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
    backgroundSize: '128px 128px',
};


/* ─────────────────────────────────────────────────────────────
   PLAYER NODE
   Circular off-white matte-paper node with number + name.
   ───────────────────────────────────────────────────────────── */

const PlayerNode = ({ player }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', width: '48px' }}>
        {/* Circle — shrunk 20% */}
        <div
            style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: '#f5f0e8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.3)',
                border: '1.5px solid rgba(0,0,0,0.08)',
            }}
        >
            <span
                style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 700,
                    fontSize: '11px',
                    color: '#121212',
                    lineHeight: 1,
                }}
            >
                {player.number}
            </span>
        </div>
        {/* Name — centred, Montserrat Bold */}
        <span
            style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: '8px',
                color: '#ffffff',
                textAlign: 'center',
                lineHeight: 1.15,
                textShadow: '0 1px 3px rgba(0,0,0,0.7)',
                maxWidth: '52px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
            }}
        >
            {player.name?.split(' ').pop()}
        </span>
    </div>
);


/* ─────────────────────────────────────────────────────────────
   TACTICAL MARKINGS — SVG layer for pitch lines
   Softened to low-opacity off-white.
   ───────────────────────────────────────────────────────────── */

const LINE_COLOR = 'rgba(255,255,255,0.08)';
const SPOT_COLOR = 'rgba(255,255,255,0.10)';

const PitchMarkings = () => (
    <svg
        viewBox="0 0 100 166"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none' }}
    >
        {/* Pitch border */}
        <rect x="4" y="3" width="92" height="160" rx="2" fill="none" stroke={LINE_COLOR} strokeWidth="0.5" />

        {/* Halfway line */}
        <line x1="4" y1="83" x2="96" y2="83" stroke={LINE_COLOR} strokeWidth="0.5" />

        {/* Center circle */}
        <circle cx="50" cy="83" r="12" fill="none" stroke={LINE_COLOR} strokeWidth="0.5" />
        <circle cx="50" cy="83" r="1" fill={SPOT_COLOR} />

        {/* ── TOP HALF (Home) ── */}
        <rect x="18" y="3" width="64" height="22" fill="none" stroke={LINE_COLOR} strokeWidth="0.5" />
        <rect x="30" y="3" width="40" height="10" fill="none" stroke={LINE_COLOR} strokeWidth="0.5" />
        <circle cx="50" cy="18" r="0.8" fill={SPOT_COLOR} />
        <path d="M 34 25 A 12 12 0 0 0 66 25" fill="none" stroke={LINE_COLOR} strokeWidth="0.5" />

        {/* ── BOTTOM HALF (Away) ── */}
        <rect x="18" y="141" width="64" height="22" fill="none" stroke={LINE_COLOR} strokeWidth="0.5" />
        <rect x="30" y="153" width="40" height="10" fill="none" stroke={LINE_COLOR} strokeWidth="0.5" />
        <circle cx="50" cy="148" r="0.8" fill={SPOT_COLOR} />
        <path d="M 34 141 A 12 12 0 0 1 66 141" fill="none" stroke={LINE_COLOR} strokeWidth="0.5" />
    </svg>
);


/* ─────────────────────────────────────────────────────────────
   TEAM HALF — Renders positioned player nodes for one team
   ───────────────────────────────────────────────────────────── */

const TeamHalf = ({ positioned, teamLogo, teamName, isAway }) => (
    <div
        style={{
            position: 'absolute',
            left: '4%',
            right: '4%',
            top: isAway ? '51.5%' : '2%',
            height: '46.5%',
            zIndex: 5,
        }}
    >
        {/* Team badge watermark */}
        <img
            src={teamLogo}
            alt={teamName}
            style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: '48px',
                height: '48px',
                objectFit: 'contain',
                opacity: 0.08,
                pointerEvents: 'none',
            }}
        />
        {/* Players */}
        {positioned.map((p, i) => (
            <div
                key={p.player.id || i}
                style={{
                    position: 'absolute',
                    top: `${p.top}%`,
                    left: `${p.left}%`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 10,
                }}
            >
                <PlayerNode player={p.player} />
            </div>
        ))}
    </div>
);


/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
   ───────────────────────────────────────────────────────────── */

const MatchLineup = ({ fixtureId, matchPhase, fixtureDate }) => {
    const [lineups, setLineups] = useState(null);
    const [lineupStatus, setLineupStatus] = useState(null); // 'probable' | 'confirmed'
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!fixtureId) return;

        const fetchLineups = async () => {
            try {
                setLoading(true);
                const res = await fetch(`/api/lineups?fixture=${fixtureId}`);
                const data = await res.json();

                if (data.response && data.response.length >= 2) {
                    setLineups(data.response);

                    // Determine probable vs confirmed
                    const hasGridData = data.response[0]?.startXI?.some(
                        (p) => p.player?.grid
                    );
                    const kickoff = new Date(fixtureDate);
                    const now = new Date();
                    const msUntilKickoff = kickoff - now;
                    const oneHourMs = 60 * 60 * 1000;

                    if (hasGridData && msUntilKickoff <= oneHourMs) {
                        setLineupStatus('confirmed');
                    } else if (data.response[0]?.startXI?.length > 0) {
                        setLineupStatus('probable');
                    } else {
                        setLineupStatus('probable');
                    }
                } else {
                    setError('no_data');
                }
            } catch (err) {
                console.error('[MatchLineup] Error fetching lineups:', err);
                setError('fetch_error');
            } finally {
                setLoading(false);
            }
        };

        fetchLineups();
    }, [fixtureId, fixtureDate]);

    // Don't render anything on error or empty
    if (error) return null;

    // Loading state
    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '48px 0' }}>
                <Loader2 className="animate-spin text-white/40 w-6 h-6" />
            </div>
        );
    }

    if (!lineups || lineups.length < 2) return null;

    const homeTeam = lineups[0];
    const awayTeam = lineups[1];

    const homePositioned = mapFormation(homeTeam.startXI || [], homeTeam.formation, false);
    const awayPositioned = mapFormation(awayTeam.startXI || [], awayTeam.formation, true);

    return (
        <div style={{ padding: '0 12px', marginBottom: '16px' }}>
            {/* ── ASSISTANT DIALOGUE BOX — physical memo on tactical board ── */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    marginBottom: '14px',
                    padding: '10px 14px',
                    background: '#f5f0e8',
                    borderRadius: '14px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2)',
                }}
            >
                <img
                    src="/assets/assistant-head.png"
                    alt="Tactical Expert"
                    style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flexShrink: 0,
                        border: '2px solid rgba(0,0,0,0.08)',
                    }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <span
                        style={{
                            fontFamily: "'Montserrat', sans-serif",
                            fontWeight: 700,
                            fontSize: '9px',
                            color: '#888',
                            textTransform: 'uppercase',
                            letterSpacing: '1px',
                        }}
                    >
                        Tactical Expert
                    </span>
                    <p
                        style={{
                            fontFamily: "'Montserrat', sans-serif",
                            fontWeight: 700,
                            fontSize: '12px',
                            color: '#121212',
                            margin: '3px 0 0',
                            lineHeight: 1.35,
                        }}
                    >
                        Hi Boss. Here is the tactical setup. Home team looks strong today.
                    </p>
                </div>
            </div>

            {/* ── STATUS BADGE — Electric Cyan on Ink-Black when confirmed ── */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
                <span
                    style={{
                        fontFamily: "'Montserrat', sans-serif",
                        fontWeight: 700,
                        fontSize: '9px',
                        letterSpacing: '1.5px',
                        textTransform: 'uppercase',
                        padding: '4px 14px',
                        borderRadius: '20px',
                        color: lineupStatus === 'confirmed' ? '#00e5ff' : '#f59e0b',
                        background: lineupStatus === 'confirmed' ? 'rgba(18,18,18,0.9)' : 'rgba(245,158,11,0.1)',
                        border: `1px solid ${lineupStatus === 'confirmed' ? 'rgba(0,229,255,0.3)' : 'rgba(245,158,11,0.25)'}`,
                    }}
                >
                    {lineupStatus === 'confirmed' ? '● Confirmed Lineup' : '◐ Probable Lineup'}
                </span>
            </div>

            {/* ── PITCH ── */}
            <div style={pitchContainerStyle}>
                {/* Paper grain overlay */}
                <div style={grainOverlayStyle} />

                {/* SVG tactical markings */}
                <PitchMarkings />

                {/* ── FORMATION LABEL: Home — top-left inside pitch ── */}
                <div
                    style={{
                        position: 'absolute',
                        top: '8px',
                        left: '12px',
                        zIndex: 15,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                    }}
                >
                    <img
                        src={homeTeam.team?.logo}
                        alt=""
                        style={{ width: '16px', height: '16px', objectFit: 'contain' }}
                    />
                    <span
                        style={{
                            fontFamily: "'Montserrat', sans-serif",
                            fontWeight: 700,
                            fontSize: '10px',
                            color: 'rgba(255,255,255,0.6)',
                            textTransform: 'uppercase',
                        }}
                    >
                        {homeTeam.formation}
                    </span>
                </div>

                {/* ── FORMATION LABEL: Away — bottom-right inside pitch (mirrored) ── */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: '8px',
                        right: '12px',
                        zIndex: 15,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                    }}
                >
                    <span
                        style={{
                            fontFamily: "'Montserrat', sans-serif",
                            fontWeight: 700,
                            fontSize: '10px',
                            color: 'rgba(255,255,255,0.6)',
                            textTransform: 'uppercase',
                        }}
                    >
                        {awayTeam.formation}
                    </span>
                    <img
                        src={awayTeam.team?.logo}
                        alt=""
                        style={{ width: '16px', height: '16px', objectFit: 'contain' }}
                    />
                </div>

                {/* Home Team — top half */}
                <TeamHalf
                    positioned={homePositioned}
                    teamLogo={homeTeam.team?.logo}
                    teamName={homeTeam.team?.name}
                    isAway={false}
                />

                {/* Away Team — bottom half */}
                <TeamHalf
                    positioned={awayPositioned}
                    teamLogo={awayTeam.team?.logo}
                    teamName={awayTeam.team?.name}
                    isAway={true}
                />
            </div>
        </div>
    );
};

export default MatchLineup;
