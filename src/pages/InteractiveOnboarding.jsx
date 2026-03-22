import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// ── CSS Keyframe Animations ───────────────────────────────────────────────
const KEYFRAMES = `
  @keyframes flicker {
    0%, 100% { opacity: 1; }
    8%  { opacity: 0.2; }
    16% { opacity: 0.9; }
    24% { opacity: 0.05; }
    32% { opacity: 0.8; }
    40% { opacity: 0.0; }
    48% { opacity: 0.95; }
    56% { opacity: 0.3; }
    64% { opacity: 1; }
    72% { opacity: 0.4; }
    80% { opacity: 0.0; }
    88% { opacity: 0.75; }
  }
  @keyframes shake {
    0%, 100% { transform: translate(0, 0) rotate(0deg); }
    15%  { transform: translate(-5px, -2px) rotate(-0.5deg); }
    30%  { transform: translate(5px, 2px) rotate(0.5deg); }
    45%  { transform: translate(-3px, 1px); }
    60%  { transform: translate(4px, -2px) rotate(-0.3deg); }
    75%  { transform: translate(-2px, 3px); }
    90%  { transform: translate(2px, -1px); }
  }
  @keyframes pulse-border {
    0%, 100% { border-color: rgba(0,229,255,0.9); box-shadow: 0 0 12px rgba(0,229,255,0.6); }
    50%       { border-color: rgba(0,229,255,0.4); box-shadow: 0 0 6px rgba(0,229,255,0.2); }
  }
  @keyframes scanline {
    0%   { top: -4px; opacity: 1; }
    100% { top: 100%; opacity: 0.6; }
  }
  @keyframes clockTick {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  @keyframes cyan-flash {
    0%   { opacity: 0; }
    20%  { opacity: 1; }
    100% { opacity: 0; }
  }
  @keyframes winner-bounce {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-8px); }
  }
`;

// ── Mock Squad Data ───────────────────────────────────────────────────────

// Hardcoded SportMonks CDN logos for Man Utd (id=14) and Bayern (id=5)
// SportMonks CDN: path = teams/{id % 32}/{id}.png
// Man Utd id=14 → 14%32=14, Bayern München id=503 → 503%32=23
const MAN_UTD_LOGO = 'https://cdn.sportmonks.com/images/soccer/teams/14/14.png';
const BAYERN_LOGO  = 'https://cdn.sportmonks.com/images/soccer/teams/23/503.png';

// Man Utd 4-4-2 — GK→FWD order; LineupTab reverses to render FWD at top
const MAN_UTD_ROWS = [
  [{ n: 1,  name: 'Schmeichel' }],
  [{ n: 3,  name: 'Irwin' }, { n: 6, name: 'Stam' }, { n: 12, name: 'Johnsen' }, { n: 2, name: 'Neville' }],
  [{ n: 15, name: 'Blomqvist' }, { n: 8, name: 'Butt' }, { n: 7, name: 'Beckham' }, { n: 11, name: 'Giggs' }],
  [{ n: 9,  name: 'Cole' }, { n: 19, name: 'Yorke' }],
];

// Bayern 3-4-3 (5-2-3) — GK→FWD order; rendered GK at top half, FWD nearest centre
const BAYERN_ROWS = [
  [{ n: 1,  name: 'Kahn' }],
  [{ n: 2,  name: 'Babbel' }, { n: 25, name: 'Linke' }, { n: 10, name: 'Matthäus' }, { n: 4, name: 'Kuffour' }, { n: 18, name: 'Tarnat' }],
  [{ n: 11, name: 'Effenberg' }, { n: 16, name: 'Jeremies' }],
  [{ n: 14, name: 'Basler' }, { n: 19, name: 'Jancker' }, { n: 21, name: 'Zickler' }],
];

// Legacy alias so existing code still works
const STARTERS_BY_ROW = MAN_UTD_ROWS;

