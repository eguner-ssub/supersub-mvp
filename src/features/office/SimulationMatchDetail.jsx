import React, { useState, useEffect } from 'react';
import { ArrowLeft, X, Trophy } from 'lucide-react';
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
  { player: { id: 1,  name: 'Alisson',    number: '1',  grid: '1:1' } },
  { player: { id: 2,  name: 'Trent',      number: '66', grid: '2:4' } },
  { player: { id: 3,  name: 'Matip',      number: '32', grid: '2:2' } },
  { player: { id: 4,  name: 'Van Dijk',   number: '4',  grid: '2:3' } },
  { player: { id: 5,  name: 'Robertson',  number: '26', grid: '2:1' } },
  { player: { id: 6,  name: 'Henderson',  number: '14', grid: '3:3' } },
  { player: { id: 7,  name: 'Fabinho',    number: '3',  grid: '3:2' } },
  { player: { id: 8,  name: 'Milner',     number: '7',  grid: '3:1' } },
  { player: { id: 9,  name: 'Shaqiri',    number: '23', grid: '4:3' } },
  { player: { id: 10, name: 'Origi',      number: '27', grid: '4:2' } },
  { player: { id: 11, name: 'Mané',       number: '10', grid: '4:1' } },
];

const BAR_FORMATION = '4-3-3';
const BAR_XI = [
  { player: { id: 20, name: 'Ter Stegen',    number: '1',  grid: '1:1' } },
  { player: { id: 21, name: 'Sergi Roberto', number: '20', grid: '2:4' } },
  { player: { id: 22, name: 'Piqué',         number: '3',  grid: '2:3' } },
  { player: { id: 23, name: 'Lenglet',       number: '15', grid: '2:2' } },
  { player: { id: 24, name: 'Jordi Alba',    number: '18', grid: '2:1' } },
  { player: { id: 25, name: 'Vidal',         number: '22', grid: '3:3' } },
  { player: { id: 26, name: 'Busquets',      number: '5',  grid: '3:2' } },
  { player: { id: 27, name: 'Rakitić',       number: '4',  grid: '3:1' } },
  { player: { id: 28, name: 'Messi',         number: '10', grid: '4:3' } },
  { player: { id: 29, name: 'Suárez',        number: '9',  grid: '4:2' } },
  { player: { id: 30, name: 'Coutinho',      number: '7',  grid: '4:1' } },
];

/* ─── Bench data ──────────────────────────────────────────────── */

const SIM_BENCH = [
  { player_id: 1001, player_name: 'S. Mignolet',  position: 'GK',    context: null },
  { player_id: 1002, player_name: 'D. Lovren',    position: 'CB',    context: null },
  { player_id: 1003, player_name: 'J. Gomez',     position: 'CB/RB', context: null },
  { player_id: 1004, player_name: 'G. Wijnaldum', position: 'MF',    context: '32 starts in last 35 league games' },
  { player_id: 1005, player_name: 'B. Woodburn',  position: 'MF',    context: null },
  { player_id: 1006, player_name: 'R. Brewster',  position: 'FW',    context: null },
  { player_id: 1007, player_name: 'D. Sturridge', position: 'FW',    context: '20 of 27 appearances from bench this season' },
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
  { id: 'c_total_goals',  label: 'Total Goals' },
  { id: 'c_player_score', label: 'Player Score' },
  { id: 'c_supersub',     label: 'Supersub' },
];

const TABS = ['LINEUP', 'SUBS', 'EVENTS', 'STATS'];

/* ─── Sim rewards ─────────────────────────────────────────────── */

const SIM_REWARDS = {
  HOME_WIN: 200, DRAW: 400, AWAY_WIN: 1000,
  OVER_2_5: 200, UNDER_2_5: 350,
  'D. Origi': 600, 'S. Mané': 450, 'X. Shaqiri': 800,
  BENCH: 500, 'G. Wijnaldum': 2500, 'D. Sturridge': 1500,
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
  minHeight: '100%',
};

/* ─── Inline Joseba intel box — matches MatchDetail AssistantDialogue ── */
const JosebaIntelBox = ({ message, isTappable, onTap }) => (
  <div
    onClick={isTappable ? onTap : undefined}
    style={{
      display: 'flex', alignItems: 'flex-start', gap: '10px',
      margin: '0 12px 12px', padding: '10px 14px',
      background: '#f5f0e8', borderRadius: '14px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2)',
      cursor: isTappable ? 'pointer' : 'default',
    }}
  >
    <img
      src="/assets/assistant-head.png"
      alt="Joseba"
      style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid rgba(0,0,0,0.08)' }}
    />
    <div style={{ flex: 1, minWidth: 0 }}>
      <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '9px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
        Joseba · Analyst
      </span>
      <p style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '12px', color: '#121212', margin: '3px 0 0', lineHeight: 1.35 }}>
        {message}
      </p>
      {isTappable && (
        <p style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '9px', color: '#888', marginTop: 6, textTransform: 'uppercase', letterSpacing: '1px' }}>
          Tap to continue ›
        </p>
      )}
    </div>
  </div>
);

/* ─── Component ───────────────────────────────────────────────── */

const SimulationMatchDetail = ({ onComplete, onBack }) => {
  const [step, setStep]             = useState(0);
  const [activeCard, setActiveCard] = useState('c_match_result');
  const [openSheet, setOpenSheet]   = useState(null);
  const [activeTab, setActiveTab]   = useState('LINEUP');

  // Staging + locked-in state (replaces pendingX vars)
  const [simStaged, setSimStaged]     = useState(null); // { label, reward }
  const [showLockedIn, setShowLockedIn] = useState(false);

  // Settlement state
  const [settling, setSettling]                 = useState(false);
  const [settled, setSettled]                   = useState(false);
  const [settlementMinute, setSettlementMinute] = useState("0'");
  const [settlementScore, setSettlementScore]   = useState({ home: 0, away: 0 });
  const [goalPopup, setGoalPopup]               = useState(null);
  const [showWinnerPopup, setShowWinnerPopup]   = useState(false);

  /* Settlement animation — PayoffView style */
  useEffect(() => {
    if (!settling) return;
    const GOALS_TIMELINE = [
      { delay: 600,  minute: "7'",  scorer: 'Origi',     score: { home: 1, away: 0 } },
      { delay: 2800, minute: "54'", scorer: 'Wijnaldum', score: { home: 2, away: 0 } },
      { delay: 5000, minute: "56'", scorer: 'Wijnaldum', score: { home: 3, away: 0 } },
      { delay: 7200, minute: "79'", scorer: 'Origi',     score: { home: 4, away: 0 } },
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

  /* Card tile tap — opens sheet directly */
  const handleCardTap = (cardId) => {
    if (cardId !== activeCard) return;
    switch (cardId) {
      case 'c_match_result': setOpenSheet('match_result'); break;
      case 'c_total_goals':  setOpenSheet('total_goals');  break;
      case 'c_player_score': setOpenSheet('player_score'); break;
      case 'c_supersub':     setOpenSheet('supersub');     break;
      default: break;
    }
  };

  /* Confirm Play — shared handler reads openSheet to know which card */
  const handleSimConfirm = () => {
    const sheet = openSheet;
    setSimStaged(null);
    setOpenSheet(null);
    setShowLockedIn(true);
    if (sheet === 'match_result') { setStep(1); setActiveCard(null); }
    else if (sheet === 'total_goals')  { setStep(3); setActiveCard(null); }
    else if (sheet === 'player_score') { setStep(5); setActiveCard(null); }
    else if (sheet === 'supersub')     { setStep(7); setActiveCard(null); }
  };

  /* Pre-compute formation positions */
  const lfcPositioned = mapFormation(LFC_XI, LFC_FORMATION, false);
  const barPositioned = mapFormation(BAR_XI, BAR_FORMATION, true);

  const isTappable = [1, 3, 5, 7, 8].includes(step);

  return (
    <div className="h-[100dvh] w-full relative overflow-hidden flex flex-col justify-between font-sans select-none">

      {/* ── BACKGROUND — tunnel pre/post ──────────────────────── */}
      <div className="absolute inset-0 z-0">
        <img
          src="/assets/bg-tunnel-prepost.webp"
          className="absolute inset-0 w-full h-full object-cover"
          alt=""
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
      </div>

      {/* ── HEADER ────────────────────────────────────────────── */}
      <div className="absolute top-0 w-full z-40 bg-black/80 backdrop-blur-md border-b border-white/10">
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
      <div className="absolute w-full z-[35]" style={{ top: '156px' }}>
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
        className="absolute w-full z-30 overflow-y-auto scrollbar-hide"
        style={{ top: '196px', bottom: '256px', WebkitOverflowScrolling: 'touch' }}
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
                  fontFamily: "'Montserrat', sans-serif", fontWeight: 800,
                  fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase',
                }}>
                  {BAR_FORMATION}
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

      {/* ── CARD SHELF ────────────────────────────────────────── */}
      <div data-testid="sim-card-shelf" className="fixed bottom-0 w-full z-[300] h-64">
        <div className="absolute bottom-0 w-full h-32 bg-[url('/shelf-console.webp')] bg-cover bg-bottom z-10" />
        <div className="absolute inset-0 flex justify-center items-end gap-3 pb-14 px-4">
          {CARD_TYPES.map(card => {
            const isActive = activeCard === card.id;
            return (
              <button
                key={card.id}
                onClick={() => handleCardTap(card.id)}
                className={`relative transition-all duration-300 ${
                  isActive ? 'translate-y-[-24px] ring-2 ring-yellow-400 shadow-xl' : 'opacity-40'
                }`}
              >
                <div className={`w-[5.5rem] h-[8.25rem] relative ${isActive ? 'animate-pulse' : ''}`}>
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <CardBase type={card.id} label={card.label} status="generic" variant="transparent" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── MATCH RESULT SELECTION ────────────────────────────── */}
      {openSheet === 'match_result' && !simStaged && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <button onClick={() => setOpenSheet(null)} className="absolute top-8 right-8 text-white/50 hover:text-white">
            <X className="w-8 h-8" />
          </button>
          <div className="grid grid-cols-3 gap-4 w-full max-w-lg">
            {[
              { outcome: 'HOME_WIN', label: 'Home Win', logo: SIM_MATCH.home_logo, name: 'Liverpool Win' },
              { outcome: 'DRAW',     label: 'Draw',     logo: null,                name: 'Draw' },
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
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <button onClick={() => setOpenSheet(null)} className="absolute top-8 right-8 text-white/50 hover:text-white">
            <X className="w-8 h-8" />
          </button>
          <div className="w-full max-w-lg mx-auto bg-zinc-900 border border-white/10 rounded-t-3xl mt-auto overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8">
            <div className="bg-zinc-800/50 px-6 py-5 border-b border-white/5">
              <h3 className="text-white font-black uppercase tracking-tighter text-xl">Pick a Player to Score</h3>
            </div>
            <div className="h-[55vh] overflow-y-auto p-4 space-y-2 scrollbar-hide">
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
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <button onClick={() => setOpenSheet(null)} className="absolute top-8 right-8 text-white/50 hover:text-white">
            <X className="w-8 h-8" />
          </button>
          <div className="w-full max-w-lg mx-auto bg-zinc-900 border border-white/10 rounded-t-3xl mt-auto overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8">
            <div className="bg-zinc-800/50 px-6 py-5 border-b border-white/5">
              <h3 className="text-white font-black uppercase tracking-tighter text-xl">Pick your Supersub</h3>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto max-h-[55vh] scrollbar-hide">
              <button
                onClick={() => setSimStaged({ label: 'Any Sub to Score', reward: SIM_REWARDS.BENCH })}
                className="w-full flex justify-between items-center p-3 rounded-xl border border-cyan-500/50 bg-cyan-500/10 hover:bg-cyan-500/20 transition-all active:scale-95"
              >
                <span className="text-cyan-400 font-black text-sm">⚡ Any Sub to Score</span>
                <span className="text-yellow-400 font-black text-sm ml-3">+{SIM_REWARDS.BENCH} pts</span>
              </button>
              {SIM_BENCH.map(player => {
                const hi  = player.player_name === 'G. Wijnaldum' || player.player_name === 'D. Sturridge';
                const pts = SIM_REWARDS[player.player_name] || SIM_REWARDS.DEFAULT_SCORER;
                return (
                  <button
                    key={player.player_id}
                    onClick={() => setSimStaged({ label: player.player_name, reward: pts })}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all active:scale-95 ${
                      hi ? 'bg-cyan-500/5 border-cyan-500/20 hover:bg-cyan-500/15' : 'bg-white/5 border-transparent hover:bg-emerald-500/20 hover:border-emerald-500/50'
                    }`}
                  >
                    <div className="text-left">
                      <span className="text-white font-bold text-sm block">{player.player_name}</span>
                      {player.context && (
                        <span className="text-zinc-500 text-[9px]">{player.context}</span>
                      )}
                    </div>
                    <span className="text-yellow-400 font-black text-sm whitespace-nowrap ml-3">+{pts} pts</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── STAGING MODAL — shared for all card types ─────────── */}
      {simStaged && openSheet && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl">
            <div className="flex justify-between items-start mb-8">
              <div className="space-y-1">
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Outcome Selection</p>
                <h3 className="text-white font-black text-3xl uppercase italic tracking-tighter leading-tight">{simStaged.label}</h3>
              </div>
              <div className="text-right space-y-1">
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Reward</p>
                <p className="text-yellow-400 font-black text-4xl tracking-tighter">
                  {simStaged.reward} <span className="text-xs uppercase">pts</span>
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setSimStaged(null)}
                className="flex-1 py-4 bg-zinc-800 rounded-2xl font-bold uppercase text-zinc-400 text-xs tracking-widest hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSimConfirm}
                className="flex-[2] py-4 bg-emerald-500 rounded-2xl font-black uppercase text-black text-xl shadow-[0_10px_30px_rgba(16,185,129,0.3)] hover:scale-105 transition-all"
              >
                Confirm Play
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LOCKED IN! CONFIRMATION — matches real MatchDetail ── */}
      {showLockedIn && (
        <div className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="text-center w-full max-w-sm border border-white/10 bg-zinc-900/50 p-10 rounded-[3rem] relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/30">
              <Trophy className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-white font-black uppercase text-4xl tracking-tighter mb-4">Locked In!</h2>
            <p className="text-zinc-500 text-sm mb-8 uppercase tracking-widest font-bold">Your prediction has been logged in the Locker Room</p>
            <button
              onClick={() => setShowLockedIn(false)}
              className="w-full py-5 bg-white text-black font-black uppercase rounded-2xl shadow-2xl hover:bg-zinc-200 transition-colors tracking-tighter text-lg"
            >
              Continue Scouting
            </button>
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

            {/* Goal popup */}
            {goalPopup && (
              <div className="absolute inset-x-4 top-[28%] z-30 animate-in zoom-in duration-300">
                <div className="w-full max-w-md mx-auto bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
                    <span className="text-3xl">⚽</span>
                  </div>
                  <h2 className="text-white font-black uppercase text-3xl tracking-tighter mb-2">Goal!</h2>
                  <p className="text-zinc-400 text-sm font-bold uppercase tracking-widest">Liverpool</p>
                  <p className="text-zinc-500 text-xs mt-1">Scored by {goalPopup.scorer} · {goalPopup.minute}</p>
                </div>
              </div>
            )}

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
                  <p className="text-white font-black text-2xl tracking-widest mb-1">Liverpool 4–0 Barcelona</p>
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
    </div>
  );
};

export default SimulationMatchDetail;
