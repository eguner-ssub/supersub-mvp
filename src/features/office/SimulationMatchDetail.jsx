import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, X, Trophy, ChevronDown, Check } from 'lucide-react';
import CardBase from '../../shared/ui/CardBase';
import {
  PlayerNode,
  PitchMarkings,
  TeamHalf,
  pitchContainerStyle,
  grainOverlayStyle,
  mapFormation,
} from '../match-day/MatchLineup';

/* ─── Settlement keyframe animations ─────────────────────────── */
const SETTLEMENT_KEYFRAMES = `
  @keyframes clockTick { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  @keyframes winner-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
`;

/* ─── Card shelf arrow-bounce animation ───────────────────────── */
const CARD_SHELF_KEYFRAMES = `
  @keyframes arrowBounce {
    0%, 100% { transform: translate(-50%, 0); }
    50%       { transform: translate(-50%, 5px); }
  }
  .onboarding-arrow {
    position: absolute;
    top: -16px;
    left: 50%;
    color: #10b981;
    z-index: 20;
    pointer-events: none;
    animation: arrowBounce 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    filter: drop-shadow(0 0 6px rgba(16,185,129,0.6));
    will-change: transform;
  }
`;

/* ─── Static match data ───────────────────────────────────────── */

const SIM_MATCH = {
  id: 'sim_lfc_barca_2019',
  home_team: 'Liverpool',
  away_team: 'Barcelona',
  home_logo: 'https://cdn.sportmonks.com/images/soccer/teams/8/8.png',
  away_logo: 'https://cdn.sportmonks.com/images/soccer/teams/19/83.png',
  date_display: '7 May 2019',
  league_name: 'UEFA Champions League — Semi-Final 2nd Leg',
};

/* ─── Hardcoded formations — Liverpool 4-3-3 vs Barcelona 4-3-3 ─ */

const LFC_FORMATION = '4-3-3';
const LFC_XI = [
  { player: { id: 1, name: 'Alisson', number: '1', grid: '1:1' } },
  // Defensive line L→R: Robertson (LB), Matip (CB), Van Dijk (CB), Trent (RB)
  { player: { id: 5, name: 'Robertson', number: '26', grid: '2:1' } },
  { player: { id: 3, name: 'Matip', number: '32', grid: '2:2' } },
  { player: { id: 4, name: 'Van Dijk', number: '4', grid: '2:3' } },
  { player: { id: 2, name: 'Trent', number: '66', grid: '2:4' } },
  // Midfield L→R: Henderson, Fabinho, Milner
  { player: { id: 6, name: 'Henderson', number: '14', grid: '3:1' } },
  { player: { id: 7, name: 'Fabinho', number: '3', grid: '3:2' } },
  { player: { id: 8, name: 'Milner', number: '7', grid: '3:3' } },
  // Attack L→R: Mané, Origi, Shaqiri
  { player: { id: 11, name: 'Mané', number: '10', grid: '4:1' } },
  { player: { id: 10, name: 'Origi', number: '27', grid: '4:2' } },
  { player: { id: 9, name: 'Shaqiri', number: '23', grid: '4:3' } },
];

const BAR_FORMATION = '4-3-3';
const BAR_XI = [
  { player: { id: 20, name: 'Ter Stegen', number: '1', grid: '1:1' } },
  { player: { id: 21, name: 'Sergi Roberto', number: '20', grid: '2:4' } },
  { player: { id: 22, name: 'Piqué', number: '3', grid: '2:3' } },
  { player: { id: 23, name: 'Lenglet', number: '15', grid: '2:2' } },
  { player: { id: 24, name: 'Jordi Alba', number: '18', grid: '2:1' } },
  { player: { id: 25, name: 'Vidal', number: '22', grid: '3:3' } },
  { player: { id: 26, name: 'Busquets', number: '5', grid: '3:2' } },
  { player: { id: 27, name: 'Rakitić', number: '4', grid: '3:1' } },
  { player: { id: 28, name: 'Messi', number: '10', grid: '4:3' } },
  { player: { id: 29, name: 'Suárez', number: '9', grid: '4:2' } },
  { player: { id: 30, name: 'Coutinho', number: '7', grid: '4:1' } },
];

/* ─── Bench data ──────────────────────────────────────────────── */

const SIM_BENCH = [
  { player_id: 1001, player_name: 'S. Mignolet', position: 'GK', context: null },
  { player_id: 1002, player_name: 'D. Lovren', position: 'CB', context: null },
  { player_id: 1003, player_name: 'J. Gomez', position: 'CB/RB', context: null },
  { player_id: 1004, player_name: 'G. Wijnaldum', position: 'MF', context: '32 starts in last 35 league games' },
  { player_id: 1005, player_name: 'B. Woodburn', position: 'MF', context: null },
  { player_id: 1006, player_name: 'R. Brewster', position: 'FW', context: null },
  { player_id: 1007, player_name: 'D. Sturridge', position: 'FW', context: '20 of 27 appearances from bench this season' },
];