const SUBS_LIST = [
  { number: 13, name: 'Raimond van der Gouw', position: 'GK' },
  { number: 4,  name: 'David May',            position: 'DEF' },
  { number: 23, name: 'Phil Neville',         position: 'DEF' },
  { number: 24, name: 'Wes Brown',            position: 'DEF' },
  { number: 16, name: 'Jonathan Greening',    position: 'MID' },
  { number: 10, name: 'Teddy Sheringham',     position: 'FWD' },
  { number: 20, name: 'Ole Gunnar Solskjær',  position: 'FWD', isSuperSub: true },
];

// ── Progress step map ─────────────────────────────────────────────────────
const PHASE_TO_STEP = {
  intro: 0, bench: 0,
  lineup: 1,
  subs: 2, confirm: 2,
  payoff: 3,
  done: 4,
};

// ── Root Component ────────────────────────────────────────────────────────
export default function InteractiveOnboarding() {
  const navigate = useNavigate();

  const [phase, setPhase]           = useState('intro');
  const [introStage, setIntroStage] = useState('logo'); // logo | flicker | reveal | scoreboard

  // Payoff state
  const [minute, setMinute]                   = useState(81);
  const [score, setScore]                     = useState({ home: 0, away: 1 });
  const [shaking, setShaking]                 = useState(false);
  const [showGoalPopup, setShowGoalPopup]     = useState(false);
  const [showFinalPopup, setShowFinalPopup]   = useState(false);

  const progressStep = PHASE_TO_STEP[phase] ?? 0;

  const handleSkip = () => {
    localStorage.setItem('ss_onboarding_seen', '1');
    navigate('/login', { replace: true });
  };

  const handleComplete = () => {
    localStorage.setItem('ss_onboarding_seen', '1');
    localStorage.setItem('ss_onboarding_points', '2500');
    navigate('/signup', { replace: true });
  };

  // ── Phase 1: intro sequence ───────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'intro') return;
    const timers = [
      setTimeout(() => setIntroStage('flicker'),    1500),
      setTimeout(() => setIntroStage('reveal'),     2100),
      setTimeout(() => setIntroStage('scoreboard'), 3100),
      setTimeout(() => setPhase('bench'),           5400),
    ];
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  // ── Phase 5: fast-forward clock ───────────────────────────────────────
  useEffect(() => {
    if (phase !== 'payoff') return;
    let current = 81;
    const interval = setInterval(() => {
      current++;
      setMinute(current);
      if (current >= 93) {
        clearInterval(interval);
        setTimeout(() => {
          setScore({ home: 2, away: 1 }); // Solskjær makes it 2-1
          setShaking(true);
          setTimeout(() => setShaking(false), 700);
          setTimeout(() => setShowGoalPopup(true), 200);
          setTimeout(() => {
            setShowGoalPopup(false);
            setShowFinalPopup(true);
            setPhase('done');
          }, 3600);
        }, 400);
      }
    }, 160);
    return () => clearInterval(interval);
  }, [phase]);

  const displayMinute = minute > 90 ? `90+${minute - 90}'` : `${minute}'`;

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        className="fixed inset-0 bg-black overflow-hidden select-none"
        style={{ fontFamily: "'Montserrat', sans-serif" }}
      >
        {/* Phases 1 & 2 */}
        {(phase === 'intro' || phase === 'bench') && (
          <BenchScene introStage={introStage} phase={phase} onTabletTap={() => setPhase('lineup')} />
        )}

        {/* Phase 3: Lineup */}
        {phase === 'lineup' && (
          <MockMatchView
            activeTab="lineup"
            minute={displayMinute}
            score={score}
            onUseSupersubCard={() => setPhase('subs')}
          />
        )}

        {/* Phase 4a: Subs */}
        {phase === 'subs' && (
          <MockMatchView
            activeTab="subs"
            minute={displayMinute}
            score={score}
            onSolskjaerCTA={() => setPhase('confirm')}
          />
        )}

        {/* Phase 4b: Confirm */}
        {phase === 'confirm' && (
          <MockMatchView
            activeTab="subs"
            minute={displayMinute}
            score={score}
            showConfirmModal
            onConfirm={() => setPhase('payoff')}
            onCancel={() => setPhase('subs')}
          />
        )}

        {/* Phase 5: Payoff */}
        {(phase === 'payoff' || phase === 'done') && (
          <PayoffView
            minute={displayMinute}
            score={score}
            shaking={shaking}
            showGoalPopup={showGoalPopup}
            showFinalPopup={showFinalPopup}
            onComplete={handleComplete}
          />
        )}

        {/* Skip */}
        {phase !== 'done' && (
          <button
            onClick={handleSkip}
            className="absolute top-5 right-5 z-[90] text-white/35 text-xs font-bold uppercase tracking-widest hover:text-white/65 transition-colors px-2 py-1"
          >
            Skip →
          </button>
        )}

        {/* Progress dots */}
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width:  i === progressStep ? 24 : 8,
                height: 8,
                background:
                  i === progressStep       ? '#00e5ff'
                  : i < progressStep       ? 'rgba(255,255,255,0.4)'
                  :                          'rgba(255,255,255,0.15)',
              }}
            />
          ))}
        </div>
      </div>
    </>
  );
}

