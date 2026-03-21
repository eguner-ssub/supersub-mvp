import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Coins, Lock, Loader2, Trophy, Signal, Goal, User, ArrowUpCircle, X } from 'lucide-react';
import { useGame } from '../../shared/context/GameContext';
import CardBase from '../../shared/ui/CardBase';
import TacticalHUD from '../../shared/ui/TacticalHUD';
import MatchTerminationTerminal from '../../shared/ui/MatchTerminationTerminal';
import MatchLineup from './MatchLineup';
import { normalizeMatch } from '../../shared/utils/normalizeMatch';

/* ─────────────────────────────────────────────────────────────
   TAB DEFINITIONS
   ───────────────────────────────────────────────────────────── */
const TABS = ['LINEUP', 'SUBS', 'EVENTS', 'STATS'];

/* ─────────────────────────────────────────────────────────────
   ASSISTANT DIALOGUE — shared across all tabs
   ───────────────────────────────────────────────────────────── */
const ASSISTANT_GREETINGS = {
  LINEUP: 'Hi Boss. Here is the tactical setup. Home team looks strong today.',
  SUBS: 'Hi Boss. The bench is deep today. If you\'re going to use the card, now\'s the time.',
  EVENTS: 'Hi Boss. It\'s getting heated out there. Hopefully the ref keeps his cards in his pocket.',
  STATS: 'Hi Boss. The numbers don\'t lie. Let\'s see what the data says.',
};

const AssistantDialogue = ({ activeTab }) => (
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
        {ASSISTANT_GREETINGS[activeTab] || ASSISTANT_GREETINGS.LINEUP}
      </p>
    </div>
  </div>
);


/* ─────────────────────────────────────────────────────────────
   MOCK DATA — Pre-match analysis & live insights (Backend WIP)
   ───────────────────────────────────────────────────────────── */
const PREMATCH_ANALYSIS_MOCK = {
  greeting: "Hi Boss. I've been studying the opposition all week. Here's what I've found.",
  sections: [
    { title: 'Form Guide', content: 'Home team are unbeaten in their last 5 home games (W3 D2). Away side struggling on the road with just 1 win in 6.' },
    { title: 'Key Matchup', content: 'Watch the battle between the home #10 and the away holding midfielder. If the playmaker gets space, expect chances.' },
    { title: 'Goals Market', content: 'Both teams have seen Over 2.5 goals in 4 of their last 5 matches. The head-to-head average is 3.2 goals per game.' },
    { title: 'Prediction', content: "This has goals written all over it. Back the home side if you're feeling confident, but the Over 2.5 market looks solid too." },
  ],
};

const LIVE_INSIGHTS_MOCK = {
  greeting: "Boss, the match is underway. Here's what I'm seeing.",
  benchPotential: 'Away team has strong options on the bench — their #14 has scored 3 goals as a substitute this season.',
  subAnalysis: 'Home manager typically makes first substitution around the 60th minute. Watch for the attacking midfielder to come on.',
};

/* ─────────────────────────────────────────────────────────────
   PREMATCH ANALYSIS — full-page assistant report (no lineups)
   ───────────────────────────────────────────────────────────── */
const PrematchAnalysis = ({ data }) => (
  <div style={{ padding: '0 12px' }}>
    {/* Assistant greeting */}
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
          width: '44px', height: '44px', borderRadius: '50%',
          objectFit: 'cover', flexShrink: 0, border: '2px solid rgba(0,0,0,0.08)',
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '9px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Tactical Expert
        </span>
        <p style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '12px', color: '#121212', margin: '3px 0 0', lineHeight: 1.35 }}>
          {data.greeting}
        </p>
      </div>
    </div>

    {/* Analysis sections */}
    {data.sections.map((section, i) => (
      <div
        key={i}
        style={{
          background: 'rgba(245, 240, 232, 0.08)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '12px',
          padding: '14px 16px',
          marginBottom: '10px',
        }}
      >
        <p style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '10px', color: '#00e5ff', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '6px' }}>
          {section.title}
        </p>
        <p style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, margin: 0 }}>
          {section.content}
        </p>
      </div>
    ))}
  </div>
);

/* ─────────────────────────────────────────────────────────────
   LIVE SUPERSUB PANEL — swipeable insight carousel
   ───────────────────────────────────────────────────────────── */
const INSIGHT_ICONS = { bench: '⚡', sub: '🔄' };