const SCORERS = [
  { player_id: 2001, player_name: 'D. Origi' },
  { player_id: 2002, player_name: 'S. Mané' },
  { player_id: 2003, player_name: 'X. Shaqiri' },
];

const INJURED = [
  { player_name: 'M. Salah' },
  { player_name: 'R. Firmino' },
];

const CARD_TYPES = [
  { id: 'c_match_result', label: 'Match Result' },
  { id: 'c_total_goals',  label: 'Total Goals'  },
  { id: 'c_player_score', label: 'Player Score' },
  { id: 'c_supersub',     label: 'Supersub'     },
];

const TABS = ['LINEUP', 'SUBS', 'EVENTS', 'STATS'];

/* ─── Sim rewards ─────────────────────────────────────────────── */

const SIM_REWARDS = {
  HOME_WIN: 200, DRAW: 400, AWAY_WIN: 1000,
  OVER_2_5: 200, UNDER_2_5: 350,
  'D. Origi': 600, 'S. Mané': 450, 'X. Shaqiri': 800,
  BENCH: 500, SUPERSUB_SPECIFIC: 2500,
  DEFAULT_SCORER: 600,
};

/* ─── Joseba messages ─────────────────────────────────────────── */

const JOSEBA_MESSAGES = [
  "7th of May, 2019. Anfield. Liverpool are 3-0 down from the first leg. Salah and Firmino are both injured. The whole world has written them off. This is exactly when the bench matters most. Tap Match Result to make your call.",
  "Liverpool haven't lost a home European match in over five years. 22 unbeaten at Anfield in Europe. Barcelona are 3-0 up on aggregate. But this ground has a history of the impossible. Pick your result.",
  "Now the goals. Tap Total Goals.",
  "No Salah. No Firmino. The obvious read is fewer goals. But Liverpool's home European games this season averaged more than 3 goals in total. A team chasing four goals has no reason to sit back. Trust the pattern, not the headline.",
  "Now pick a scorer. Tap Player Score.",
  "With Salah and Firmino out, Klopp needs someone else up front. Divock Origi starts tonight. He scored against Everton in the 96th minute in December. He saved his best for when it matters. Pick your goalscorer.",
  "Last one — and the most important one. Tap Supersub.",
  "Two ways to play this. Back the bench as a whole — any substitute who scores wins you 500 points. Or go specific — pick one player, and if they come on and score, you win 2,500. Look at Wijnaldum. He's started 32 of Liverpool's last 35 league games. Their most-used midfielder. Klopp almost never drops him. When a manager saves his best midfielder for a 3-0 deficit, he's not leaving him out. He's loading a weapon. Make your call.",
  "Calls made. Let's see if the match agrees with you.",
  "Liverpool 4-0 Barcelona. One of the greatest nights in European football — and you read it. Wijnaldum came on at half-time. Two goals in two minutes. Origi opened and closed the scoring. The bench won this match. These were simulation cards. Your real cards are waiting.",
];

/* ─── Shared content panel style — mirrors real MatchDetail ──── */
const CONTENT_PANEL = {
  margin: '8px 0',
  background: 'rgba(18,18,18,0.75)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  borderLeft: '1px solid rgba(255,255,255,0.10)',
  borderRight: '1px solid rgba(255,255,255,0.10)',
  padding: '16px 0',
};

/* ─── Inline Joseba intel box — compact collapsible ── */
const JosebaIntelBox = ({ message, isTappable, onTap }) => {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '8px',
        margin: '0 12px 10px', padding: '10px 12px',
        background: '#f5f0e8', borderRadius: '14px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2)',
        cursor: isTappable ? 'pointer' : 'default',
        position: 'relative',
      }}
      onClick={isTappable ? onTap : undefined}
    >
      <img
        src="/assets/assistant-head.png"
        alt="Joseba"
        style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid rgba(0,0,0,0.08)' }}
      />
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '9px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Joseba · Analyst
        </span>
        <div style={{ maxHeight: collapsed ? '3.5rem' : '40vh', overflow: collapsed ? 'hidden' : 'auto', transition: 'max-height 0.2s ease' }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '12px', color: '#121212', margin: '2px 0 0', lineHeight: 1.35 }}>
            {message}
          </p>
          {isTappable && (
            <p style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '9px', color: '#888', marginTop: 4, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Tap to continue ›
            </p>
          )}
        </div>
      </div>
      {!isTappable && (
        <button
          onClick={(e) => { e.stopPropagation(); setCollapsed(v => !v); }}
          style={{ position: 'absolute', bottom: 6, right: 8, color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          <ChevronDown style={{ width: 14, height: 14, transform: collapsed ? 'none' : 'rotate(180deg)', transition: 'transform 0.2s ease' }} />
        </button>
      )}
    </div>
  );
};