// ── TeamLogo ──────────────────────────────────────────────────────────────
function TeamLogo({ src, fallback, size = 36 }) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <span style={{ fontSize: size * 0.75, lineHeight: 1 }}>{fallback}</span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      style={{ width: size, height: size, objectFit: 'contain' }}
      onError={() => setErrored(true)}
    />
  );
}

// ── BenchScene ────────────────────────────────────────────────────────────
function BenchScene({ introStage, phase, onTabletTap }) {
  const showBench      = ['reveal', 'scoreboard'].includes(introStage) || phase === 'bench';
  const showLogo       = ['logo', 'flicker'].includes(introStage);
  const showScoreboard = introStage === 'scoreboard' || phase === 'bench';

  return (
    <div className="absolute inset-0">
      {/* Bench background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('/assets/bg-benchview.webp')",
          opacity:    showBench ? 1 : 0,
          transition: 'opacity 0.9s ease-in',
        }}
      >
        <div className="absolute inset-0 bg-black/35" />
      </div>

      {/* Black base */}
      <div
        className="absolute inset-0 bg-black"
        style={{ opacity: showBench ? 0 : 1, transition: 'opacity 0.7s', pointerEvents: 'none' }}
      />

      {/* Logo */}
      {showLogo && (
        <div
          className="absolute inset-0 flex items-center justify-center z-10"
          style={{ animation: introStage === 'flicker' ? 'flicker 0.6s ease-in-out forwards' : 'none' }}
        >
          <img
            src="/logo.webp"
            alt="SuperSub"
            className="w-64 h-auto drop-shadow-[0_0_40px_rgba(34,197,94,0.5)]"
            style={{ opacity: introStage === 'logo' ? 1 : 0.8, transition: 'opacity 0.6s' }}
          />
        </div>
      )}

      {/* Scanline */}
      {introStage === 'flicker' && (
        <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
          <div style={{ position: 'absolute', left: 0, width: '100%', height: '4px', background: 'rgba(255,255,255,0.9)', animation: 'scanline 0.6s linear forwards' }} />
        </div>
      )}

      {/* Scoreboard */}
      <div
        className="absolute top-0 left-0 right-0 z-20 px-5 pt-9 pb-5"
        style={{
          opacity:    showScoreboard ? 1 : 0,
          transition: 'opacity 0.9s ease-in',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.6) 70%, transparent 100%)',
          pointerEvents: 'none',
        }}
      >
        <p className="text-center text-[9px] font-bold uppercase tracking-[3px] text-white/40 mb-3">
          UEFA Champions League Final · 26 May 1999
        </p>
        <div className="flex items-center justify-between gap-2">
          {/* Home */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <TeamLogo src={MAN_UTD_LOGO} fallback="🔴" size={32} />
            <span className="text-white font-black text-sm uppercase tracking-wide truncate">Man Utd</span>
          </div>
          {/* Score */}
          <div className="flex flex-col items-center flex-shrink-0 px-2">
            <span className="font-black text-3xl text-white tracking-tighter leading-none">0 — 1</span>
            <span className="text-[11px] font-black mt-1" style={{ color: '#00e5ff' }}>81'</span>
          </div>
          {/* Away */}
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <span className="text-white font-black text-sm uppercase tracking-wide truncate text-right">Bayern</span>
            <TeamLogo src={BAYERN_LOGO} fallback="🔵" size={32} />
          </div>
        </div>
      </div>

      {/* Tablet hotspot */}
      {phase === 'bench' && (
        <button
          onClick={onTabletTap}
          className="absolute z-30 flex flex-col items-center justify-end"
          aria-label="Tap the tablet to make your Supersub call"
          style={{
            top: '70%', left: '0%', width: '36%', height: '18%',
            borderRadius: '10px', background: 'transparent',
            border: 'none', paddingBottom: '6px',
          }}
        >
          <div
            className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap"
            style={{
              background: 'rgba(0,0,0,0.72)',
              border: '1px solid rgba(0,229,255,0.5)',
              color: '#00e5ff',
              animation: 'pulse-border 2s ease-in-out infinite',
            }}
          >
            ⚡ Tap the tablet
          </div>
        </button>
      )}
    </div>
  );
}

