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

        if (phase !== 'POST') {
          const fixtureId = matchInfo.fixture?.id || matchInfo.id;
          try {
            const oddsRes = await fetch(`/api/odds/sportmonks?fixture=${fixtureId}`);
            if (oddsRes.ok) {
              const oddsData = await oddsRes.json();
              const mr = oddsData.match_result || {};
              const tg = oddsData.total_goals || {};
              setOdds({
                home: mr.home || 0,
                draw: mr.draw || 0,
                away: mr.away || 0,
                goals_over: tg.over_2_5 || 0,
                goals_under: tg.under_2_5 || 0,
                goalscorers: oddsData.goalscorers || [],
              });
              setActiveBookie(null);
            } else {
              console.warn('[MatchDetail] No odds available for this fixture');
              setOdds(null);
              setActiveBookie(null);
            }
          } catch (oddsErr) {
            console.error('[MatchDetail] Odds fetch error:', oddsErr);
            setOdds(null);
            setActiveBookie(null);
          }
        }
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

  const getScorerColumns = () => {
    const scorers = odds?.goalscorers;
    if (!scorers || scorers.length === 0) return [[], []];
    const midpoint = Math.ceil(scorers.length / 2);
    return [scorers.slice(0, midpoint), scorers.slice(midpoint)];
  };

  if (gameLoading || !userProfile) return <div className="bg-black h-[100dvh] flex items-center justify-center"><Loader2 className="animate-spin text-yellow-500 w-8 h-8" /></div>;

  const [leftScorers, rightScorers] = getScorerColumns();

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
            <span className="text-white font-bold text-sm">{userProfile.coins ?? 0}</span>
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

      {match && (
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

      {match && (
        <div
          className="absolute z-30 w-full overflow-y-auto scrollbar-hide"
          style={{
            top: '172px',
            bottom: matchPhase === 'POST' ? '0px' : '256px',
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

      {(matchPhase === 'PRE' || matchPhase === 'LIVE') && (
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
                <div className="w-full max-w-4xl bg-zinc-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8">
                  <div className="bg-zinc-800/50 p-6 border-b border-white/5 flex justify-between items-center">
                    <h3 className="text-white font-black uppercase tracking-tighter text-xl">Select Scorer</h3>
                    <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-1 rounded font-bold uppercase tracking-widest">Goalscorers</span>
                  </div>
                  <div className="grid grid-cols-2 h-[60vh]">
                    <div className="border-r border-white/5 flex flex-col">
                      <div className="p-4 bg-black/20 flex items-center gap-2">
                        <img src={match.teams.home.logo} className="w-5 h-5 object-contain" alt="" />
                        <span className="text-zinc-400 text-[10px] font-black uppercase truncate">{match.teams.home.name}</span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
                        {leftScorers.length === 0 && rightScorers.length === 0 ? (
                          <p className="text-zinc-600 text-[10px] text-center pt-4 uppercase tracking-widest">No players available</p>
                        ) : leftScorers.map((player) => (
                          <button key={player.player_name} onClick={() => handleOutcomeClick(`SCORE_${player.player_name}`, player.odds, player.player_name)} className="w-full flex justify-between items-center p-3 bg-white/5 rounded-xl hover:bg-emerald-500/20 border border-transparent hover:border-emerald-500/50 group transition-all">
                            <div className="flex items-center gap-3"><User className="w-4 h-4 text-zinc-500 group-hover:text-emerald-400" /><span className="text-white font-bold text-xs truncate max-w-[100px]">{player.player_name}</span></div>
                            <span className="text-yellow-400 font-black text-sm">+{Math.floor(player.odds * 100)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <div className="p-4 bg-black/20 flex items-center gap-2 justify-end">
                        <span className="text-zinc-400 text-[10px] font-black uppercase truncate">{match.teams.away.name}</span>
                        <img src={match.teams.away.logo} className="w-5 h-5 object-contain" alt="" />
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
                        {rightScorers.map((player) => (
                          <button key={player.player_name} onClick={() => handleOutcomeClick(`SCORE_${player.player_name}`, player.odds, player.player_name)} className="w-full flex justify-between items-center p-3 bg-white/5 rounded-xl hover:bg-emerald-500/20 border border-transparent hover:border-emerald-500/50 group transition-all">
                            <div className="flex items-center gap-3"><User className="w-4 h-4 text-zinc-500 group-hover:text-emerald-400" /><span className="text-white font-bold text-xs truncate max-w-[100px]">{player.player_name}</span></div>
                            <span className="text-yellow-400 font-black text-sm">+{Math.floor(player.odds * 100)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
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