/* ─── Component ───────────────────────────────────────────────── */

const SimulationMatchDetail = ({ onComplete, onBack }) => {
  const [step, setStep] = useState(0);
  const [activeCard, setActiveCard] = useState('c_match_result');
  const [openSheet, setOpenSheet] = useState(null);
  const [activeTab, setActiveTab] = useState('LINEUP');

  // Staging + locked-in state (replaces pendingX vars)
  const [simStaged, setSimStaged] = useState(null); // { label, reward }
  const [showLockedIn, setShowLockedIn] = useState(false);
  const pendingAdvanceRef = useRef(null);
  const bannerNextStepRef = useRef(null); // captures {nextStep, nextCard} for tap-dismiss

  // Settlement state
  const [settling, setSettling] = useState(false);
  const [settled, setSettled] = useState(false);
  const [settlementMinute, setSettlementMinute] = useState("0'");
  const [settlementScore, setSettlementScore] = useState({ home: 0, away: 0 });
  const [goalPopup, setGoalPopup] = useState(null);
  const [showWinnerPopup, setShowWinnerPopup] = useState(false);

  /* Settlement animation — PayoffView style */
  useEffect(() => {
    if (!settling) return;
    const GOALS_TIMELINE = [
      { delay: 600, minute: "7'", scorer: 'Origi', score: { home: 1, away: 0 } },
      { delay: 2800, minute: "54'", scorer: 'Wijnaldum', score: { home: 2, away: 0 } },
      { delay: 5000, minute: "56'", scorer: 'Wijnaldum', score: { home: 3, away: 0 } },
      { delay: 7200, minute: "79'", scorer: 'Origi', score: { home: 4, away: 0 } },
    ];
    const timeouts = [];
    GOALS_TIMELINE.forEach(({ delay, minute, scorer, score }) => {
      timeouts.push(setTimeout(() => {
        setSettlementMinute(minute);
        setSettlementScore(score);
        setGoalPopup({ scorer, minute });
        timeouts.push(setTimeout(() => setGoalPopup(null), 2000));
      }, delay));
    });
    timeouts.push(setTimeout(() => {
      setSettlementMinute('FT');
      setShowWinnerPopup(true);
      setSettled(true);
      setSettling(false);
      setStep(9);
    }, 9800));
    return () => timeouts.forEach(clearTimeout);
  }, [settling]);

  /* Lock body scroll while confirm sheet is visible */
  useEffect(() => {
    if (simStaged && openSheet) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [simStaged, openSheet]);

  /* Bubble advance — only tappable steps (1, 3, 5, 7, 8) */
  const handleBubbleAdvance = () => {
    switch (step) {
      case 0: /* display only */ break;
      case 1: setStep(2); setActiveCard('c_total_goals'); break;
      case 2: /* display only */ break;
      case 3: setStep(4); setActiveCard('c_player_score'); break;
      case 4: /* display only */ break;
      case 5: setStep(6); setActiveCard('c_supersub'); break;
      case 6: /* display only */ break;
      case 7: setStep(8); setActiveCard(null); break;
      case 8: setSettling(true); break;
      case 9: onComplete(); break;
      default: break;
    }
  };

  /* Tap-to-dismiss: clear auto-advance timeout and fire narrative immediately */
  const dismissBanner = () => {
    if (pendingAdvanceRef.current) clearTimeout(pendingAdvanceRef.current);
    setShowLockedIn(false);
    if (bannerNextStepRef.current) {
      const { nextStep, nextCard } = bannerNextStepRef.current;
      bannerNextStepRef.current = null;
      setStep(nextStep);
      setActiveCard(nextCard);
    }
  };

  /* Card tile tap — opens sheet directly */
  const handleCardTap = (cardId) => {
    if (cardId !== activeCard) return;
    switch (cardId) {
      case 'c_match_result': setOpenSheet('match_result'); break;
      case 'c_total_goals': setOpenSheet('total_goals'); break;
      case 'c_player_score': setOpenSheet('player_score'); break;
      case 'c_supersub': setOpenSheet('supersub'); break;
      default: break;
    }
  };

  /* Confirm Play — shared handler reads openSheet to know which card */
  const handleSimConfirm = () => {
    const sheet = openSheet;
    setSimStaged(null);
    setOpenSheet(null);

    // Determine which step this card sets, and the next step to auto-advance to
    let confirmedStep, nextStep, nextCard;
    if (sheet === 'match_result')  { confirmedStep = 1; nextStep = 2; nextCard = 'c_total_goals'; }
    else if (sheet === 'total_goals') { confirmedStep = 3; nextStep = 4; nextCard = 'c_player_score'; }
    else if (sheet === 'player_score') { confirmedStep = 5; nextStep = 6; nextCard = 'c_supersub'; }
    else if (sheet === 'supersub')    { confirmedStep = 7; nextStep = 8; nextCard = null; }

    setStep(confirmedStep);
    setActiveCard(null);
    setShowLockedIn(true);

    // Clear any previous pending timeout
    if (pendingAdvanceRef.current) clearTimeout(pendingAdvanceRef.current);
    bannerNextStepRef.current = { nextStep, nextCard };

    // Auto-dismiss banner after 3.5 s then advance narrative
    pendingAdvanceRef.current = setTimeout(() => {
      setShowLockedIn(false);
      bannerNextStepRef.current = null;
      setStep(nextStep);
      setActiveCard(nextCard);
    }, 3500);
  };

  /* Pre-compute formation positions */
  const lfcPositioned = mapFormation(LFC_XI, LFC_FORMATION, false);
  const barPositioned = mapFormation(BAR_XI, BAR_FORMATION, true);

  const isTappable = [1, 3, 5, 7, 8].includes(step);

  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden font-sans select-none">
      <style>{CARD_SHELF_KEYFRAMES}</style>

      {/* ── HEADER ────────────────────────────────────────────── */}
      <div className="flex-shrink-0 w-full z-40 bg-black/80 backdrop-blur-md border-b border-white/10">
        {/* Row 1: Back + League */}
        <div className="flex items-center justify-between px-4 pt-10 pb-2 gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 flex-shrink-0 bg-white/10 border border-white/20 rounded-full flex items-center justify-center text-white active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="flex-1 text-center text-[10px] font-black uppercase tracking-widest text-zinc-400 truncate">
            {SIM_MATCH.league_name}
          </span>
          <div className="w-9" />
        </div>

        {/* Row 2: Teams + VS + date */}
        <div className="flex items-center justify-between px-4 pb-3 gap-3">
          <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <img
              src={SIM_MATCH.home_logo}
              className="w-9 h-9 object-contain"
              alt="Liverpool"
            />
            <span className="text-[10px] font-bold text-white uppercase truncate w-full text-center">
              {SIM_MATCH.home_team}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center flex-shrink-0 px-2">
            <span className="text-[9px] font-bold tracking-widest uppercase mb-1 leading-none text-zinc-400">
              {SIM_MATCH.date_display}
            </span>
            <div className="text-2xl font-black text-white font-mono leading-none">VS</div>
          </div>

          <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <img
              src={SIM_MATCH.away_logo}
              className="w-9 h-9 object-contain"
              alt="Barcelona"
            />
            <span className="text-[10px] font-bold text-white uppercase truncate w-full text-center">
              {SIM_MATCH.away_team}
            </span>
          </div>
        </div>
      </div>

      {/* ── TAB BAR ───────────────────────────────────────────── */}
      <div className="flex-shrink-0 w-full z-[35]">
        <div
          style={{
            display: 'flex',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: '1 0 auto',
                padding: '10px 18px',
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 800,
                fontSize: '10px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                color: activeTab === tab ? '#00e5ff' : 'rgba(255,255,255,0.35)',
                background: 'transparent',
              }}
            >
              {tab}
              {activeTab === tab && (
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: '20%',
                  right: '20%',
                  height: '2px',
                  background: '#00e5ff',
                  borderRadius: '1px',
                  boxShadow: '0 0 8px rgba(0,229,255,0.4)',
                }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB CONTENT ───────────────────────────────────────── */}
      <div
        className="flex-1 w-full z-30 overflow-y-auto overscroll-contain scrollbar-hide pb-48"
        style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
      >
        <div style={CONTENT_PANEL}>

          {/* ── JOSEBA INTEL BOX — first item in content panel ── */}
          {!settling && !settled && (
            <JosebaIntelBox
              message={JOSEBA_MESSAGES[step]}
              isTappable={isTappable}
              onTap={handleBubbleAdvance}
            />
          )}

          {/* ── LINEUP — pitch formation diagram ─────────────── */}
          {activeTab === 'LINEUP' && (
            <div style={{ padding: '0 12px' }}>
              {/* Formation label row — Liverpool only (left); Barça label inside pitch */}
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <img
                    src={SIM_MATCH.home_logo}
                    style={{ width: 16, height: 16, objectFit: 'contain' }}
                    alt=""
                  />
                  <span style={{
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 800,
                    fontSize: '10px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase',
                  }}>
                    {LFC_FORMATION}
                  </span>
                </div>
              </div>

              {/* Pitch */}
              <div style={{ ...pitchContainerStyle, position: 'relative' }}>
                <div style={grainOverlayStyle} />
                <PitchMarkings />
                <TeamHalf
                  positioned={lfcPositioned}
                  teamLogo={SIM_MATCH.home_logo}
                  teamName="Liverpool"
                  isAway={false}
                />
                <TeamHalf
                  positioned={barPositioned}
                  teamLogo={SIM_MATCH.away_logo}
                  teamName="Barcelona"
                  isAway={true}
                />
                {/* Barcelona formation label — bottom-right inside pitch */}
                <div style={{
                  position: 'absolute', bottom: '6px', right: '8px',
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontFamily: "'Montserrat', sans-serif", fontWeight: 800,
                  fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase',
                }}>
                  {BAR_FORMATION}
                  <img src={SIM_MATCH.away_logo} alt="" style={{ width: 14, height: 14, objectFit: 'contain', opacity: 0.7 }} />
                </div>
              </div>
            </div>
          )}

          {/* ── SUBS ─────────────────────────────────────────── */}
          {activeTab === 'SUBS' && (
            <div style={{ padding: '0 12px' }}>
              <p style={{
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800,
                fontSize: '10px', color: '#00e5ff', textTransform: 'uppercase',
                letterSpacing: '1.5px', marginBottom: '12px',
              }}>
                Liverpool Bench
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {SIM_BENCH.map((player) => {
                  const hi = player.player_name === 'G. Wijnaldum' || player.player_name === 'D. Sturridge';
                  return (
                    <div key={player.player_id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 10px',
                      background: hi ? 'rgba(0,229,255,0.04)' : 'rgba(255,255,255,0.03)',
                      borderRadius: '10px',
                      border: hi ? '1px solid rgba(0,229,255,0.15)' : '1px solid rgba(255,255,255,0.05)',
                    }}>
                      <div>
                        <span style={{
                          fontFamily: "'Montserrat', sans-serif", fontWeight: 700,
                          fontSize: '11px', color: '#FFFFFF', display: 'block',
                        }}>{player.player_name}</span>
                        {player.context && (
                          <span style={{
                            fontFamily: "'Montserrat', sans-serif", fontWeight: 500,
                            fontSize: '9px', color: 'rgba(255,255,255,0.4)',
                          }}>{player.context}</span>
                        )}
                      </div>
                      <span style={{
                        fontFamily: "'Montserrat', sans-serif", fontWeight: 800,
                        fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase',
                        letterSpacing: '1px', background: 'rgba(255,255,255,0.06)',
                        padding: '2px 8px', borderRadius: '6px', flexShrink: 0,
                      }}>
                        {player.position}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* EVENTS / STATS — pre-match placeholder */}
          {(activeTab === 'EVENTS' || activeTab === 'STATS') && (
            <div style={{ padding: '40px 12px', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
              <p style={{
                fontFamily: "'Montserrat', sans-serif", fontWeight: 700,
                fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', margin: 0,
              }}>
                Available after kick-off
              </p>
            </div>
          )}

        </div>
      </div>

      {/* ── CARD SHELF — fixed above backdrop (z-[146] > z-[140]), hidden only during picker or settlement ── */}
      {(!openSheet || simStaged) && !settling && !settled && (
        <div data-testid="sim-card-shelf" className="fixed bottom-0 inset-x-0 z-[146] h-48 bg-zinc-950 border-t border-white/10 shadow-[0_-8px_20px_rgba(0,0,0,0.5)]">
          <div className="absolute bottom-0 w-full h-24 bg-[url('/shelf-console.webp')] bg-cover bg-bottom z-10" />
          <div className="absolute inset-0 flex justify-center items-end gap-1 pb-10 px-1 z-20">
            {CARD_TYPES.map(card => {
              const isActive = activeCard === card.id;
              const showConfirm = !!(simStaged && openSheet);
              // activeCard stays set to the card being confirmed throughout the
              // picker → confirm flow, so the same `!isActive` dim rule works
              // in both phases: only the tapped card is at full opacity.
              const shouldDim = !isActive;
              return (
                <button
                  key={card.id}
                  onClick={() => handleCardTap(card.id)}
                  className="relative flex flex-col items-center transition-opacity duration-[400ms]"
                  style={{ opacity: shouldDim ? 0.3 : 1 }}
                >
                  {isActive && !showConfirm && (
                    <div className="onboarding-arrow animate-in fade-in duration-300">
                      <ChevronDown className="w-5 h-5" strokeWidth={3} />
                    </div>
                  )}
                  <div className="w-[5rem] h-[7.5rem] relative rounded-xl">
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                      <CardBase type={card.id} status="generic" variant="transparent" />
                    </div>
                  </div>
                  <span className="mt-1 text-[8px] font-black uppercase tracking-widest text-white/50">
                    {card.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MATCH RESULT SELECTION ────────────────────────────── */}
      {openSheet === 'match_result' && !simStaged && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <button onClick={() => setOpenSheet(null)} className="absolute top-8 right-8 text-white/50 hover:text-white">
            <X className="w-8 h-8" />
          </button>
          <div className="grid grid-cols-3 gap-4 w-full max-w-lg">
            {[
              { outcome: 'HOME_WIN', label: 'Home Win', logo: SIM_MATCH.home_logo, name: 'Liverpool Win' },
              { outcome: 'DRAW', label: 'Draw', logo: null, name: 'Draw' },
              { outcome: 'AWAY_WIN', label: 'Away Win', logo: SIM_MATCH.away_logo, name: 'Barcelona Win' },
            ].map(opt => (
              <button
                key={opt.outcome}
                onClick={() => setSimStaged({ label: opt.name, reward: SIM_REWARDS[opt.outcome] })}
                className="bg-zinc-900/80 border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-4 hover:bg-zinc-800 transition-all active:scale-95"
              >
                {opt.logo
                  ? <img src={opt.logo} className="w-16 h-16 object-contain" alt={opt.name} />
                  : <Trophy className="w-16 h-16 text-zinc-600" />}
                <span className="text-yellow-400 font-black text-2xl">+{SIM_REWARDS[opt.outcome]}</span>
                <span className="text-white/40 text-[10px] uppercase font-bold tracking-widest">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── TOTAL GOALS SELECTION ─────────────────────────────── */}
      {openSheet === 'total_goals' && !simStaged && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <button onClick={() => setOpenSheet(null)} className="absolute top-8 right-8 text-white/50 hover:text-white">
            <X className="w-8 h-8" />
          </button>
          <div className="flex gap-6 w-full max-w-lg">
            <button
              onClick={() => setSimStaged({ label: 'Over 2.5 Goals', reward: SIM_REWARDS.OVER_2_5 })}
              className="flex-1 bg-zinc-900/80 border border-white/10 rounded-2xl p-10 flex flex-col items-center gap-4 hover:bg-zinc-800 transition-all active:scale-95"
            >
              <div className="text-center">
                <p className="text-white font-black text-2xl">OVER 2.5</p>
                <p className="text-yellow-400 font-bold mt-2">+{SIM_REWARDS.OVER_2_5} PTS</p>
              </div>
            </button>
            <button
              onClick={() => setSimStaged({ label: 'Under 2.5 Goals', reward: SIM_REWARDS.UNDER_2_5 })}
              className="flex-1 bg-zinc-900/80 border border-white/10 rounded-2xl p-10 flex flex-col items-center gap-4 hover:bg-zinc-800 transition-all active:scale-95"
            >
              <div className="text-center">
                <p className="text-white font-black text-2xl">UNDER 2.5</p>
                <p className="text-yellow-400 font-bold mt-2">+{SIM_REWARDS.UNDER_2_5} PTS</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ── PLAYER SCORE SELECTION ────────────────────────────── */}
      {openSheet === 'player_score' && !simStaged && (
        <div className="fixed inset-0 z-[100] flex items-end">
          <div className="absolute inset-0 bg-black/80" onClick={() => setOpenSheet(null)} />
          <div className="relative w-full bg-zinc-900 border-t border-white/10 rounded-t-3xl max-h-[75vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* Drag handle */}
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mt-3 flex-shrink-0" />

            {/* Close button */}
            <button
              onClick={() => setOpenSheet(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center z-10"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {/* Title */}
            <div className="px-5 pt-4 pb-3 flex-shrink-0">
              <h3 className="text-white font-black text-lg uppercase tracking-wide">Pick a Player to Score</h3>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-2 scrollbar-hide">
              {SCORERS.map((player) => (
                <button
                  key={player.player_id}
                  onClick={() => setSimStaged({ label: player.player_name, reward: SIM_REWARDS[player.player_name] || SIM_REWARDS.DEFAULT_SCORER })}
                  className="w-full flex justify-between items-center p-3 bg-white/5 rounded-xl hover:bg-emerald-500/20 border border-transparent hover:border-emerald-500/50 transition-all active:scale-95"
                >
                  <span className="text-white font-bold text-sm truncate">{player.player_name}</span>
                  <span className="text-yellow-400 font-black text-sm whitespace-nowrap ml-3">
                    +{SIM_REWARDS[player.player_name] || SIM_REWARDS.DEFAULT_SCORER} pts
                  </span>
                </button>
              ))}
              {INJURED.map((player, i) => (
                <div key={i} className="w-full flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-xl px-3 py-3 opacity-40 cursor-not-allowed">
                  <span className="text-zinc-400 font-bold text-sm">{player.player_name}</span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-red-400 bg-red-900/30 border border-red-500/20 px-2 py-0.5 rounded ml-3 flex-shrink-0">INJURED</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SUPERSUB SELECTION ────────────────────────────────── */}
      {openSheet === 'supersub' && !simStaged && (
        <div className="fixed inset-0 z-[100] flex items-end">
          <div className="absolute inset-0 bg-black/80" onClick={() => setOpenSheet(null)} />
          <div className="relative w-full bg-zinc-900 border-t border-white/10 rounded-t-3xl max-h-[75vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* Drag handle */}
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mt-3 flex-shrink-0" />

            {/* Close button */}
            <button
              onClick={() => setOpenSheet(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center z-10"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {/* Title */}
            <div className="px-5 pt-4 pb-3 flex-shrink-0">
              <h3 className="text-white font-black text-lg uppercase tracking-wide">Pick your Supersub</h3>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-2 scrollbar-hide">
              {/* "Any Sub" — visually distinct highlighted option */}
              <button
                onClick={() => setSimStaged({ label: 'Any Sub to Score', reward: SIM_REWARDS.BENCH })}
                className="w-full flex justify-between items-center p-3 rounded-xl border border-cyan-500/50 bg-cyan-500/10 hover:bg-cyan-500/20 transition-all active:scale-95"
              >
                <span className="text-cyan-400 font-black text-sm">⚡ Any Sub to Score</span>
                <span className="text-yellow-400 font-black text-sm ml-3">+{SIM_REWARDS.BENCH} pts</span>
              </button>

              {/* Individual bench players */}
              {SIM_BENCH.map(player => {
                const hi = player.player_name === 'G. Wijnaldum' || player.player_name === 'D. Sturridge';
                return (
                  <button
                    key={player.player_id}
                    onClick={() => setSimStaged({ label: player.player_name, reward: SIM_REWARDS.SUPERSUB_SPECIFIC })}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all active:scale-95 ${hi ? 'bg-cyan-500/5 border-cyan-500/20 hover:bg-cyan-500/15' : 'bg-white/5 border-transparent hover:bg-emerald-500/20 hover:border-emerald-500/50'}`}
                  >
                    <div className="text-left">
                      <span className="text-white font-bold text-sm block">{player.player_name}</span>
                      {player.context && (
                        <span className="text-zinc-500 text-[9px]">{player.context}</span>
                      )}
                    </div>
                    <span className="text-yellow-400 font-black text-sm whitespace-nowrap ml-3">+{SIM_REWARDS.SUPERSUB_SPECIFIC} pts</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRM SHEET — docked above card strip ───────────── */}
      {simStaged && openSheet && (
        <>
          {/* Partial backdrop — covers only above the card strip */}
          <div
            className="fixed inset-x-0 top-0 bottom-48 z-[140] bg-black/55 backdrop-blur-[2px]"
            onClick={() => setSimStaged(null)}
          />
          {/* Confirm sheet — docked above card strip */}
          <div className="fixed inset-x-0 bottom-48 z-[145] bg-zinc-900 border-t border-white/15 rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="px-5 py-4 max-w-md mx-auto">
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Outcome</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Reward</span>
              </div>
              <div className="flex justify-between items-baseline mb-4">
                <span className="text-white font-black text-xl italic uppercase tracking-tight">{simStaged.label}</span>
                <span className="text-yellow-400 font-black text-xl">{simStaged.reward} <span className="text-xs font-bold">pts</span></span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSimStaged(null)}
                  className="flex-1 py-3 bg-white/[0.08] text-white/70 font-bold uppercase tracking-widest text-xs rounded-xl active:scale-95 transition-transform"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSimConfirm}
                  className="flex-[2] py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-widest text-xs rounded-xl active:scale-95 transition-transform"
                >
                  Confirm Play
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── PREDICTION TOAST — floats at top, tap to dismiss ── */}
      {showLockedIn && (
        <div className="fixed top-4 inset-x-4 z-[150] flex justify-center pointer-events-none">
          <div
            onClick={dismissBanner}
            className="pointer-events-auto bg-emerald-500/95 backdrop-blur-md border border-emerald-400/60 shadow-[0_8px_32px_rgba(16,185,129,0.4)] rounded-2xl animate-in slide-in-from-top duration-300 cursor-pointer max-w-sm w-full"
          >
            <div className="px-4 py-3 flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Check className="w-4 h-4 text-white" strokeWidth={3} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-[11px] font-black uppercase tracking-widest">Prediction Made</p>
                <p className="text-white/90 text-xs">Stamped on your tactical board</p>
              </div>
              {/* No View CTA during simulation — tap advances the narrative */}
            </div>
          </div>
        </div>
      )}

      {/* ── SETTLEMENT ANIMATION — PayoffView style ───────────── */}
      {(settling || settled) && (
        <>
          <style>{SETTLEMENT_KEYFRAMES}</style>
          <div
            className="fixed inset-0 z-[150] flex flex-col"
            style={{ background: 'linear-gradient(180deg, #080808 0%, #0a160a 100%)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-12 pb-2">
              <div className="w-9 h-9" />
              <span className="text-[10px] font-bold uppercase tracking-[2px] text-white/45">
                {SIM_MATCH.league_name}
              </span>
              <div className="w-9" />
            </div>

            {/* Scoreboard */}
            <div
              className="mx-4 mt-3 mb-4 rounded-2xl p-5"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-col items-center flex-1 gap-2">
                  <img src={SIM_MATCH.home_logo} className="w-10 h-10 object-contain" alt="Liverpool" />
                  <span className="text-white font-black text-xs uppercase tracking-wide">Liverpool</span>
                </div>
                <div className="flex flex-col items-center px-4">
                  <span
                    className="font-black text-5xl tracking-tighter transition-all duration-500"
                    style={{
                      color: settlementScore.home === 4 ? '#00e5ff' : 'white',
                      textShadow: settlementScore.home === 4 ? '0 0 24px rgba(0,229,255,0.8)' : 'none',
                    }}
                  >
                    {settlementScore.home} — {settlementScore.away}
                  </span>
                  <span
                    className="text-sm font-black mt-2"
                    style={{ color: '#00e5ff', animation: 'clockTick 0.5s ease-in-out infinite' }}
                  >
                    {settlementMinute}
                  </span>
                </div>
                <div className="flex flex-col items-center flex-1 gap-2">
                  <img src={SIM_MATCH.away_logo} className="w-10 h-10 object-contain" alt="Barcelona" />
                  <span className="text-white font-black text-xs uppercase tracking-wide">Barcelona</span>
                </div>
              </div>
            </div>


            {/* WINNER popup */}
            {showWinnerPopup && (
              <div className="absolute inset-0 z-40 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-500">
                <div
                  className="w-full max-w-sm rounded-3xl p-8 text-center relative overflow-hidden shadow-[0_0_60px_rgba(234,179,8,0.3)]"
                  style={{ background: 'linear-gradient(160deg, #ca8a04 0%, #ea580c 50%, #b91c1c 100%)' }}
                >
                  <div
                    className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl"
                    style={{ animation: 'winner-bounce 1s ease-in-out infinite' }}
                  >
                    <span className="text-4xl">🏆</span>
                  </div>
                  <div className="mb-1">
                    <p className="text-white/80 font-bold text-xs uppercase tracking-widest">Liverpool</p>
                    <p className="text-white font-black text-5xl tracking-tighter leading-none my-1">4 – 0</p>
                    <p className="text-white/80 font-bold text-xs uppercase tracking-widest">Barcelona</p>
                  </div>
                  <p className="text-white/80 font-bold text-xs uppercase tracking-widest mb-4">One of the greatest European nights</p>
                  <div className="bg-white/15 rounded-2xl p-4 mb-5 border border-white/20 text-left">
                    <p className="text-white/90 text-xs leading-relaxed">{JOSEBA_MESSAGES[9]}</p>
                  </div>
                  <button
                    onClick={onComplete}
                    className="w-full py-4 rounded-2xl font-black uppercase text-black text-base tracking-widest shadow-2xl hover:scale-[1.02] transition-all active:scale-95"
                    style={{ background: 'white' }}
                  >
                    Get Your Real Cards →
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── GOAL CELEBRATION ── viewport-centred, above all UI layers ── */}
      {goalPopup && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 pointer-events-none">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 pointer-events-auto" />

          {/* Popup content */}
          <div className="relative z-10 bg-zinc-900 border border-emerald-500/40 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
              <span className="text-4xl">⚽</span>
            </div>
            <h2 className="text-white text-3xl font-black uppercase tracking-tight mb-2">
              Goal!
            </h2>
            <p className="text-emerald-400 text-lg font-bold uppercase tracking-widest mb-2">
              Liverpool
            </p>
            <p className="text-zinc-400 text-sm">
              Scored by <span className="text-white font-bold">{goalPopup.scorer}</span> · {goalPopup.minute}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimulationMatchDetail;