// ── MockMatchView ─────────────────────────────────────────────────────────
function MockMatchView({ activeTab, minute, score, onUseSupersubCard, onSolskjaerCTA, showConfirmModal, onConfirm, onCancel }) {
  return (
    <div className="absolute inset-0 flex flex-col bg-[#0d1117]">
      {/* Row 1: back + competition (no points — it's 0 for everyone) */}
      <div className="flex items-center justify-between px-4 pt-5 pb-2">
        <div className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center bg-black/40">
          <ArrowLeft className="w-4 h-4 text-white" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[2px] text-white/45">
          UEFA Champions League Final
        </span>
        {/* Spacer to keep competition text centered */}
        <div className="w-9" />
      </div>

      {/* Row 2: teams + score */}
      <div className="flex items-center justify-between px-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <TeamLogo src={MAN_UTD_LOGO} fallback="🔴" size={28} />
          <span className="text-white font-black text-xs uppercase tracking-wide truncate">Man Utd</span>
        </div>
        <div className="flex flex-col items-center flex-shrink-0 px-3">
          <span className="font-black text-2xl text-white tracking-tighter leading-none">{score.home} — {score.away}</span>
          <span className="text-[11px] font-black mt-0.5" style={{ color: '#00e5ff' }}>{minute}</span>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className="text-white font-black text-xs uppercase tracking-wide truncate text-right">Bayern</span>
          <TeamLogo src={BAYERN_LOGO} fallback="🔵" size={28} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {['LINEUP', 'SUBS', 'EVENTS', 'STATS'].map((tab) => {
          const key = tab.toLowerCase();
          const isActive = key === activeTab;
          return (
            <div
              key={tab}
              className="flex-1 py-3 text-center text-xs font-black uppercase tracking-widest"
              style={{
                color: isActive ? '#00e5ff' : 'rgba(255,255,255,0.28)',
                borderBottom: isActive ? '2px solid #00e5ff' : '2px solid transparent',
              }}
            >
              {tab}
            </div>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: activeTab === 'lineup' ? '148px' : '32px' }}>
        {activeTab === 'lineup' && <LineupTab />}
        {activeTab === 'subs'   && <SubsTab onSolskjaerCTA={onSolskjaerCTA} />}
      </div>

      {/* Live Insights + CTA — lineup only */}
      {activeTab === 'lineup' && (
        <div
          className="absolute bottom-0 left-0 right-0 px-4 pt-3 pb-6"
          style={{ background: 'rgba(10,12,18,0.97)', borderTop: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-start gap-2.5 mb-3">
            <img src="/assets/assistant-head.png" alt="Expert" className="w-7 h-7 rounded-full object-cover border border-white/10 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: '#00e5ff' }}>⚡ Live Insights</p>
              <p className="text-white/70 text-[11px] font-semibold leading-snug">
                Man Utd's Ole Gunnar Solskjær has <strong className="text-white">7 goals as a substitute</strong> this season (0.86 per 90).
              </p>
            </div>
          </div>
          <button
            onClick={onUseSupersubCard}
            className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-widest transition-all active:scale-95"
            style={{
              background: 'rgba(0,229,255,0.12)',
              border: '2px solid #00e5ff',
              color: '#00e5ff',
              boxShadow: '0 0 20px rgba(0,229,255,0.25)',
              animation: 'pulse-border 2s ease-in-out infinite',
            }}
          >
            ⚡ Use Supersub Card
          </button>
        </div>
      )}

      {/* Confirm modal */}
      {showConfirmModal && <ConfirmModal onConfirm={onConfirm} onCancel={onCancel} />}
    </div>
  );
}

// ── LineupTab — split pitch, Bayern top half, Man Utd bottom half ──────────
function LineupTab() {
  return (
    <div
      className="relative mx-3 my-3 rounded-xl overflow-hidden"
      style={{ background: '#152015', border: '1px solid rgba(255,255,255,0.06)', minHeight: '340px' }}
    >
      {/* Pitch markings */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 170" preserveAspectRatio="none" style={{ opacity: 0.15 }}>
        <rect x="6" y="3" width="88" height="164" fill="none" stroke="white" strokeWidth="1" />
        {/* Halfway line */}
        <line x1="6" y1="85" x2="94" y2="85" stroke="white" strokeWidth="0.7" />
        {/* Centre circle */}
        <circle cx="50" cy="85" r="12" fill="none" stroke="white" strokeWidth="0.7" />
        <circle cx="50" cy="85" r="1" fill="white" />
        {/* Bayern penalty box (top) */}
        <rect x="26" y="3"  width="48" height="18" fill="none" stroke="white" strokeWidth="0.6" />
        <rect x="37" y="3"  width="26" height="9"  fill="none" stroke="white" strokeWidth="0.6" />
        {/* Man Utd penalty box (bottom) */}
        <rect x="26" y="149" width="48" height="18" fill="none" stroke="white" strokeWidth="0.6" />
        <rect x="37" y="158" width="26" height="9"  fill="none" stroke="white" strokeWidth="0.6" />
      </svg>

      {/* Formation badges */}
      <div className="absolute top-2 left-2.5 flex items-center gap-1 z-10">
        <TeamLogo src={BAYERN_LOGO} fallback="🔵" size={14} />
        <span className="text-white/40 text-[9px] font-bold">3-4-3</span>
      </div>
      <div className="absolute bottom-2 left-2.5 flex items-center gap-1 z-10">
        <TeamLogo src={MAN_UTD_LOGO} fallback="🔴" size={14} />
        <span className="text-white/40 text-[9px] font-bold">4-4-2</span>
      </div>

      {/* ── Bayern: GK at top, FWD nearest centre line ── */}
      <div className="relative z-10 flex flex-col justify-around" style={{ height: '50%', paddingTop: 10, paddingBottom: 4 }}>
        {BAYERN_ROWS.map((row, i) => (
          <div key={i} className="flex justify-around items-center px-1">
            {row.map(p => <PlayerNode key={p.n} number={p.n} name={p.name} kit="away" />)}
          </div>
        ))}
      </div>

      {/* ── Man Utd: FWD nearest centre line, GK at bottom ── */}
      <div className="relative z-10 flex flex-col-reverse justify-around" style={{ height: '50%', paddingTop: 4, paddingBottom: 10 }}>
        {MAN_UTD_ROWS.map((row, i) => (
          <div key={i} className="flex justify-around items-center px-1">
            {row.map(p => <PlayerNode key={p.n} number={p.n} name={p.name} kit="home" />)}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayerNode({ number, name, kit = 'home' }) {
  const bg   = kit === 'home' ? '#f5f0e8' : '#9ca3af';
  const text = '#111';
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className="rounded-full flex items-center justify-center font-black shadow-md"
        style={{ width: 28, height: 28, background: bg, color: text, fontSize: 10 }}
      >
        {number}
      </div>
      <span className="text-white/55 text-[8px] font-semibold text-center leading-tight" style={{ maxWidth: 40, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </span>
    </div>
  );
}

// ── SubsTab — matches real MatchDetail subs styling ───────────────────────
function SubsTab({ onSolskjaerCTA }) {
  return (
    <div style={{ padding: '0 12px' }}>
      {/* Team bench header */}
      <div className="flex items-center gap-2 mt-4 mb-2 px-1">
        <TeamLogo src={MAN_UTD_LOGO} fallback="🔴" size={18} />
        <span className="text-white/40 text-[10px] font-black uppercase tracking-widest">Man Utd Bench</span>
      </div>

      {SUBS_LIST.map((sub) => (
        <div
          key={sub.number}
          className="flex items-center gap-3 px-4 pt-2 pb-2"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          {/* Jersey number circle */}
          <div
            className="flex-shrink-0 flex items-center justify-center font-black text-xs rounded-full"
            style={{ width: 28, height: 28, background: '#f5f0e8', color: '#111' }}
          >
            {sub.number}
          </div>

          {/* Full name */}
          <span className="flex-1 text-white font-semibold text-sm truncate">{sub.name}</span>

          {/* Supersub CTA — Solskjær ONLY */}
          {sub.isSuperSub && (
            <button
              onClick={onSolskjaerCTA}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all active:scale-95"
              style={{
                background: 'rgba(0,229,255,0.12)',
                border: '1.5px solid #00e5ff',
                color: '#00e5ff',
                animation: 'pulse-border 2s ease-in-out infinite',
              }}
            >
              ⚡ Supersub
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── ConfirmModal — matches real MatchDetail staging modal ─────────────────
function ConfirmModal({ onConfirm, onCancel }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl">
        <div className="flex justify-between items-start mb-8">
          <div className="space-y-1">
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Outcome Selection</p>
            <h3 className="text-white font-black text-3xl uppercase italic tracking-tighter leading-tight">
              Solskjær<br />Sub to Score
            </h3>
          </div>
          <div className="text-right space-y-1">
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Reward</p>
            <p className="text-yellow-400 font-black text-4xl tracking-tighter">
              2500 <span className="text-xs uppercase">pts</span>
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={onCancel}
            className="flex-1 py-4 bg-zinc-800 rounded-2xl font-bold uppercase text-zinc-400 text-xs tracking-widest hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-[2] py-4 bg-emerald-500 rounded-2xl font-black uppercase text-black text-xl shadow-[0_10px_30px_rgba(16,185,129,0.3)] hover:scale-105 transition-all"
          >
            Confirm Play
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PayoffView ────────────────────────────────────────────────────────────
function PayoffView({ minute, score, shaking, showGoalPopup, showFinalPopup, onComplete }) {
  return (
    <div
      className="absolute inset-0 flex flex-col"
      style={{
        background: 'linear-gradient(180deg, #080808 0%, #0a160a 100%)',
        animation: shaking ? 'shake 0.6s ease-in-out' : 'none',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-2">
        <div className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center bg-black/40">
          <ArrowLeft className="w-4 h-4 text-white" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[2px] text-white/45">UEFA Champions League Final</span>
        <div className="w-9" />
      </div>

      {/* Scoreboard */}
      <div className="mx-4 mt-3 mb-4 rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center flex-1 gap-2">
            <TeamLogo src={MAN_UTD_LOGO} fallback="🔴" size={40} />
            <span className="text-white font-black text-xs uppercase tracking-wide text-center">Man Utd</span>
          </div>
          <div className="flex flex-col items-center px-4">
            <span
              className="font-black text-5xl tracking-tighter transition-all duration-500"
              style={{
                color:      score.home === 2 ? '#00e5ff' : 'white',
                textShadow: score.home === 2 ? '0 0 24px rgba(0,229,255,0.8)' : 'none',
              }}
            >
              {score.home} — {score.away}
            </span>
            <span className="text-sm font-black mt-2" style={{ color: '#00e5ff', animation: 'clockTick 0.5s ease-in-out infinite' }}>
              {minute}
            </span>
          </div>
          <div className="flex flex-col items-center flex-1 gap-2">
            <TeamLogo src={BAYERN_LOGO} fallback="🔵" size={40} />
            <span className="text-white font-black text-xs uppercase tracking-wide text-center">Bayern</span>
          </div>
        </div>
      </div>

      {/* Cyan flash */}
      {shaking && (
        <div className="absolute inset-0 z-20 pointer-events-none" style={{ background: 'rgba(0,229,255,0.12)', animation: 'cyan-flash 0.7s ease-out forwards' }} />
      )}

      {/* GOAL popup — matches real resolved modal style */}
      {showGoalPopup && (
        <div className="absolute inset-x-4 top-[28%] z-30 animate-in zoom-in duration-300">
          <div className="w-full max-w-md mx-auto bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
              <span className="text-3xl">⚽</span>
            </div>
            <h2 className="text-white font-black uppercase text-3xl tracking-tighter mb-2">Goal!</h2>
            <p className="text-zinc-400 text-sm font-bold uppercase tracking-widest">Manchester United</p>
            <p className="text-zinc-500 text-xs mt-1">Scored by Ole Gunnar Solskjær · 90+3'</p>
          </div>
        </div>
      )}

      {/* FINAL popup — matches WinModal style */}
      {showFinalPopup && (
        <div className="absolute inset-0 z-40 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-500">
          <div
            className="w-full max-w-sm rounded-3xl p-8 text-center relative overflow-hidden shadow-[0_0_60px_rgba(234,179,8,0.3)]"
            style={{ background: 'linear-gradient(160deg, #ca8a04 0%, #ea580c 50%, #b91c1c 100%)' }}
          >
            {/* Trophy */}
            <div
              className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl"
              style={{ animation: 'winner-bounce 1s ease-in-out infinite' }}
            >
              <span className="text-4xl">🏆</span>
            </div>

            <p className="text-white font-black text-2xl tracking-widest mb-1">🎉 WINNER! 🎉</p>
            <p className="text-white/80 font-bold text-xs uppercase tracking-widest mb-5">Match Finished!</p>

            {/* Reward */}
            <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 mb-5 border border-white/20">
              <p className="text-white/70 text-[10px] font-black uppercase tracking-widest mb-1">Your Supersub Reward</p>
              <p className="text-white font-black text-4xl tracking-tighter">
                +2,500 <span className="text-xl">pts</span>
              </p>
            </div>

            <p className="text-white/65 text-xs mb-5 leading-relaxed">
              Create your account to save your points<br />and play with real matches.
            </p>

            {/* CTA — solid white, distinct from cyan Supersub style */}
            <button
              onClick={onComplete}
              className="w-full py-4 rounded-2xl font-black uppercase text-black text-base tracking-widest shadow-2xl hover:scale-[1.02] transition-all active:scale-95"
              style={{ background: 'white' }}
            >
              Create Your Account →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
