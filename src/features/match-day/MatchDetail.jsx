import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Loader2, Trophy, Signal, Goal, User, ArrowUpCircle, X } from 'lucide-react';
import { useGame } from '../../shared/context/GameContext';
import CardBase from '../../shared/ui/CardBase';
import { getHybridOdds } from '../../shared/services/oddsService';
import TacticalHUD from '../../shared/ui/TacticalHUD';
import MatchTerminationTerminal from '../../shared/ui/MatchTerminationTerminal';
import MatchLineup from './MatchLineup';

const ODDS_API_KEY = import.meta.env.VITE_ODDS_API_KEY;

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

        const matchInfo = data.response[0];
        setMatch(matchInfo);

        const status = matchInfo.fixture.status.short;
        const phase = ['1H', 'HT', '2H', 'ET', 'P', 'LIVE'].includes(status) ? 'LIVE' : (['FT', 'AET', 'PEN'].includes(status) ? 'POST' : 'PRE');
        setMatchPhase(phase);

        if (phase !== 'POST') {
          const oddsData = await getHybridOdds(matchInfo, ODDS_API_KEY);

          if (oddsData && oddsData.odds) {
            let finalOdds = oddsData.odds;

            // FALLBACK: If API returns odds but NO scorers (common in pre-match), generate them
            // This prevents the "Empty List" issue
            if (!finalOdds.scorers || finalOdds.scorers.length === 0) {
              const homeName = matchInfo.teams.home.name.substring(0, 3).toUpperCase();
              const awayName = matchInfo.teams.away.name.substring(0, 3).toUpperCase();

              finalOdds.scorers = [
                { id: 'sim1', name: `${homeName} Striker`, odds: 2.10 },
                { id: 'sim2', name: `${awayName} Forward`, odds: 2.40 },
                { id: 'sim3', name: `${homeName} Winger`, odds: 3.10 },
                { id: 'sim4', name: `${awayName} Midfielder`, odds: 3.50 },
                { id: 'sim5', name: `${homeName} Captain`, odds: 2.80 },
                { id: 'sim6', name: `${awayName} Star`, odds: 2.20 },
              ];
            }

            setOdds(finalOdds);
            setActiveBookie(oddsData.source);
          } else {
            // Full Simulation fallback if API fails completely
            setOdds({
              home: 2.10, draw: 3.20, away: 2.80,
              goals_over: 1.85, goals_under: 1.95,
              supersub_yes: 4.50,
              scorers: [
                { id: 's1', name: 'Home Star', odds: 1.90 },
                { id: 's2', name: 'Away Star', odds: 2.20 },
                { id: 's3', name: 'Home Striker', odds: 2.50 },
                { id: 's4', name: 'Away Striker', odds: 3.00 }
              ]
            });
            setActiveBookie("SIMULATION");
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
    const result = await placeBet(match, stagedBet.selection, stagedBet.reward, stagedBet.card, stagedBet.odds, stagedBet.displayLabel);
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

  // Helper to split players evenly between Home and Away columns for the UI
  const getScorerColumns = () => {
    if (!odds?.scorers) return [[], []];
    const midpoint = Math.ceil(odds.scorers.length / 2);
    const leftCol = odds.scorers.slice(0, midpoint);
    const rightCol = odds.scorers.slice(midpoint);
    return [leftCol, rightCol];
  };

  if (gameLoading || !userProfile) return <div className="bg-black h-[100dvh] flex items-center justify-center"><Loader2 className="animate-spin text-yellow-500 w-8 h-8" /></div>;

  const [leftScorers, rightScorers] = getScorerColumns();

  return (
    <div className="h-[100dvh] w-full relative overflow-hidden flex flex-col justify-between font-sans select-none">
      {/* Dynamic Background with Cross-Fade */}
      <div className="absolute inset-0 z-0">
        {/* LIVE State Background */}
        <img
          src="/assets/bg-tunnel-live.webp"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${matchPhase === 'LIVE' ? 'opacity-100' : 'opacity-0'
            }`}
          alt="Live Match Tunnel"
        />

        {/* PRE-MATCH / FINISHED State Background */}
        <img
          src="/assets/bg-tunnel-prepost.webp"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${matchPhase === 'PRE' || matchPhase === 'POST' ? 'opacity-100' : 'opacity-0'
            }`}
          alt="Pre/Post Match Tunnel"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
      </div>

      {/* Top Header */}
      <div className="absolute top-0 left-0 w-full px-4 pt-8 pb-4 flex justify-between items-center z-[60]">
        <button onClick={() => navigate('/match-hub')} className="w-10 h-10 bg-black/50 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center text-white"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex flex-col items-end gap-1">
          <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span className="text-white font-bold text-sm">{userProfile.energy}/{userProfile.max_energy}</span>
          </div>
          {activeBookie && (
            <div className="px-2 py-0.5 rounded-full bg-black/40 border border-white/5 flex items-center gap-1.5">
              <Signal className={`w-3 h-3 ${activeBookie === 'SIMULATION' ? 'text-orange-500' : 'text-green-500'} animate-pulse`} />
              <span className="text-[9px] font-mono uppercase text-white/60">{activeBookie}</span>
            </div>
          )}
        </div>
      </div>

      {/* Scoreboard - Strict Flex Model (Mobile Optimized) */}
      {match && (
        <div className="absolute top-16 w-full z-40">
          <div className="w-full h-16 flex items-center justify-between px-3 bg-black/80 backdrop-blur-md border-b border-white/10 relative">

            {/* Left Block - Home (flex-1 with shrink-0 logo, flexible name) */}
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

            {/* Center Block - Anchor (Fixed/Shrinkwrapped) */}
            <div className="w-auto flex-shrink-0 mx-2 flex flex-col items-center justify-center z-10">
              {/* Top: Status/Date */}
              <span className={`text-[9px] font-bold tracking-widest uppercase mb-[2px] leading-none ${['1H', '2H', 'HT', 'ET', 'P'].includes(match.fixture.status.short)
                ? 'text-[#39ff14]'
                : 'text-zinc-400'
                }`}>
                {match.fixture.status.short === 'NS'
                  ? new Date(match.fixture.date).toLocaleDateString([], { month: 'short', day: 'numeric' }).toUpperCase()
                  : match.fixture.status.short
                }
              </span>
              {/* Bottom: Score */}
              <div className="text-lg font-black text-white font-mono leading-none">
                {match.goals.home} - {match.goals.away}
              </div>
            </div>

            {/* Right Block - Away (flex-1 with flexible name, shrink-0 logo) */}
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

      {/* ── SCROLLABLE LINEUP SECTION ── */}
      {match && (matchPhase === 'PRE' || matchPhase === 'LIVE') && (
        <div
          className="absolute z-30 w-full overflow-y-auto scrollbar-hide"
          style={{
            top: '132px',        /* below scoreboard */
            bottom: '256px',     /* above shelf console */
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div className="pt-4 pb-4">
            <MatchLineup
              fixtureId={id}
              matchPhase={matchPhase}
              fixtureDate={match.fixture?.date}
            />
          </div>
        </div>
      )}

      {/* Card Selection Shelf - Active States Only (PRE-MATCH / LIVE) */}
      {(matchPhase === 'PRE' || matchPhase === 'LIVE') && (
        <div className="fixed bottom-0 w-full z-50 h-64 pointer-events-none">
          <div className="absolute bottom-0 w-full h-32 bg-[url('/shelf-console.webp')] bg-cover bg-bottom z-10"></div>
          <div className="absolute inset-0 flex justify-center items-end gap-3 pb-14 px-4 pointer-events-auto">
            {cardTypes.map(card => {
              const count = getCardCount(card.id);
              return (
                <button
                  key={card.id}
                  onClick={() => { if (count > 0) { setSelectedCard(card.id); setFlowState('selection'); } }}
                  disabled={count === 0}
                  className={`relative transition-all duration-300 ${selectedCard === card.id ? 'translate-y-[-24px] ring-2 ring-yellow-400 shadow-xl' : count > 0 ? 'hover:translate-y-[-8px]' : 'opacity-40 grayscale'}`}
                >
                  <div className="w-[5.5rem] h-[8.25rem] relative">
                    {/* CardBase already renders frame-standard.webp internally, no need for duplicate */}
                    <div className="absolute inset-0 flex items-center justify-center z-10"><CardBase type={card.id} label={card.label} status="generic" variant="transparent" /></div>
                    {count > 0 && <div className="absolute -top-2 -right-2 bg-zinc-900 text-yellow-500 text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border border-yellow-500 shadow-lg z-50">x{count}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Match Termination Terminal - Terminated State (FINISHED) */}
      {matchPhase === 'POST' && <MatchTerminationTerminal />}

      {/* SELECTION POPUPS - Block on Finished Matches */}
      {flowState === 'selection' && match && odds && selectedCard && matchPhase !== 'POST' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <button onClick={handleReset} className="absolute top-8 right-8 text-white/50 hover:text-white"><X className="w-8 h-8" /></button>

          {/* Match Result UI */}
          {selectedCard === 'c_match_result' && (
            <div className="grid grid-cols-3 gap-4 w-full max-w-lg">
              <button onClick={() => handleOutcomeClick('HOME_WIN', odds.home, match.teams.home.name)} className="bg-zinc-900/80 border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-4 hover:bg-zinc-800 transition-all">
                <img src={match.teams.home.logo} className="w-16 h-16 object-contain" alt="Home" />
                <span className="text-yellow-400 font-black text-2xl">+{Math.floor(odds.home * 100)}</span>
                <span className="text-white/40 text-[10px] uppercase font-bold tracking-widest">Home Win</span>
              </button>
              <button onClick={() => handleOutcomeClick('DRAW', odds.draw, 'Draw Result')} className="bg-zinc-900/80 border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-4 hover:bg-zinc-800 transition-all">
                <Trophy className="w-16 h-16 text-zinc-600" />
                <span className="text-yellow-400 font-black text-2xl">+{Math.floor(odds.draw * 100)}</span>
                <span className="text-white/40 text-[10px] uppercase font-bold tracking-widest">Draw</span>
              </button>
              <button onClick={() => handleOutcomeClick('AWAY_WIN', odds.away, match.teams.away.name)} className="bg-zinc-900/80 border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-4 hover:bg-zinc-800 transition-all">
                <img src={match.teams.away.logo} className="w-16 h-16 object-contain" alt="Away" />
                <span className="text-yellow-400 font-black text-2xl">+{Math.floor(odds.away * 100)}</span>
                <span className="text-white/40 text-[10px] uppercase font-bold tracking-widest">Away Win</span>
              </button>
            </div>
          )}

          {/* Total Goals UI */}
          {selectedCard === 'c_total_goals' && (
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
          )}

          {/* Player Score UI - Dual Column */}
          {selectedCard === 'c_player_score' && (
            <div className="w-full max-w-4xl bg-zinc-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8">
              <div className="bg-zinc-800/50 p-6 border-b border-white/5 flex justify-between items-center">
                <h3 className="text-white font-black uppercase tracking-tighter text-xl">Select Scorer</h3>
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-1 rounded font-bold uppercase tracking-widest">Anytime Market</span>
              </div>
              <div className="grid grid-cols-2 h-[60vh]">
                {/* Home Column */}
                <div className="border-r border-white/5 flex flex-col">
                  <div className="p-4 bg-black/20 flex items-center gap-2">
                    <img src={match.teams.home.logo} className="w-5 h-5 object-contain" alt="" />
                    <span className="text-zinc-400 text-[10px] font-black uppercase truncate">{match.teams.home.name}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
                    {leftScorers.map((player) => (
                      <button key={player.id} onClick={() => handleOutcomeClick(`SCORE_${player.id}`, player.odds, player.name)} className="w-full flex justify-between items-center p-3 bg-white/5 rounded-xl hover:bg-emerald-500/20 border border-transparent hover:border-emerald-500/50 group transition-all">
                        <div className="flex items-center gap-3"><User className="w-4 h-4 text-zinc-500 group-hover:text-emerald-400" /><span className="text-white font-bold text-xs truncate max-w-[100px]">{player.name}</span></div>
                        <span className="text-yellow-400 font-black text-sm">+{Math.floor(player.odds * 100)}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {/* Away Column */}
                <div className="flex flex-col">
                  <div className="p-4 bg-black/20 flex items-center gap-2 justify-end">
                    <span className="text-zinc-400 text-[10px] font-black uppercase truncate">{match.teams.away.name}</span>
                    <img src={match.teams.away.logo} className="w-5 h-5 object-contain" alt="" />
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
                    {rightScorers.map((player) => (
                      <button key={player.id} onClick={() => handleOutcomeClick(`SCORE_${player.id}`, player.odds, player.name)} className="w-full flex justify-between items-center p-3 bg-white/5 rounded-xl hover:bg-emerald-500/20 border border-transparent hover:border-emerald-500/50 group transition-all">
                        <div className="flex items-center gap-3"><User className="w-4 h-4 text-zinc-500 group-hover:text-emerald-400" /><span className="text-white font-bold text-xs truncate max-w-[100px]">{player.name}</span></div>
                        <span className="text-yellow-400 font-black text-sm">+{Math.floor(player.odds * 100)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Super Sub UI */}
          {selectedCard === 'c_supersub' && (
            <div className="w-full max-w-sm">
              <button onClick={() => handleOutcomeClick('SUPERSUB_YES', odds.supersub_yes, 'Super Sub')} className="w-full bg-gradient-to-br from-yellow-600/20 to-black border border-yellow-500/50 rounded-3xl p-10 flex flex-col items-center gap-6 hover:scale-105 transition-transform">
                <div className="relative"><Zap className="w-20 h-20 text-yellow-400 fill-yellow-400" /><div className="absolute inset-0 bg-yellow-400 blur-2xl opacity-20 animate-pulse"></div></div>
                <div className="text-center"><h3 className="text-white font-black text-3xl uppercase tracking-tighter">Super Sub</h3><p className="text-white/60 text-xs mt-2 uppercase tracking-widest">Any Substitute to Score</p></div>
                <div className="bg-yellow-500 text-black font-black px-8 py-3 rounded-full text-2xl shadow-[0_0_20px_rgba(234,179,8,0.4)]">+{Math.floor(odds.supersub_yes * 100)} PTS</div>
              </button>
            </div>
          )}
        </div>
      )}

      {/* STAGING PANEL - Block on Finished Matches */}
      {flowState === 'staging' && stagedBet && matchPhase !== 'POST' && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl">
            <div className="flex justify-between items-start mb-8">
              <div className="space-y-1"><p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Outcome Selection</p><h3 className="text-white font-black text-3xl uppercase italic tracking-tighter leading-tight">{stagedBet.displayLabel}</h3></div>
              <div className="text-right space-y-1"><p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Reward</p><p className="text-yellow-400 font-black text-4xl tracking-tighter">{stagedBet.reward} <span className="text-xs uppercase">pts</span></p></div>
            </div>
            <div className="flex gap-4">
              <button onClick={handleReset} className="flex-1 py-4 bg-zinc-800 rounded-2xl font-bold uppercase text-zinc-400 text-xs tracking-widest hover:bg-zinc-700 transition-colors">Cancel</button>
              <button onClick={handlePlay} className="flex-[2] py-4 bg-emerald-500 rounded-2xl font-black uppercase text-black text-xl shadow-[0_10px_30px_rgba(16,185,129,0.3)] hover:scale-105 transition-all">Confirm Play</button>
            </div>
          </div>
        </div>
      )}

      {/* RESOLUTION MODAL */}
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