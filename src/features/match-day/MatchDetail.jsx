import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Loader2, Trophy, Signal, Goal, User, ArrowUpCircle } from 'lucide-react';
import { useGame } from '../../shared/context/GameContext';
import CardBase from '../../shared/ui/CardBase';

const MatchDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userProfile, loading: gameLoading, placeBet, consumeCard, loadProfile, supabase } = useGame();

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

  const getCardCount = (cardId) => userProfile?.inventory?.filter(item => item === cardId).length || 0;

  // --- ODDS PARSING LOGIC ---
  const processOdds = (data, isLive) => {
    let markets = [];
    let bookmakerName = isLive ? "LIVE" : "Official Odds";

    if (isLive) {
      markets = data.response?.[0]?.odds || [];
    } else {
      const bookmakers = data.response?.[0]?.bookmakers || [];

      // YOUR PRIORITIZED LIST: Bet365, William Hill, Unibet, William Hill
      const priorityIds = [6, 10, 16, 7];

      // Find the first bookie in the list that exists in the response
      let targetBookmaker = null;
      for (const id of priorityIds) {
        targetBookmaker = bookmakers.find(b => b.id === id);
        if (targetBookmaker) break;
      }

      // Fallback: If none of your priority bookies are found, take the first available one
      if (!targetBookmaker && bookmakers.length > 0) {
        targetBookmaker = bookmakers[0];
      }

      if (targetBookmaker) {
        markets = targetBookmaker.bets;
        bookmakerName = targetBookmaker.name;
      }
    }

    if (!markets || markets.length === 0) return null;

    // Helper: find market by loose name matching (handles "Match Winner" vs "1x2")
    const findMarket = (nameKey) => markets.find(m => m.name.toLowerCase().includes(nameKey.toLowerCase()));

    const matchWinner = findMarket("Match Winner") || findMarket("1x2");
    const goalsOverUnder = findMarket("Goals Over/Under");
    const goalscorers = findMarket("Anytime Goalscorer") || findMarket("Goalscorers");

    // Helper: Safely extract odds
    const getOdd = (market, selectionName) => {
      if (!market) return null;
      return market.values.find(v => v.value.toString().toLowerCase() === selectionName.toLowerCase())?.odd;
    };

    return {
      bookmaker: { name: bookmakerName },
      odds: {
        home: getOdd(matchWinner, "Home") || 2.10,
        draw: getOdd(matchWinner, "Draw") || 3.20,
        away: getOdd(matchWinner, "Away") || 2.90,

        // Robust handling for Over/Under strings (e.g. "Over 2.5" vs "2.5")
        goals_over: goalsOverUnder?.values.find(v => {
          const val = v.value.toString();
          return val.includes("Over") && val.includes("2.5");
        })?.odd || 1.85,

        goals_under: goalsOverUnder?.values.find(v => {
          const val = v.value.toString();
          return val.includes("Under") && val.includes("2.5");
        })?.odd || 1.95,

        supersub_yes: 4.50, // Usually calculated, keeping fixed for MVP

        scorers: goalscorers ? goalscorers.values.map((p, i) => ({
          id: i,
          name: p.value,
          odds: p.odd
        })).slice(0, 15) : []
      }
    };
  };

  useEffect(() => {
    if (!id) return;
    const fetchMatchDetail = async () => {
      try {
        setLoading(true);
        const timestamp = Date.now();
        // Fetch Match Info
        const matchRes = await fetch(`/api/matches?id=${id}&t=${timestamp}`);
        const matchData = await matchRes.json();
        if (!matchData.response?.length) throw new Error("Match unavailable");

        const matchInfo = matchData.response[0];
        setMatch(matchInfo);

        const status = matchInfo.fixture.status.short;
        const phase = ['1H', 'HT', '2H', 'ET', 'P', 'LIVE'].includes(status) ? 'LIVE' : (['FT', 'AET', 'PEN'].includes(status) ? 'POST' : 'PRE');
        setMatchPhase(phase);

        if (phase !== 'POST') {
          // FIX: Removed "&bookmaker=6" to get ALL providers so we can pick the best one locally
          const endpoint = phase === 'LIVE'
            ? `/api/odds/live?fixture=${id}&t=${timestamp}`
            : `/api/odds?fixture=${id}&t=${timestamp}`;

          const oddsRes = await fetch(endpoint);
          const oddsData = await oddsRes.json();

          const processed = processOdds(oddsData, phase === 'LIVE');
          if (processed && processed.odds) {
            setOdds(processed.odds);
            setActiveBookie(processed.bookmaker.name);
          } else {
            console.warn("No odds found from any bookmaker. Falling back to simulation.");
            setOdds({ home: 2.1, draw: 3.2, away: 2.8, goals_over: 1.85, goals_under: 1.95, supersub_yes: 4.5, scorers: [] });
            setActiveBookie("SIMULATION");
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMatchDetail();
  }, [id]);

  const handleOutcomeClick = (selection, oddsVal) => {
    setStagedBet({
      card: selectedCard,
      selection,
      odds: oddsVal,
      reward: Math.floor(oddsVal * 100)
    });
    setFlowState('staging');
  };

  const handlePlay = async () => {
    if (!userProfile || !stagedBet) return;
    const result = await placeBet(match, stagedBet.selection, stagedBet.reward, stagedBet.card, stagedBet.odds);
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

  if (gameLoading || !userProfile) return <div className="bg-black h-[100dvh] flex items-center justify-center"><Loader2 className="animate-spin text-yellow-500 w-8 h-8" /></div>;

  return (
    <div className="h-[100dvh] w-full relative overflow-hidden flex flex-col justify-between font-sans select-none">
      <div className="absolute inset-0 z-0">
        <img src="/bg-tunnel.webp" className="absolute inset-0 w-full h-full object-cover" alt="Tunnel" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
      </div>

      {/* HEADER */}
      <div className="absolute top-0 left-0 w-full px-4 pt-8 pb-4 flex justify-between items-center z-[60]">
        <button onClick={() => navigate('/match-hub')} className="flex items-center justify-center w-10 h-10 bg-black/50 backdrop-blur-md border border-white/20 rounded-full text-white active:scale-95 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
            <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span className="text-white font-bold text-sm">{userProfile.energy}/{userProfile.max_energy}</span>
          </div>
          {activeBookie && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/40 border border-white/5 backdrop-blur-sm">
              <Signal className={`w-3 h-3 ${activeBookie === 'SIMULATION' ? 'text-orange-500' : 'text-green-500'} animate-pulse`} />
              <span className="text-[9px] font-mono uppercase tracking-widest text-white/60">{activeBookie}</span>
            </div>
          )}
        </div>
      </div>

      {/* SCOREBOARD */}
      {match && (
        <div className="absolute top-16 w-full z-40 px-2">
          <div data-testid="trapezoid-hud" className="relative w-full max-w-lg mx-auto h-14 flex items-center justify-center drop-shadow-2xl mt-3">
            <div className="flex-1 h-9 bg-gradient-to-b from-gray-200 via-gray-100 to-gray-400 rounded-l-md border-b-4 border-[#2d241e] flex items-center justify-start pl-3 relative shadow-lg mr-[-8px]">
              <img src={match.teams.home.logo} className="w-5 h-5 object-contain z-10 drop-shadow-md" alt="Home" />
              <span className="ml-2 text-black/90 font-black text-[10px] md:text-xs uppercase tracking-tight truncate z-10 leading-none">{match.teams.home.name}</span>
            </div>
            <div className="relative z-20 w-28 h-14 bg-zinc-950 border-x border-zinc-700 border-b-4 border-[#2d241e] rounded-b-lg shadow-2xl flex flex-col items-center justify-center pt-0.5 pb-1">
              <div className="absolute top-0 w-full h-[1px] bg-zinc-600"></div>
              <span className="text-lg md:text-xl text-white font-black tracking-widest leading-none font-mono drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                {match.fixture.status.short === 'NS' ? new Date(match.fixture.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `${match.goals.home}-${match.goals.away}`}
              </span>
            </div>
            <div className="flex-1 h-9 bg-gradient-to-b from-gray-200 via-gray-100 to-gray-400 rounded-r-md border-b-4 border-[#2d241e] flex items-center justify-end pr-3 relative shadow-lg ml-[-8px]">
              <span className="mr-2 text-black/90 font-black text-[10px] md:text-xs uppercase tracking-tight truncate text-right z-10 leading-none">{match.teams.away.name}</span>
              <img src={match.teams.away.logo} className="w-5 h-5 object-contain z-10 drop-shadow-md" alt="Away" />
            </div>
          </div>
        </div>
      )}

      {matchPhase !== 'POST' && (
        <>
          <div className="flex-1"></div>
          {/* CARD SHELF */}
          <div className="fixed bottom-0 w-full z-50 h-64 pointer-events-none">
            <div className="absolute bottom-0 w-full h-32 bg-cover bg-bottom z-10" style={{ backgroundImage: 'url(/shelf-console.webp)' }}></div>
            <div data-testid="card-shelf" className="absolute inset-0 flex justify-center items-end gap-3 pb-14 px-4 overflow-x-auto no-scrollbar z-20 pointer-events-auto">
              {cardTypes.map(card => {
                const count = getCardCount(card.id);
                return (
                  <button
                    key={card.id}
                    data-testid={`card-${card.id}`}
                    onClick={() => { if (count > 0) { setSelectedCard(card.id); setFlowState('selection'); } }}
                    disabled={count === 0}
                    className={`relative transition-all duration-300 flex-shrink-0 ${selectedCard === card.id ? 'translate-y-[-24px] ring-2 ring-yellow-400 shadow-xl z-30' : count > 0 ? 'hover:translate-y-[-8px] z-20' : 'opacity-40 grayscale z-10'}`}
                  >
                    <div className="w-20 h-32 relative">
                      <div className="absolute inset-0 bg-[url('/frame-standard.webp')] bg-cover bg-center rounded-lg shadow-lg"></div>
                      <div className="absolute inset-0 flex items-center justify-center p-2 z-10">
                        <CardBase type={card.id} label={card.label} status="generic" variant="transparent" />
                      </div>
                      {count > 0 && <div className="absolute -top-2 -right-2 bg-zinc-900 text-yellow-500 text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border border-yellow-500 shadow-lg z-50">x{count}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* SELECTION MODALS */}
      {flowState === 'selection' && match && odds && selectedCard && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">

          {/* 1. MATCH RESULT */}
          {selectedCard === 'c_match_result' && (
            <div className="grid grid-cols-3 gap-3 w-full max-w-lg mt-20 animate-in slide-in-from-bottom-8">
              <button data-testid="panel-home" onClick={() => handleOutcomeClick('HOME_WIN', odds.home)} className="backdrop-blur-md border border-white/10 bg-gradient-to-b from-blue-500/20 to-blue-900/40 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:scale-105 transition-transform">
                <img src={match.teams.home.logo} className="w-12 h-12 object-contain" alt="Home" />
                <h3 className="font-black text-white text-xs uppercase">WIN</h3>
                <p className="text-yellow-400 font-black text-2xl">+{Math.floor(odds.home * 100)}</p>
              </button>
              <button data-testid="panel-draw" onClick={() => handleOutcomeClick('DRAW', odds.draw)} className="backdrop-blur-md border border-white/10 bg-gradient-to-b from-zinc-500/20 to-zinc-900/40 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:scale-105 transition-transform">
                <Trophy className="w-10 h-10 text-zinc-400" />
                <h3 className="font-black text-white text-xs uppercase">DRAW</h3>
                <p className="text-yellow-400 font-black text-2xl">+{Math.floor(odds.draw * 100)}</p>
              </button>
              <button data-testid="panel-away" onClick={() => handleOutcomeClick('AWAY_WIN', odds.away)} className="backdrop-blur-md border border-white/10 bg-gradient-to-b from-red-500/20 to-red-900/40 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:scale-105 transition-transform">
                <img src={match.teams.away.logo} className="w-12 h-12 object-contain" alt="Away" />
                <h3 className="font-black text-white text-xs uppercase">WIN</h3>
                <p className="text-yellow-400 font-black text-2xl">+{Math.floor(odds.away * 100)}</p>
              </button>
            </div>
          )}

          {/* 2. TOTAL GOALS */}
          {selectedCard === 'c_total_goals' && (
            <div className="flex gap-4 w-full max-w-lg mt-20 animate-in slide-in-from-bottom-8">
              <button onClick={() => handleOutcomeClick('OVER_2.5', odds.goals_over)} className="flex-1 backdrop-blur-md border border-white/10 bg-zinc-800/80 rounded-xl p-6 flex flex-col items-center justify-center hover:bg-zinc-700 transition-colors">
                <ArrowUpCircle className="w-10 h-10 text-green-400 mb-2" />
                <div className="text-white font-bold">OVER 2.5</div>
                <div className="text-yellow-400 font-black text-2xl">+{Math.floor(odds.goals_over * 100)}</div>
              </button>
              <button onClick={() => handleOutcomeClick('UNDER_2.5', odds.goals_under)} className="flex-1 backdrop-blur-md border border-white/10 bg-zinc-800/80 rounded-xl p-6 flex flex-col items-center justify-center hover:bg-zinc-700 transition-colors">
                <Goal className="w-10 h-10 text-red-400 mb-2" />
                <div className="text-white font-bold">UNDER 2.5</div>
                <div className="text-yellow-400 font-black text-2xl">+{Math.floor(odds.goals_under * 100)}</div>
              </button>
            </div>
          )}

          {/* 3. PLAYER SCORE */}
          {selectedCard === 'c_player_score' && (
            <div className="w-full max-w-lg mt-20 bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-xl p-4 max-h-[60vh] overflow-y-auto animate-in slide-in-from-bottom-8">
              <h3 className="text-white font-bold mb-4 sticky top-0 bg-zinc-900 pb-2 border-b border-white/10">Select Scorer (Anytime)</h3>
              <div className="grid grid-cols-1 gap-2">
                {odds.scorers && odds.scorers.length > 0 ? odds.scorers.map((player) => (
                  <button key={player.id} onClick={() => handleOutcomeClick(`SCORE_${player.id}`, player.odds)} className="flex justify-between items-center p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors text-left">
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-zinc-400" />
                      <span className="text-white font-medium">{player.name}</span>
                    </div>
                    <span className="text-yellow-400 font-bold">+{Math.floor(player.odds * 100)}</span>
                  </button>
                )) : (
                  <div className="text-center text-white/50 py-4">No scorer odds available</div>
                )}
              </div>
            </div>
          )}

          {/* 4. SUPER SUB */}
          {selectedCard === 'c_supersub' && (
            <div className="w-full max-w-sm mt-20 animate-in zoom-in-95">
              <button onClick={() => handleOutcomeClick('SUPERSUB_YES', odds.supersub_yes)} className="w-full backdrop-blur-md border border-yellow-500/50 bg-gradient-to-br from-yellow-900/80 to-black rounded-xl p-8 flex flex-col items-center justify-center gap-4 hover:scale-105 transition-transform shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                <Zap className="w-16 h-16 text-yellow-400 animate-pulse" />
                <div className="text-center">
                  <div className="text-white font-black text-2xl uppercase">Activate Super Sub</div>
                  <div className="text-white/60 text-sm mt-1">Substitute scores anytime</div>
                </div>
                <div className="bg-yellow-500 text-black font-black px-6 py-2 rounded-full text-xl">
                  +{Math.floor(odds.supersub_yes * 100)} PTS
                </div>
              </button>
            </div>
          )}

          {/* Close Overlay */}
          <div className="absolute inset-0 -z-10" onClick={handleReset}></div>
        </div>
      )}

      {/* CONFIRMATION / STAGING BAR */}
      {flowState === 'staging' && stagedBet && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div data-testid="staging-bar" className="w-full max-w-md bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-end mb-6">
              <div>
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-1">SELECTED OUTCOME</p>
                <p className="text-white font-black text-2xl uppercase italic">{stagedBet.selection.replace(/_/g, ' ')}</p>
              </div>
              <div className="text-right">
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-1">REWARD</p>
                <p className="text-yellow-400 font-black text-3xl">{stagedBet.reward} PTS</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleReset} className="flex-1 py-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold uppercase text-zinc-400 text-xs transition-colors">Cancel</button>
              <button data-testid="play-button" onClick={handlePlay} className="flex-[2] py-4 bg-green-500 hover:bg-green-400 rounded-xl font-black uppercase text-black text-lg transition-colors shadow-lg shadow-green-500/20">CONFIRM PLAY</button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL */}
      {flowState === 'resolved' && (
        <div className="fixed inset-0 z-[80] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in duration-300">
          <div className="text-center w-full max-w-sm border border-white/10 bg-zinc-900/50 p-8 rounded-3xl relative overflow-hidden">
            <h2 className="font-black uppercase text-white text-3xl mb-2 tracking-tighter">Locked In!</h2>
            <button onClick={() => navigate('/dashboard')} className="w-full py-4 bg-white text-black font-black uppercase rounded-xl hover:scale-105 transition-transform shadow-xl">Continue</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchDetail;