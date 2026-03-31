import React, { useState, useEffect } from 'react';
import { ArrowLeft, X, Trophy } from 'lucide-react';
import CardBase from '../../shared/ui/CardBase';
import JosebaBubble from '../../shared/ui/JosebaBubble';
import {
  PlayerNode,
  PitchMarkings,
  TeamHalf,
  pitchContainerStyle,
  grainOverlayStyle,
  mapFormation,
} from '../match-day/MatchLineup';

/* ─── Static match data ───────────────────────────────────────── */

const SIM_MATCH = {
  id: 'sim_lfc_barca_2019',
  home_team: 'Liverpool',
  away_team: 'Barcelona',
  home_logo: '/assets/sim/lfc-crest.webp',
  away_logo: '/assets/sim/barca-crest.webp',
  date_display: '7 May 2019',
  league_name: 'UEFA Champions League — Semi-Final 2nd Leg',
};

/* ─── Hardcoded formations — Liverpool 4-3-3 vs Barcelona 4-3-3 ─ */

const LFC_FORMATION = '4-3-3';
const LFC_XI = [
  { player: { id: 1,  name: 'Alisson',          number: '1',  grid: '1:1' } },
  { player: { id: 2,  name: 'Alexander-Arnold', number: '66', grid: '2:4' } },
  { player: { id: 3,  name: 'Matip',            number: '32', grid: '2:3' } },
  { player: { id: 4,  name: 'Van Dijk',         number: '4',  grid: '2:2' } },
  { player: { id: 5,  name: 'Robertson',        number: '26', grid: '2:1' } },
  { player: { id: 6,  name: 'Henderson',        number: '14', grid: '3:3' } },
  { player: { id: 7,  name: 'Fabinho',          number: '3',  grid: '3:2' } },
  { player: { id: 8,  name: 'Milner',           number: '7',  grid: '3:1' } },
  { player: { id: 9,  name: 'Shaqiri',          number: '23', grid: '4:3' } },
  { player: { id: 10, name: 'Mané',             number: '10', grid: '4:2' } },
  { player: { id: 11, name: 'Origi',            number: '27', grid: '4:1' } },
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

/* ─── Joseba messages ─────────────────────────────────────────── */

const JOSEBA_MESSAGES = [
  "7th of May, 2019. Anfield. Liverpool are 3-0 down from the first leg. Salah and Firmino are both injured. The whole world has written them off. This is exactly when the bench matters most. Let's make some calls. Tap Match Result first.",
  "Liverpool haven't lost a home European match in over five years. 22 unbeaten at Anfield in Europe. Barcelona are 3-0 up on aggregate. But this ground has a history of the impossible. Pick your result.",
  "Now the goals. Tap Total Goals.",
  "No Salah. No Firmino. The obvious read is fewer goals. But Liverpool's home European games this season averaged more than 3 goals in total. A team chasing four goals has no reason to sit back. Trust the pattern, not the headline.",
  "Now pick a scorer. Tap Player Score.",
  "With Salah and Firmino out, Klopp needs someone else up front. Divock Origi starts tonight. He scored against Everton in the 96th minute in December. He hit the winner at Newcastle three days ago. He saves his best for when it matters. Pick your goalscorer.",
  "Last one — and the most important one. Tap Supersub.",
  "Two ways to play this. Back the bench as a whole — any substitute who scores wins you 500 points. Or go specific — pick one player, and if they come on and score, you win 2,500. Seven players on this bench. Two worth watching: Wijnaldum and Sturridge. Sturridge has made 20 of his 27 appearances from the bench this season. He knows how to change a game late. But look at Wijnaldum. He's started 32 of Liverpool's last 35 league games. Their most-used midfielder. Klopp almost never drops him. So why is he sitting here tonight? When a manager saves his best midfielder for a 3-0 deficit, he's not leaving him out. He's loading a weapon. Make your call.",
  "Calls made. Let's see if the match agrees with you.",
  "Liverpool 4-0 Barcelona. One of the greatest nights in European football — and you read it. Wijnaldum came on at half-time. Two goals in two minutes. Origi opened and closed the scoring. The bench won this match. These were simulation cards. Your real cards are waiting.",
];

/* ─── Settlement goals ────────────────────────────────────────── */

const GOALS = [
  { minute: "7'",  scorer: 'Origi',     score: '1 — 0' },
  { minute: "54'", scorer: 'Wijnaldum', score: '2 — 0' },
  { minute: "56'", scorer: 'Wijnaldum', score: '3 — 0' },
  { minute: "79'", scorer: 'Origi',     score: '4 — 0' },
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

/* ─── Component ───────────────────────────────────────────────── */

const SimulationMatchDetail = ({ onComplete, onBack }) => {
  const [step, setStep]             = useState(0);
  const [activeCard, setActiveCard] = useState(null);
  const [openSheet, setOpenSheet]   = useState(null);
  const [activeTab, setActiveTab]   = useState('LINEUP');
  const [simSelections, setSimSelections] = useState({
    matchResult: null, totalGoals: null, playerScore: null, supersub: null,
  });

  const [settling, setSettling]           = useState(false);
  const [revealedGoals, setRevealedGoals] = useState([]);
  const [settled, setSettled]             = useState(false);

  const [pendingMatchResult, setPendingMatchResult] = useState(null);
  const [pendingTotalGoals, setPendingTotalGoals]   = useState(null);
  const [pendingPlayerScore, setPendingPlayerScore] = useState(null);
  const [pendingSupersub, setPendingSupersub]       = useState(null);

  /* Settlement animation */
  useEffect(() => {
    if (!settling) return;
    const timeouts = [];
    GOALS.forEach((goal, i) => {
      timeouts.push(setTimeout(() => {
        setRevealedGoals(prev => [...prev, goal]);
      }, 700 + i * 800));
    });
    timeouts.push(setTimeout(() => {
      setSettled(true);
      setSettling(false);
      setStep(9);
    }, 700 + GOALS.length * 800 + 600));
    return () => timeouts.forEach(clearTimeout);
  }, [settling]);

  /* Bubble advance */
  const handleBubbleAdvance = () => {
    switch (step) {
      case 0: setStep(1); setActiveCard('c_match_result'); break;
      case 1: setOpenSheet('match_result'); break;
      case 2: setStep(3); setActiveCard('c_total_goals'); break;
      case 3: setOpenSheet('total_goals'); break;
      case 4: setStep(5); setActiveCard('c_player_score'); break;
      case 5: setOpenSheet('player_score'); break;
      case 6: setStep(7); setActiveCard('c_supersub'); break;
      case 7: setOpenSheet('supersub'); break;
      case 8: setSettling(true); setRevealedGoals([]); break;
      case 9: onComplete(); break;
      default: break;
    }
  };

  /* Card tile tap — only the active card responds */
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

  /* Sheet confirm handlers */
  const confirmMatchResult = () => {
    if (!pendingMatchResult) return;
    setSimSelections(prev => ({ ...prev, matchResult: pendingMatchResult }));
    setOpenSheet(null); setActiveCard(null); setStep(2);
  };
  const confirmTotalGoals = () => {
    if (!pendingTotalGoals) return;
    setSimSelections(prev => ({ ...prev, totalGoals: pendingTotalGoals }));
    setOpenSheet(null); setActiveCard(null); setStep(4);
  };
  const confirmPlayerScore = () => {
    if (!pendingPlayerScore) return;
    setSimSelections(prev => ({ ...prev, playerScore: pendingPlayerScore }));
    setOpenSheet(null); setActiveCard(null); setStep(6);
  };
  const confirmSupersub = () => {
    if (!pendingSupersub) return;
    setSimSelections(prev => ({ ...prev, supersub: pendingSupersub }));
    setOpenSheet(null); setActiveCard(null); setStep(8);
  };

  const showBubble = openSheet === null && !settling;

  /* Pre-compute formation positions */
  const lfcPositioned = mapFormation(LFC_XI, LFC_FORMATION, false);
  const barPositioned = mapFormation(BAR_XI, BAR_FORMATION, true);

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
            <div className="w-9 h-9 rounded-full bg-red-700 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-black text-[9px] tracking-wide">LFC</span>
            </div>
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
            <div className="w-9 h-9 rounded-full bg-blue-900 flex items-center justify-center flex-shrink-0">
              <span className="text-yellow-400 font-black text-[9px] tracking-wide">FCB</span>
            </div>
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
      {/* bottom: 340px = 84px Joseba + 256px card shelf — nothing hidden */}
      <div
        className="absolute w-full z-30 overflow-y-auto scrollbar-hide"
        style={{ top: '196px', bottom: '256px', WebkitOverflowScrolling: 'touch' }}
      >
        <div style={CONTENT_PANEL}>

          {/* ── LINEUP — pitch formation diagram ─────────────── */}
          {activeTab === 'LINEUP' && (
            <div style={{ padding: '0 12px' }}>
              {/* Formation labels */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <img
                    src={SIM_MATCH.home_logo}
                    style={{ width: 16, height: 16, objectFit: 'contain' }}
                    alt=""
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                  <span style={{
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 800,
                    fontSize: '10px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase',
                  }}>
                    {LFC_FORMATION}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 800,
                    fontSize: '10px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase',
                  }}>
                    {BAR_FORMATION}
                  </span>
                  <img
                    src={SIM_MATCH.away_logo}
                    style={{ width: 16, height: 16, objectFit: 'contain' }}
                    alt=""
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                </div>
              </div>

              {/* Pitch */}
              <div style={pitchContainerStyle}>
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
      {/* bottom-[84px]: sits directly above the Joseba panel.
          z-[500]: always renders above Joseba (z-[400]) — cards always visible. */}
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

      {/* ── JOSEBA BUBBLE ─────────────────────────────────────── */}
      {/* fixed bottom-0 z-[400] — card shelf sits above at z-[500].
          Cards always visible above Joseba; Joseba narrates from below. */}
      {showBubble && (
        <JosebaBubble
          message={JOSEBA_MESSAGES[step]}
          onAdvance={handleBubbleAdvance}
          variant="compact"
        />
      )}

      {/* ── MATCH RESULT SHEET ────────────────────────────────── */}
      {openSheet === 'match_result' && (
        <div className="fixed inset-0 z-[600] flex flex-col items-center justify-center px-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <button onClick={() => setOpenSheet(null)} className="absolute top-8 right-8 text-white/50 hover:text-white">
            <X className="w-8 h-8" />
          </button>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-6">Pick the Result</p>
          <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
            {[
              { value: 'HOME_WIN', label: 'Home Win', logo: SIM_MATCH.home_logo, name: 'Liverpool' },
              { value: 'DRAW',     label: 'Draw',     logo: null,                name: 'Draw' },
              { value: 'AWAY_WIN', label: 'Away Win', logo: SIM_MATCH.away_logo, name: 'Barcelona' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setPendingMatchResult(opt.value)}
                className={`bg-zinc-900/80 border rounded-2xl p-5 flex flex-col items-center gap-3 transition-all active:scale-95 ${
                  pendingMatchResult === opt.value ? 'border-yellow-400 bg-yellow-400/10' : 'border-white/10 hover:bg-zinc-800'
                }`}
              >
                {opt.value === 'HOME_WIN' ? (
                  <div className="w-12 h-12 rounded-full bg-red-700 flex items-center justify-center">
                    <span className="text-white font-black text-[11px] tracking-wide">LFC</span>
                  </div>
                ) : opt.value === 'AWAY_WIN' ? (
                  <div className="w-12 h-12 rounded-full bg-blue-900 flex items-center justify-center">
                    <span className="text-yellow-400 font-black text-[11px] tracking-wide">FCB</span>
                  </div>
                ) : (
                  <Trophy className="w-12 h-12 text-zinc-600" />
                )}
                <span className="text-white/40 text-[10px] uppercase font-bold tracking-widest">{opt.label}</span>
              </button>
            ))}
          </div>
          <button onClick={confirmMatchResult} disabled={!pendingMatchResult} className="mt-8 w-full max-w-sm py-4 bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-black text-sm uppercase tracking-widest rounded-xl active:scale-95 transition-all">
            Confirm
          </button>
        </div>
      )}

      {/* ── TOTAL GOALS SHEET ─────────────────────────────────── */}
      {openSheet === 'total_goals' && (
        <div className="fixed inset-0 z-[600] flex flex-col items-center justify-center px-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <button onClick={() => setOpenSheet(null)} className="absolute top-8 right-8 text-white/50 hover:text-white">
            <X className="w-8 h-8" />
          </button>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-6">Total Goals</p>
          <div className="flex flex-col gap-4 w-full max-w-sm">
            {[
              { value: 'OVER_2_5',  label: 'Over 2.5 Goals' },
              { value: 'UNDER_2_5', label: 'Under 2.5 Goals' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setPendingTotalGoals(opt.value)}
                className={`border rounded-2xl p-5 flex items-center justify-center transition-all active:scale-95 ${
                  pendingTotalGoals === opt.value ? 'border-yellow-400 bg-yellow-400/10' : 'bg-zinc-900/80 border-white/10 hover:bg-zinc-800'
                }`}
              >
                <span className="text-white font-black text-base uppercase tracking-widest">{opt.label}</span>
              </button>
            ))}
          </div>
          <button onClick={confirmTotalGoals} disabled={!pendingTotalGoals} className="mt-8 w-full max-w-sm py-4 bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-black text-sm uppercase tracking-widest rounded-xl active:scale-95 transition-all">
            Confirm
          </button>
        </div>
      )}

      {/* ── PLAYER SCORE SHEET ────────────────────────────────── */}
      {openSheet === 'player_score' && (
        <div className="fixed inset-0 z-[600] flex flex-col bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <button onClick={() => setOpenSheet(null)} className="absolute top-8 right-8 text-white/50 hover:text-white">
            <X className="w-8 h-8" />
          </button>
          <div className="w-full max-w-lg mx-auto bg-zinc-900 border border-white/10 rounded-t-3xl mt-auto overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8">
            <div className="bg-zinc-800/50 px-6 py-5 border-b border-white/5">
              <h3 className="text-white font-black uppercase tracking-tighter text-xl">Pick a Goalscorer</h3>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto max-h-[55vh] scrollbar-hide">
              {SCORERS.map(player => (
                <button
                  key={player.player_id}
                  onClick={() => setPendingPlayerScore(player.player_name)}
                  className={`w-full flex justify-between items-center p-3 rounded-xl border transition-all active:scale-95 ${
                    pendingPlayerScore === player.player_name
                      ? 'bg-yellow-400/10 border-yellow-400'
                      : 'bg-white/5 border-transparent hover:bg-emerald-500/20 hover:border-emerald-500/50'
                  }`}
                >
                  <span className="text-white font-bold text-sm truncate">{player.player_name}</span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 bg-white/[0.06] px-2 py-0.5 rounded ml-3 flex-shrink-0">FW</span>
                </button>
              ))}
              {INJURED.map((player, i) => (
                <div key={i} className="w-full flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-xl px-3 py-3 opacity-40 cursor-not-allowed">
                  <span className="text-zinc-400 font-bold text-sm">{player.player_name}</span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-red-400 bg-red-900/30 border border-red-500/20 px-2 py-0.5 rounded ml-3 flex-shrink-0">INJURED</span>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-white/5">
              <button onClick={confirmPlayerScore} disabled={!pendingPlayerScore} className="w-full py-4 bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-black text-sm uppercase tracking-widest rounded-xl active:scale-95 transition-all">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SUPERSUB SHEET ────────────────────────────────────── */}
      {openSheet === 'supersub' && (
        <div className="fixed inset-0 z-[600] flex flex-col bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <button onClick={() => setOpenSheet(null)} className="absolute top-8 right-8 text-white/50 hover:text-white">
            <X className="w-8 h-8" />
          </button>
          <div className="w-full max-w-lg mx-auto bg-zinc-900 border border-white/10 rounded-t-3xl mt-auto overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8">
            <div className="bg-zinc-800/50 px-6 py-5 border-b border-white/5">
              <h3 className="text-white font-black uppercase tracking-tighter text-xl">Pick your Supersub</h3>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto max-h-[55vh] scrollbar-hide">
              <button
                onClick={() => setPendingSupersub('BENCH')}
                style={{
                  width: '100%', padding: '10px 16px', marginBottom: '4px',
                  background: pendingSupersub === 'BENCH' ? 'rgba(234,179,8,0.1)' : 'rgba(0,0,0,0.80)',
                  border: `1.5px solid ${pendingSupersub === 'BENCH' ? '#eab308' : '#00e5ff'}`,
                  borderRadius: '12px',
                  color: pendingSupersub === 'BENCH' ? '#eab308' : '#00e5ff',
                  fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '12px',
                  textTransform: 'uppercase', letterSpacing: '1.5px', cursor: 'pointer', textAlign: 'left',
                  boxShadow: '0 0 10px rgba(0,229,255,0.15)',
                }}
              >
                ⚡ Any Sub to Score — 500 pts
              </button>

              {SIM_BENCH.map(player => {
                const hi  = player.player_name === 'G. Wijnaldum' || player.player_name === 'D. Sturridge';
                const sel = pendingSupersub === player.player_name;
                return (
                  <div
                    key={player.player_id}
                    onClick={() => setPendingSupersub(player.player_name)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 10px',
                      background: sel ? 'rgba(234,179,8,0.08)' : hi ? 'rgba(0,229,255,0.04)' : 'rgba(255,255,255,0.03)',
                      borderRadius: '10px',
                      border: sel ? '1px solid #eab308' : hi ? '1px solid rgba(0,229,255,0.15)' : '1px solid rgba(255,255,255,0.05)',
                      cursor: 'pointer',
                    }}
                  >
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
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0, marginLeft: '8px' }}>
                      <span style={{
                        fontFamily: "'Montserrat', sans-serif", fontWeight: 800,
                        fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase',
                        background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '6px',
                      }}>
                        {player.position}
                      </span>
                      <span style={{
                        fontFamily: "'Montserrat', sans-serif", fontWeight: 800,
                        fontSize: '10px', color: '#f59e0b',
                      }}>
                        2500 pts
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-4 border-t border-white/5">
              <button onClick={confirmSupersub} disabled={!pendingSupersub} className="w-full py-4 bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-black text-sm uppercase tracking-widest rounded-xl active:scale-95 transition-all">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SETTLEMENT ANIMATION ──────────────────────────────── */}
      {(settling || settled) && (
        <div className="fixed inset-0 z-[150] bg-black flex flex-col items-center justify-center p-6">
          <div className="flex items-center gap-6 mb-10">
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-full bg-red-700 flex items-center justify-center">
                <span className="text-white font-black text-sm tracking-wide">LFC</span>
              </div>
              <span className="text-xs font-black uppercase text-zinc-400">Liverpool</span>
            </div>
            <div className="text-4xl font-black font-mono tracking-tighter text-white">
              {revealedGoals.length} — 0
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-full bg-blue-900 flex items-center justify-center">
                <span className="text-yellow-400 font-black text-sm tracking-wide">FCB</span>
              </div>
              <span className="text-xs font-black uppercase text-zinc-400">Barcelona</span>
            </div>
          </div>

          <div className="w-full max-w-sm space-y-3">
            {revealedGoals.map((goal, i) => (
              <div key={i} className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 animate-in slide-in-from-bottom-2 duration-300">
                <span className="text-emerald-400 font-black font-mono text-sm w-8">{goal.minute}</span>
                <span className="text-white font-bold flex-1">{goal.scorer}</span>
                <span className="text-emerald-400 font-black font-mono text-lg">{goal.score}</span>
              </div>
            ))}
            {settling && Array.from({ length: GOALS.length - revealedGoals.length }).map((_, i) => (
              <div key={`pending-${i}`} className="flex items-center gap-3 bg-zinc-900/40 border border-white/5 rounded-xl px-4 py-3">
                <div className="w-8 h-4 bg-zinc-800 rounded animate-pulse" />
                <div className="flex-1 h-4 bg-zinc-800 rounded animate-pulse" />
              </div>
            ))}
          </div>

          {settled && (
            <p className="mt-8 text-emerald-400 font-black text-sm uppercase tracking-widest animate-in fade-in duration-500">
              Full Time
            </p>
          )}
        </div>
      )}

      {/* Step 9 bubble rendered above settlement screen */}
      {settled && step === 9 && (
        <JosebaBubble
          message={JOSEBA_MESSAGES[9]}
          onAdvance={onComplete}
          variant="compact"
        />
      )}
    </div>
  );
};

export default SimulationMatchDetail;