const LiveSupersubPanel = ({ insights, onUseSupersubCard, supersubCount }) => {
  const [current, setCurrent] = React.useState(0);
  const touchStartX = React.useRef(null);

  // Normalise to array — support both new (insights array) and legacy flat shape
  const cards = React.useMemo(() => {
    if (insights?.insights?.length) return insights.insights;
    const fallback = [];
    if (insights?.benchPotential) fallback.push({ type: 'bench', text: insights.benchPotential });
    if (insights?.subAnalysis)    fallback.push({ type: 'sub',   text: insights.subAnalysis });
    return fallback.length ? fallback : [{ type: 'bench', text: 'Loading insights…' }];
  }, [insights]);

  const total = cards.length;
  const goTo = (i) => setCurrent(Math.max(0, Math.min(i, total - 1)));

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd   = (e) => {
    if (touchStartX.current === null) return;
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 40) goTo(current + (delta > 0 ? 1 : -1));
    touchStartX.current = null;
  };

  const card = cards[current];

  return (
    <div
      className="fixed bottom-0 w-full z-50"
      style={{
        background: 'rgba(24, 24, 27, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px 20px 0 0',
        padding: '14px 16px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* Carousel insight */}
        <div
          style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', userSelect: 'none' }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <img
            src="/assets/assistant-head.png"
            alt="Tactical Expert"
            style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1.5px solid rgba(255,255,255,0.1)' }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '8px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {INSIGHT_ICONS[card.type]} Live Insights
              </span>
              {total > 1 && (
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {cards.map((_, i) => (
                    <div
                      key={i}
                      onClick={() => goTo(i)}
                      style={{
                        width: i === current ? '14px' : '5px',
                        height: '5px',
                        borderRadius: '3px',
                        background: i === current ? '#00e5ff' : 'rgba(255,255,255,0.2)',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
            <p style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '10px', color: 'rgba(255,255,255,0.8)', margin: '4px 0 0', lineHeight: 1.5 }}>
              {card.text}
            </p>
          </div>
        </div>

        {/* Supersub CTA */}
        <button
          onClick={onUseSupersubCard}
          disabled={supersubCount === 0}
          style={{
            width: '100%',
            padding: '10px 16px',
            background: supersubCount > 0 ? 'rgba(0,229,255,0.12)' : 'rgba(255,255,255,0.05)',
            border: `1.5px solid ${supersubCount > 0 ? '#00e5ff' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '12px',
            color: supersubCount > 0 ? '#00e5ff' : 'rgba(255,255,255,0.25)',
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 800,
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            cursor: supersubCount > 0 ? 'pointer' : 'not-allowed',
          }}
        >
          ⚡ Use Supersub Card
        </button>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   SUBSTITUTES TAB
   ───────────────────────────────────────────────────────────── */
const SM_BENCH_TYPE_ID = 12;

const SubstitutesTab = ({ match, onStageSupersub }) => {
  const allLineups = Array.isArray(match?.lineups) ? match.lineups : [];

  // Coerce to string to defeat JSON serialization type mismatches
  const benchPlayers = allLineups.filter((p) => String(p.type_id) === String(SM_BENCH_TYPE_ID));

  if (benchPlayers.length === 0)
    return <p className="text-center text-white/30 text-xs uppercase tracking-widest py-12">No substitute data available</p>;

  // Pure Sportmonks Reality: Trust the match payload, but force string matching
  const homeId = String(match?.teams?.home?.id);
  const awayId = String(match?.teams?.away?.id);

  const homeBench = benchPlayers.filter(p => String(p.team_id) === homeId);
  const awayBench = benchPlayers.filter(p => String(p.team_id) === awayId);

  const renderBench = (side, teamId, teamName, teamLogo, players) => {
    if (!players || players.length === 0) return null;

    return (
      <div style={{ marginBottom: '24px' }}>
        {/* Team Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          {teamLogo && <img src={teamLogo} alt={teamName} style={{ width: '20px', height: '20px', objectFit: 'contain' }} />}
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '12px', color: '#fff', textTransform: 'uppercase' }}>
            {teamName} Bench
          </span>
        </div>

        {/* Supersub CTA */}
        <button
          onClick={() => onStageSupersub && onStageSupersub(side, teamId, teamName)}
          style={{
            width: '100%',
            padding: '10px 16px',
            marginBottom: '14px',
            background: 'rgba(0,0,0,0.80)',
            border: '1.5px solid #00e5ff',
            borderRadius: '12px',
            color: '#00e5ff',
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 800,
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 0 10px rgba(0,229,255,0.15)',
          }}
          onMouseEnter={(e) => { e.target.style.background = 'rgba(0,229,255,0.12)'; e.target.style.boxShadow = '0 0 20px rgba(0,229,255,0.3)'; }}
          onMouseLeave={(e) => { e.target.style.background = 'rgba(0,0,0,0.80)'; e.target.style.boxShadow = '0 0 10px rgba(0,229,255,0.15)'; }}
        >
          ⚡ Use Supersub Card
        </button>

        {/* Bench list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {players.map((entry, i) => {
            const playerName = entry.player_name || entry.player?.display_name || entry.player?.name || 'Unknown';
            const jerseyNum = entry.jersey_number ?? '-';
            const playerId = entry.player_id || entry.player?.id || i;

            return (
              <div
                key={playerId}
                data-testid={`sub-player-${playerId}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 10px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: 'rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span style={{
                      fontFamily: "'Montserrat', sans-serif", fontWeight: 700,
                      fontSize: '10px', color: 'rgba(255,255,255,0.6)',
                    }}>
                      {jerseyNum}
                    </span>
                  </div>
                  <span style={{
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 700,
                    fontSize: '11px', color: '#FFFFFF',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {playerName}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '0 12px' }}>
      {renderBench('HOME', match?.teams?.home?.id, match?.teams?.home?.name || 'Home', match?.teams?.home?.logo, homeBench)}
      {renderBench('AWAY', match?.teams?.away?.id, match?.teams?.away?.name || 'Away', match?.teams?.away?.logo, awayBench)}
    </div>
  );
};


/* ─────────────────────────────────────────────────────────────
   EVENTS TAB — Tactical Timeline
   ───────────────────────────────────────────────────────────── */
const getEventIcon = (typeId, detail) => {
  if (typeId === 14 || typeId === 15 || typeId === 16 || typeId === 23) return '⚽';
  if (typeId === 17 || typeId === 22) return '❌';
  if (typeId === 18) return '🔄'; // Substitution
  if (typeId === 19) return '🟨'; // Yellow Card
  if (typeId === 20 || typeId === 21) return '🟥'; // Red / Yellow-Red
  if (typeId === 10) return '🔍'; // VAR Review

  if (typeof typeId === 'string') {
    const t = typeId.toLowerCase();
    if (t.includes('goal')) return '⚽';
    if (t.includes('sub')) return '🔄';
    if (t.includes('yellow')) return '🟨';
    if (t.includes('red')) return '🟥';
    if (t.includes('var')) return '🔍';
  }
  return '•';
};

const EventsTab = ({ events: eventsProp }) => {
  const events = Array.isArray(eventsProp) ? eventsProp : [];

  if (events.length === 0)
    return <p className="text-center text-white/30 text-xs uppercase tracking-widest py-12">No events yet</p>;

  return (
    <div style={{ padding: '0 12px', position: 'relative' }}>
      <div style={{
        position: 'absolute',
        left: '24px',
        top: 0,
        bottom: 0,
        width: '2px',
        background: 'rgba(255,255,255,0.12)',
        borderRadius: '1px',
      }} />

      {events.map((evt, i) => {
        const typeId = evt.type_id ?? evt.type;
        const icon = getEventIcon(typeId, evt.detail);
        const isGoal = typeId === 14 || (typeof typeId === 'string' && typeId.toLowerCase().includes('goal'));
        const minute = evt.minute ?? evt.time?.elapsed ?? '?';
        const playerName = evt.player_name || evt.player?.name || evt.player?.display_name || 'Unknown';
        const assistName = evt.related_player_name || evt.assist?.name || evt.assist?.display_name || null;
        const detailLabel = evt.detail || (typeof evt.type === 'string' ? evt.type : '');

        return (
          <div
            key={i}
            data-testid={`event-${i}`}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '8px 0',
              position: 'relative',
              marginLeft: '0',
            }}
          >
            <div style={{
              width: '48px',
              height: '28px',
              borderRadius: '14px',
              background: isGoal ? 'rgba(16,185,129,0.2)' : 'rgba(18,18,18,0.8)',
              border: `1px solid ${isGoal ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.12)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              zIndex: 2,
            }}>
              <span style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 800,
                fontSize: '10px',
                color: isGoal ? '#10b981' : 'rgba(255,255,255,0.5)',
              }}>
                {minute}'
              </span>
            </div>

            <span style={{ fontSize: '16px', lineHeight: '28px', flexShrink: 0 }}>
              {icon}
            </span>

            <div style={{ flex: 1, minWidth: 0, paddingTop: '3px' }}>
              <span style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: '11px',
                color: isGoal ? '#fff' : 'rgba(255,255,255,0.75)',
                display: 'block',
              }}>
                {playerName}
              </span>
              <span style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 600,
                fontSize: '9px',
                color: 'rgba(255,255,255,0.35)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                {detailLabel}
                {assistName ? ` • ${isGoal ? 'Assist' : 'On'}: ${assistName}` : ''}
              </span>
            </div>

            {evt.participant?.image_path && (
              <img
                src={evt.participant.image_path}
                alt=""
                style={{ width: '16px', height: '16px', objectFit: 'contain', opacity: 0.5, flexShrink: 0, marginTop: '4px' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};


/* ─────────────────────────────────────────────────────────────
   STATS TAB — High-contrast comparison bars
   ───────────────────────────────────────────────────────────── */
const StatsTab = ({ match }) => {
  const { statDictionary } = useGame();
  const [activeGroup, setActiveGroup] = useState('overall');

  // 1. Aggressively locate and unwrap the flat stats array
  let stats = match?.statistics || match?.raw_data?.statistics;
  if (typeof stats === 'string') {
    try { stats = JSON.parse(stats); } catch (e) { stats = []; }
  }
  if (stats && !Array.isArray(stats) && Array.isArray(stats.data)) {
    stats = stats.data;
  }
  if (!Array.isArray(stats)) stats = [];

  // 2. Aggregate raw stats by type_id (combining Home and Away)
  const aggregatedStats = {};

  stats.forEach(stat => {
    const typeId = Number(stat.type_id);
    const location = stat.location;
    const valRaw = stat.data?.value ?? stat.value;
    const value = parseFloat(String(valRaw || 0).replace('%', ''));

    if (!aggregatedStats[typeId]) {
      aggregatedStats[typeId] = { home: 0, away: 0, typeId };
    }
    if (location === 'home') aggregatedStats[typeId].home = value;
    if (location === 'away') aggregatedStats[typeId].away = value;
  });

  // 3. Categorize stats strictly using the global dictionary for the active tab
  const currentStats = [];

  Object.values(aggregatedStats).forEach(stat => {
    const dictEntry = statDictionary?.[stat.typeId];

    // Silent drop for unknown "ghost" IDs
    if (!dictEntry) return;

    // Don't render a bar if both teams have 0
    if (stat.home === 0 && stat.away === 0) return;

    const group = dictEntry.stat_group?.toLowerCase();

    // Only process stats that belong to the currently active tab
    if (group !== activeGroup) return;

    const isPercentage = dictEntry.name.includes('%') || dictEntry.name.toLowerCase().includes('possession');
    const max = isPercentage ? 100 : Math.max(stat.home, stat.away, 1);

    currentStats.push({
      label: dictEntry.name.replace(' %', ''),
      home: stat.home,
      away: stat.away,
      unit: isPercentage ? '%' : '',
      max,
      isPercentage
    });
  });

  const barStyle = (value, max, isHome) => ({
    height: '6px',
    borderRadius: '3px',
    background: isHome ? '#00e5ff' : '#f59e0b',
    width: `${Math.min((value / max) * 100, 100)}%`,
    transition: 'width 0.6s ease-out',
    marginLeft: isHome ? 'auto' : '0',
    marginRight: isHome ? '0' : 'auto',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingTop: '4px' }}>

      {/* Sub-tabs Navigation */}
      <div style={{ display: 'flex', gap: '8px', padding: '0 12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '16px' }}>
        {['overall', 'offensive', 'defensive'].map(group => (
          <button
            key={group}
            onClick={() => setActiveGroup(group)}
            style={{
              flex: 1,
              padding: '8px 0',
              background: activeGroup === group ? 'rgba(0,229,255,0.1)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${activeGroup === group ? '#00e5ff' : 'transparent'}`,
              borderRadius: '8px',
              color: activeGroup === group ? '#00e5ff' : 'rgba(255,255,255,0.5)',
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 800,
              fontSize: '9px',
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
              transition: 'all 0.2s',
            }}
          >
            {group}
          </button>
        ))}
      </div>

      {/* Render Active Category */}
      <div style={{ padding: '0 12px', paddingBottom: '16px' }}>
        {currentStats.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'rgba(255,255,255,0.3)' }}>
            <p style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', margin: 0 }}>
              No {activeGroup} stats recorded
            </p>
          </div>
        ) : (
          currentStats.map((row, i) => (
            <div key={i} style={{ marginBottom: '18px' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                marginBottom: '6px',
              }}>
                <span style={{
                  fontFamily: "'Montserrat', sans-serif", fontWeight: 800,
                  fontSize: '13px', color: '#00e5ff',
                }}>
                  {row.home}{row.unit}
                </span>
                <span style={{
                  fontFamily: "'Montserrat', sans-serif", fontWeight: 700,
                  fontSize: '10px', color: '#A0A0A0',
                  textTransform: 'uppercase', letterSpacing: '1.5px',
                }}>
                  {row.label}
                </span>
                <span style={{
                  fontFamily: "'Montserrat', sans-serif", fontWeight: 800,
                  fontSize: '13px', color: '#f59e0b',
                }}>
                  {row.away}{row.unit}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <div style={{
                  flex: 1, height: '6px', borderRadius: '3px',
                  background: 'rgba(255,255,255,0.12)',
                  display: 'flex', justifyContent: 'flex-end',
                }}>
                  <div style={barStyle(row.home, row.isPercentage ? row.max : Math.max(row.home, row.away, 1), true)} />
                </div>
                <div style={{
                  width: '2px', height: '14px', borderRadius: '1px',
                  background: 'rgba(255,255,255,0.1)',
                }} />
                <div style={{
                  flex: 1, height: '6px', borderRadius: '3px',
                  background: 'rgba(255,255,255,0.12)',
                }}>
                  <div style={barStyle(row.away, row.isPercentage ? row.max : Math.max(row.home, row.away, 1), false)} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};


/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
   ───────────────────────────────────────────────────────────── */
const MatchDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userProfile, loading: gameLoading, placeBet, consumeCard } = useGame();

  const [match, setMatch] = useState(null);
  const [odds, setOdds] = useState(null);
  const [activeBookie, setActiveBookie] = useState(null);
  const [matchPhase, setMatchPhase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [flowState, setFlowState] = useState('idle');
  const [selectedCard, setSelectedCard] = useState(null);
  const [stagedBet, setStagedBet] = useState(null);
  const [activeTab, setActiveTab] = useState('LINEUP');
  const [selectedScorerTeam, setSelectedScorerTeam] = useState('home');
  const [analysisData, setAnalysisData] = useState(null);
  const [liveInsights, setLiveInsights] = useState(null);

  const cardTypes = [
    { id: 'c_match_result', label: 'Match Result' },
    { id: 'c_total_goals', label: 'Total Goals' },
    { id: 'c_player_score', label: 'Player Score' },
    { id: 'c_supersub', label: 'Super Sub' }
  ];

  const getCardCount = (cardId) => userProfile?.inventoryMap?.[cardId] || 0;

  useEffect(() => {
    if (!id) return;
    const fetchMatchDetail = async () => {
      try {
        setLoading(true);

        // Step 1: fetch match first — we need phase + fixtureId before secondary calls
        const res = await fetch(`/api/matches?id=${id}`);
        const data = await res.json();
        if (!data.response?.length) throw new Error("Match unavailable");

        const matchInfo = normalizeMatch(data.response[0]);
        setMatch(matchInfo);

        const status = matchInfo.fixture.status.short;
        const IN_PLAY = ['INPLAY_1ST_HALF', 'INPLAY_2ND_HALF', 'INPLAY_ET', 'INPLAY_ET_SECOND_HALF', 'INPLAY_PENALTIES', 'HT', 'BREAK', 'EXTRA_TIME_BREAK'];
        const FINISHED = ['FT', 'AET', 'FT_PEN', 'POSTPONED', 'CANCELLED', 'ABANDONED', 'AWARDED', 'WO', 'DELETED'];
        const phase = IN_PLAY.includes(status) ? 'LIVE' : (FINISHED.includes(status) ? 'POST' : 'PRE');
        setMatchPhase(phase);

        const fixtureId = matchInfo.fixture?.id || matchInfo.id;

        // Step 2: fire all secondary requests in parallel
        const secondaryFetches = [];

        if (phase === 'PRE') {
          secondaryFetches.push(
            fetch(`/api/intel?match_id=${fixtureId}`)
              .then(r => r.ok ? r.json() : null)
              .then(d => { if (d?.analysis) setAnalysisData(d.analysis); })
              .catch(e => console.warn('[MatchDetail] Intel fetch error:', e))
          );
        }

        if (phase === 'LIVE') {
          secondaryFetches.push(
            fetch(`/api/intel?match_id=${fixtureId}&phase=live`)
              .then(r => r.ok ? r.json() : null)
              .then(d => { if (d?.available) setLiveInsights(d); })
              .catch(e => console.warn('[MatchDetail] Live insights fetch error:', e))
          );
        }

        if (phase !== 'POST') {
          secondaryFetches.push(
            fetch(`/api/odds/sportmonks?fixture=${fixtureId}`)
              .then(r => r.ok ? r.json() : null)
              .then(d => {
                if (!d) { setOdds(null); setActiveBookie(null); return; }
                const mr = d.match_result || {};
                const tg = d.total_goals || {};
                setOdds({
                  home: mr.home || 0,
                  draw: mr.draw || 0,
                  away: mr.away || 0,
                  goals_over: tg.over_2_5 || 0,
                  goals_under: tg.under_2_5 || 0,
                  goalscorers: d.goalscorers || [],
                });
                setActiveBookie(null);
              })
              .catch(e => { console.error('[MatchDetail] Odds fetch error:', e); setOdds(null); setActiveBookie(null); })
          );
        }

        await Promise.all(secondaryFetches);
      } catch (err) {
        console.error('[MatchDetail] Error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMatchDetail();
  }, [id]);

  const handleOutcomeClick = (selection, oddsVal, displayLabel) => {
    setStagedBet({
      card: selectedCard,
      selection,
      odds: oddsVal,
      displayLabel,
      reward: Math.floor(oddsVal * 100)
    });
    setFlowState('staging');
  };

  const handlePlay = async () => {
    if (!userProfile || !stagedBet) return;

    let snapshot = null;
    if (odds) {
      const card = String(stagedBet.card).toLowerCase();
      if (card.includes('match_result') || card.includes('match_winner')) {
        snapshot = { market: 'match_result', home: odds.home, draw: odds.draw, away: odds.away };
      } else if (card.includes('total_goals')) {
        snapshot = { market: 'total_goals', over_2_5: odds.goals_over, under_2_5: odds.goals_under };
      } else if (card.includes('player_score')) {
        snapshot = { market: 'first_goalscorer', player_id: stagedBet.selection?.split('_')[1], player_name: stagedBet.displayLabel, odds: stagedBet.odds };
      }
    }

    const result = await placeBet(match, stagedBet.selection, stagedBet.reward, stagedBet.card, stagedBet.odds, stagedBet.displayLabel, stagedBet.teamId ?? null, snapshot);
    if (result.success) {
      await consumeCard(stagedBet.card);
      setFlowState('resolved');
    }
  };

  const handleReset = () => {
    setSelectedCard(null);
    setStagedBet(null);
    setFlowState('idle');
  };

  const handleStageSupersub = (side, teamId, teamName) => {
    const count = getCardCount('c_supersub');
    if (count > 0) {
      setSelectedCard('c_supersub');
      setStagedBet({
        card: 'c_supersub',
        selection: side,
        teamId,
        displayLabel: `${teamName} Sub to Score`,
        odds: 0,
        reward: 500,
      });
      setFlowState('staging');
    }
  };

  // Reset scorer team tab when card selection changes
  useEffect(() => { setSelectedScorerTeam('home'); }, [selectedCard]);

  // ── Derived view state ────────────────────────────────────────
  const lineupsAnnounced = match?.lineups && Array.isArray(match.lineups) && match.lineups.length > 0;
  const viewState = matchPhase === 'PRE'
    ? (lineupsAnnounced ? 'PRE_LINEUPS' : 'PRE_NO_LINEUPS')
    : matchPhase; // 'LIVE' or 'POST'

  if (gameLoading || !userProfile) return <div className="bg-black h-[100dvh] flex items-center justify-center"><Loader2 className="animate-spin text-yellow-500 w-8 h-8" /></div>;

  // ── Scorer lists split by team using backend-enriched team_id ──────────
  const allScorers   = odds?.goalscorers || [];
  const homeTeamId   = match?.teams?.home?.id;
  const awayTeamId   = match?.teams?.away?.id;
  const homeScorers  = allScorers.filter(s => s.team_id === homeTeamId);
  const awayScorers  = allScorers.filter(s => s.team_id === awayTeamId);
  const otherScorers = allScorers.filter(s => s.team_id == null);
  const visibleScorers = selectedScorerTeam === 'home' ? homeScorers : awayScorers;

  return (
    <div className="h-[100dvh] w-full relative overflow-hidden flex flex-col justify-between font-sans select-none">
      <div className="absolute inset-0 z-0">
        <img
          src="/assets/bg-tunnel-live.webp"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${matchPhase === 'LIVE' ? 'opacity-100' : 'opacity-0'
            }`}
          alt="Live Match Tunnel"
        />
        <img
          src="/assets/bg-tunnel-prepost.webp"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${matchPhase === 'PRE' || matchPhase === 'POST' ? 'opacity-100' : 'opacity-0'
            }`}
          alt="Pre/Post Match Tunnel"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
      </div>

      <div className="absolute top-0 left-0 w-full px-4 pt-8 pb-4 flex justify-between items-center z-[60]">
        <button onClick={() => navigate('/match-hub')} className="w-10 h-10 bg-black/50 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center text-white"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex flex-col items-end gap-1">
          <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-yellow-400" />
            <span className="text-white font-bold text-sm">{userProfile.points ?? 0}</span>
          </div>
          {activeBookie && (
            <div className="px-2 py-0.5 rounded-full bg-black/40 border border-white/5 flex items-center gap-1.5">
              <Signal className="w-3 h-3 text-green-500 animate-pulse" />
              <span className="text-[9px] font-mono uppercase text-white/60">{activeBookie}</span>
            </div>
          )}
        </div>
      </div>

      {match && (
        <div className="absolute top-16 w-full z-40">
          <div className="w-full h-16 flex items-center justify-between px-3 bg-black/80 backdrop-blur-md border-b border-white/10 relative">
            <div className="flex-1 flex items-center justify-start min-w-0 mr-2">
              <img
                src={match.teams.home.logo}
                className="w-8 h-8 object-contain mr-2 flex-shrink-0"
                alt="Home"
              />
              <span className="text-xs font-bold text-white uppercase truncate text-left flex-grow">
                {match.teams.home.name}
              </span>
            </div>
            <div className="w-auto flex-shrink-0 mx-2 flex flex-col items-center justify-center z-10">
              <span className={`text-[9px] font-bold tracking-widest uppercase mb-[2px] leading-none ${['INPLAY_1ST_HALF', 'INPLAY_2ND_HALF', 'INPLAY_ET', 'INPLAY_ET_SECOND_HALF', 'INPLAY_PENALTIES', 'HT', 'BREAK', 'EXTRA_TIME_BREAK'].includes(match.fixture.status.short)
                ? 'text-[#39ff14]'
                : 'text-zinc-400'
                }`}>
                {match.fixture.status.short === 'NS'
                  ? new Date(match.fixture.date).toLocaleDateString([], { month: 'short', day: 'numeric' }).toUpperCase()
                  : ({ INPLAY_1ST_HALF: '1H', HT: 'HT', INPLAY_2ND_HALF: '2H', INPLAY_ET: 'ET', INPLAY_ET_SECOND_HALF: 'ET', EXTRA_TIME_BREAK: 'BT', INPLAY_PENALTIES: 'PENS', BREAK: 'BT', FT: 'FT', AET: 'AET', FT_PEN: 'FT-P', POSTPONED: 'PST', CANCELLED: 'CANC', ABANDONED: 'ABD', AWARDED: 'AWD', WO: 'WO' }[match.fixture.status.short] ?? match.fixture.status.short)
                }
              </span>
              <div className="text-lg font-black text-white font-mono leading-none">
                {match.goals.home} - {match.goals.away}
              </div>
            </div>
            <div className="flex-1 flex items-center justify-end min-w-0 ml-2">
              <span className="text-xs font-bold text-white uppercase truncate text-right flex-grow">
                {match.teams.away.name}
              </span>
              <img
                src={match.teams.away.logo}
                className="w-8 h-8 object-contain ml-2 flex-shrink-0"
                alt="Away"
              />
            </div>
          </div>
        </div>
      )}

      {match && viewState !== 'PRE_NO_LINEUPS' && (
        <div
          className="absolute w-full z-[35]"
          style={{ top: '132px' }}
        >
          <div
            style={{
              display: 'flex',
              gap: '0',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(12px)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
            className="scrollbar-hide"
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
                  transition: 'all 0.2s',
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
      )}

      {/* PRE_NO_LINEUPS: Full-page assistant analysis, no tabs */}
      {match && viewState === 'PRE_NO_LINEUPS' && (
        <div
          className="absolute z-30 w-full overflow-y-auto scrollbar-hide"
          style={{
            top: '132px',
            bottom: '256px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div
            style={{
              margin: '8px 0',
              background: 'rgba(18,18,18,0.75)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderLeft: '1px solid rgba(255,255,255,0.10)',
              borderRight: '1px solid rgba(255,255,255,0.10)',
              padding: '16px 0',
              minHeight: '100%',
            }}
          >
            <PrematchAnalysis data={analysisData || PREMATCH_ANALYSIS_MOCK} />
          </div>
        </div>
      )}

      {/* PRE_LINEUPS / LIVE: Tabbed content */}
      {match && (viewState === 'PRE_LINEUPS' || viewState === 'LIVE') && (
        <div
          className="absolute z-30 w-full overflow-y-auto scrollbar-hide"
          style={{
            top: '172px',
            bottom: viewState === 'LIVE' ? '140px' : '256px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div
            style={{
              margin: '8px 0',
              background: 'rgba(18,18,18,0.75)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderLeft: '1px solid rgba(255,255,255,0.10)',
              borderRight: '1px solid rgba(255,255,255,0.10)',
              padding: '16px 0',
              minHeight: '100%',
            }}
          >
            {(() => {
              const hasTabData =
                activeTab === 'LINEUP' ? (Array.isArray(match?.lineups) && match.lineups.length > 0) :
                  activeTab === 'SUBS' ? (Array.isArray(match?.lineups) && match.lineups.length > 0) :
                    activeTab === 'EVENTS' ? (Array.isArray(match?.events) && match.events.length > 0) :
                      activeTab === 'STATS' ? (Array.isArray(match?.statistics) && match.statistics.length >= 2) :
                        false;
              return hasTabData ? (
                <div style={{ padding: '0 12px', marginBottom: '0' }}>
                  <AssistantDialogue activeTab={activeTab} />
                </div>
              ) : null;
            })()}

            {activeTab === 'LINEUP' && (
              <MatchLineup
                fixtureId={id}
                matchPhase={matchPhase}
                fixtureDate={match.fixture?.date}
                activeTab={activeTab}
              />
            )}

            {activeTab === 'SUBS' && (
              <SubstitutesTab
                match={match}
                onStageSupersub={handleStageSupersub}
              />
            )}

            {activeTab === 'EVENTS' && (
              <EventsTab events={match?.events} />
            )}

            {activeTab === 'STATS' && (
              <StatsTab match={match} />
            )}
          </div>
        </div>
      )}

      {/* POST: Full-height content, no tabs (handled by MatchTerminationTerminal below) */}
      {match && viewState === 'POST' && (
        <div
          className="absolute z-30 w-full overflow-y-auto scrollbar-hide"
          style={{
            top: '172px',
            bottom: '0px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div
            style={{
              margin: '8px 0',
              background: 'rgba(18,18,18,0.75)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderLeft: '1px solid rgba(255,255,255,0.10)',
              borderRight: '1px solid rgba(255,255,255,0.10)',
              padding: '16px 0',
              minHeight: '100%',
            }}
          >
            {(() => {
              const hasTabData =
                activeTab === 'LINEUP' ? (Array.isArray(match?.lineups) && match.lineups.length > 0) :
                  activeTab === 'SUBS' ? (Array.isArray(match?.lineups) && match.lineups.length > 0) :
                    activeTab === 'EVENTS' ? (Array.isArray(match?.events) && match.events.length > 0) :
                      activeTab === 'STATS' ? (Array.isArray(match?.statistics) && match.statistics.length >= 2) :
                        false;
              return hasTabData ? (
                <div style={{ padding: '0 12px', marginBottom: '0' }}>
                  <AssistantDialogue activeTab={activeTab} />
                </div>
              ) : null;
            })()}

            {activeTab === 'LINEUP' && (
              <MatchLineup
                fixtureId={id}
                matchPhase={matchPhase}
                fixtureDate={match.fixture?.date}
                activeTab={activeTab}
              />
            )}

            {activeTab === 'SUBS' && (
              <SubstitutesTab
                match={match}
                onStageSupersub={handleStageSupersub}
              />
            )}

            {activeTab === 'EVENTS' && (
              <EventsTab events={match?.events} />
            )}

            {activeTab === 'STATS' && (
              <StatsTab match={match} />
            )}
          </div>
        </div>
      )}

      {(viewState === 'PRE_NO_LINEUPS' || viewState === 'PRE_LINEUPS') && (
        <div data-testid="card-shelf" className="fixed bottom-0 w-full z-50 h-64 pointer-events-none">
          <div className="absolute bottom-0 w-full h-32 bg-[url('/shelf-console.webp')] bg-cover bg-bottom z-10"></div>
          <div className="absolute inset-0 flex justify-center items-end gap-3 pb-14 px-4 pointer-events-auto">
            {cardTypes.map(card => {
              const count = getCardCount(card.id);
              const needsOdds = card.id !== 'c_supersub';
              const oddsDisabled = needsOdds && !odds;
              const inventoryDisabled = count === 0;
              const isDisabled = inventoryDisabled || oddsDisabled;
              return (
                <button
                  key={card.id}
                  data-testid={`card-${card.id}`}
                  onClick={() => {
                    if (isDisabled) return;
                    if (card.id === 'c_supersub') {
                      setActiveTab('SUBS');
                      return;
                    }
                    setSelectedCard(card.id);
                    setFlowState('selection');
                  }}
                  disabled={isDisabled}
                  className={`relative transition-all duration-300 ${selectedCard === card.id
                    ? 'translate-y-[-24px] ring-2 ring-yellow-400 shadow-xl'
                    : inventoryDisabled
                      ? 'opacity-40 grayscale'
                      : oddsDisabled
                        ? 'opacity-50 saturate-50 cursor-not-allowed'
                        : 'hover:translate-y-[-8px]'
                    }`}
                >
                  <div className="w-[5.5rem] h-[8.25rem] relative">
                    <div className="absolute inset-0 flex items-center justify-center z-10"><CardBase type={card.id} label={card.label} status="generic" variant="transparent" /></div>
                    {oddsDisabled && (
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1">
                        <Lock className="w-5 h-5 text-red-400/80" />
                        <span className="text-[8px] font-black uppercase tracking-wider text-red-400/80">No Odds</span>
                      </div>
                    )}
                    {count > 0 && !oddsDisabled && <div className="absolute -top-2 -right-2 bg-zinc-900 text-yellow-500 text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border border-yellow-500 shadow-lg z-50">x{count}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {viewState === 'LIVE' && (
        <LiveSupersubPanel
          insights={liveInsights || LIVE_INSIGHTS_MOCK}
          onUseSupersubCard={() => {
            setActiveTab('SUBS');
            const homeId = match?.teams?.home?.id;
            const homeName = match?.teams?.home?.name;
            handleStageSupersub('home', homeId, homeName);
          }}
          supersubCount={getCardCount('c_supersub')}
        />
      )}

      {matchPhase === 'POST' && <MatchTerminationTerminal />}

      {flowState === 'selection' && match && selectedCard && matchPhase !== 'POST' && (() => {
        const oddsUnavailable = !odds;

        const NoOddsState = () => (
          <div className="w-full max-w-lg bg-zinc-900/80 border border-white/10 rounded-3xl p-12 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-2">
              <Signal className="w-8 h-8 text-zinc-600" />
            </div>
            <p className="text-white font-black text-xl uppercase tracking-tight">No Odds Available</p>
            <p className="text-zinc-500 text-sm leading-relaxed">Odds for this match haven't been published yet. Check back closer to kick-off.</p>
          </div>
        );

        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
            <button onClick={handleReset} className="absolute top-8 right-8 text-white/50 hover:text-white"><X className="w-8 h-8" /></button>

            {selectedCard === 'c_match_result' && (
              oddsUnavailable ? <NoOddsState /> : (
                <div className="grid grid-cols-3 gap-4 w-full max-w-lg">
                  <button data-testid="panel-home" onClick={() => handleOutcomeClick('HOME_WIN', odds.home, match.teams.home.name)} className="bg-zinc-900/80 border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-4 hover:bg-zinc-800 transition-all">
                    <img src={match.teams.home.logo} className="w-16 h-16 object-contain" alt="Home" />
                    <span className="text-yellow-400 font-black text-2xl">+{Math.floor(odds.home * 100)}</span>
                    <span className="text-white/40 text-[10px] uppercase font-bold tracking-widest">Home Win</span>
                  </button>
                  <button data-testid="panel-draw" onClick={() => handleOutcomeClick('DRAW', odds.draw, 'Draw Result')} className="bg-zinc-900/80 border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-4 hover:bg-zinc-800 transition-all">
                    <Trophy className="w-16 h-16 text-zinc-600" />
                    <span className="text-yellow-400 font-black text-2xl">+{Math.floor(odds.draw * 100)}</span>
                    <span className="text-white/40 text-[10px] uppercase font-bold tracking-widest">Draw</span>
                  </button>
                  <button data-testid="panel-away" onClick={() => handleOutcomeClick('AWAY_WIN', odds.away, match.teams.away.name)} className="bg-zinc-900/80 border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-4 hover:bg-zinc-800 transition-all">
                    <img src={match.teams.away.logo} className="w-16 h-16 object-contain" alt="Away" />
                    <span className="text-yellow-400 font-black text-2xl">+{Math.floor(odds.away * 100)}</span>
                    <span className="text-white/40 text-[10px] uppercase font-bold tracking-widest">Away Win</span>
                  </button>
                </div>
              )
            )}

            {selectedCard === 'c_total_goals' && (
              oddsUnavailable ? <NoOddsState /> : (
                <div className="flex gap-6 w-full max-w-lg">
                  <button onClick={() => handleOutcomeClick('OVER_2.5', odds.goals_over, 'Over 2.5 Goals')} className="flex-1 bg-zinc-900/80 border border-white/10 rounded-2xl p-10 flex flex-col items-center gap-4 hover:bg-zinc-800 transition-all">
                    <ArrowUpCircle className="w-16 h-16 text-emerald-500" />
                    <div className="text-center"><p className="text-white font-black text-2xl">OVER 2.5</p><p className="text-emerald-500 font-bold">+{Math.floor(odds.goals_over * 100)} PTS</p></div>
                  </button>
                  <button onClick={() => handleOutcomeClick('UNDER_2.5', odds.goals_under, 'Under 2.5 Goals')} className="flex-1 bg-zinc-900/80 border border-white/10 rounded-2xl p-10 flex flex-col items-center gap-4 hover:bg-zinc-800 transition-all">
                    <Goal className="w-16 h-16 text-red-500" />
                    <div className="text-center"><p className="text-white font-black text-2xl">UNDER 2.5</p><p className="text-red-500 font-bold">+{Math.floor(odds.goals_under * 100)} PTS</p></div>
                  </button>
                </div>
              )
            )}

            {selectedCard === 'c_player_score' && (
              oddsUnavailable ? <NoOddsState /> : (
                <div className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8">
                  {/* Header */}
                  <div className="bg-zinc-800/50 px-6 py-5 border-b border-white/5">
                    <h3 className="text-white font-black uppercase tracking-tighter text-xl">Pick a Player to Score</h3>
                  </div>

                  {/* Home / Away team selector — badge on top, name below */}
                  <div className="grid grid-cols-2 gap-2 p-4 border-b border-white/5">
                    <button
                      onClick={() => setSelectedScorerTeam('home')}
                      className={`flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-xl border transition-all ${selectedScorerTeam === 'home' ? 'bg-white/10 border-emerald-500/50' : 'bg-white/5 border-transparent hover:bg-white/[0.07]'}`}
                    >
                      <img src={match.teams.home.logo} className="w-10 h-10 object-contain" alt="" />
                      <span className={`text-[11px] font-black uppercase text-center leading-tight ${selectedScorerTeam === 'home' ? 'text-white' : 'text-zinc-400'}`}>{match.teams.home.name}</span>
                    </button>
                    <button
                      onClick={() => setSelectedScorerTeam('away')}
                      className={`flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-xl border transition-all ${selectedScorerTeam === 'away' ? 'bg-white/10 border-emerald-500/50' : 'bg-white/5 border-transparent hover:bg-white/[0.07]'}`}
                    >
                      <img src={match.teams.away.logo} className="w-10 h-10 object-contain" alt="" />
                      <span className={`text-[11px] font-black uppercase text-center leading-tight ${selectedScorerTeam === 'away' ? 'text-white' : 'text-zinc-400'}`}>{match.teams.away.name}</span>
                    </button>
                  </div>

                  {/* Player list for selected team */}
                  <div className="h-[55vh] overflow-y-auto p-4 space-y-2 scrollbar-hide">
                    {visibleScorers.length === 0 && otherScorers.length === 0 ? (
                      <p className="text-zinc-600 text-[10px] text-center pt-4 uppercase tracking-widest">No players available</p>
                    ) : (
                      <>
                        {visibleScorers.map((player) => (
                          <button key={player.player_name} onClick={() => handleOutcomeClick(`SCORE_${player.player_name}`, player.odds, player.player_name)} className="w-full flex justify-between items-center p-3 bg-white/5 rounded-xl hover:bg-emerald-500/20 border border-transparent hover:border-emerald-500/50 transition-all">
                            <span className="text-white font-bold text-sm truncate">{player.player_name}</span>
                            <span className="text-yellow-400 font-black text-sm whitespace-nowrap ml-3">+{Math.floor(player.odds * 100)} pts</span>
                          </button>
                        ))}

                        {/* Unmatched players (no team data in squad cache) */}
                        {otherScorers.length > 0 && (
                          <>
                            <div className="pt-3 pb-1"><span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Other</span></div>
                            {otherScorers.map((player) => (
                              <button key={player.player_name} onClick={() => handleOutcomeClick(`SCORE_${player.player_name}`, player.odds, player.player_name)} className="w-full flex justify-between items-center p-3 bg-white/5 rounded-xl hover:bg-emerald-500/20 border border-transparent hover:border-emerald-500/50 transition-all">
                                <span className="text-white font-bold text-sm truncate">{player.player_name}</span>
                                <span className="text-yellow-400 font-black text-sm whitespace-nowrap ml-3">+{Math.floor(player.odds * 100)} pts</span>
                              </button>
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        );
      })()}

      {flowState === 'staging' && stagedBet && matchPhase !== 'POST' && (
        <div data-testid="staging-bar" className="fixed inset-0 z-[110] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl">
            <div className="flex justify-between items-start mb-8">
              <div className="space-y-1"><p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Outcome Selection</p><h3 className="text-white font-black text-3xl uppercase italic tracking-tighter leading-tight">{stagedBet.displayLabel}</h3></div>
              <div className="text-right space-y-1"><p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Reward</p><p className="text-yellow-400 font-black text-4xl tracking-tighter">{stagedBet.reward} <span className="text-xs uppercase">pts</span></p></div>
            </div>
            <div className="flex gap-4">
              <button onClick={handleReset} className="flex-1 py-4 bg-zinc-800 rounded-2xl font-bold uppercase text-zinc-400 text-xs tracking-widest hover:bg-zinc-700 transition-colors">Cancel</button>
              <button data-testid="play-button" onClick={handlePlay} className="flex-[2] py-4 bg-emerald-500 rounded-2xl font-black uppercase text-black text-xl shadow-[0_10px_30px_rgba(16,185,129,0.3)] hover:scale-105 transition-all">Confirm Play</button>
            </div>
          </div>
        </div>
      )}

      {flowState === 'resolved' && (
        <div className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="text-center w-full max-w-sm border border-white/10 bg-zinc-900/50 p-10 rounded-[3rem] relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent"></div>
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/30"><Trophy className="w-10 h-10 text-emerald-400" /></div>
            <h2 className="text-white font-black uppercase text-4xl tracking-tighter mb-4">Locked In!</h2>
            <p className="text-zinc-500 text-sm mb-8 uppercase tracking-widest font-bold">Your prediction has been logged in the Locker Room</p>
            <button onClick={handleReset} className="w-full py-5 bg-white text-black font-black uppercase rounded-2xl shadow-2xl hover:bg-zinc-200 transition-colors tracking-tighter text-lg">Continue Scouting</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchDetail;