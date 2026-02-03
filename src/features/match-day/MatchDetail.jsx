import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Loader2, Trophy, CheckCircle, Goal, User, ArrowUpCircle, Signal } from 'lucide-react';
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

  // STATE MACHINE
  const [flowState, setFlowState] = useState('idle');
  const [selectedCard, setSelectedCard] = useState(null);
  const [stagedBet, setStagedBet] = useState(null);

  const cardTypes = [
    { id: 'c_match_result', label: 'Match Result' },
    { id: 'c_total_goals', label: 'Total Goals' },
    { id: 'c_player_score', label: 'Player Score' },
    { id: 'c_supersub', label: 'Super Sub' }
  ];

  const getCardCount = (cardId) => {
    if (!userProfile?.inventory || !Array.isArray(userProfile.inventory)) return 0;
    return userProfile.inventory.filter(item => item === cardId).length;
  };

  const getMatchPhase = (status) => {
    const PRE_MATCH = ['NS', 'TBD', 'PST', 'CANC', 'ABD'];
    const LIVE = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'];
    const POST_MATCH = ['FT', 'AET', 'PEN'];

    if (PRE_MATCH.includes(status)) return 'PRE';
    if (LIVE.includes(status)) return 'LIVE';
    if (POST_MATCH.includes(status)) return 'POST';
    return 'PRE';
  };

  const processOdds = (data, isLive) => {
    let markets = [];
    let bookmakerId = null;
    let bookmakerName = null;

    if (isLive) {
      markets = data.response?.[0]?.odds || [];
      bookmakerName = "LIVE";
    } else {
      const bookmakers = data.response?.[0]?.bookmakers || [];
      const priorityIds = [6, 10, 16, 7];
      let targetBookmaker = null;

      for (const id of priorityIds) {
        targetBookmaker = bookmakers.find(b => b.id === id);
        if (targetBookmaker) break;
      }
      if (!targetBookmaker) targetBookmaker = bookmakers[0];

      if (targetBookmaker) {
        markets = targetBookmaker.bets || [];
        bookmakerId = targetBookmaker.id;
        bookmakerName = targetBookmaker.name;
      }
    }

    if (markets.length === 0) return null;

    const getMarketValues = (marketName) => {
      const market = markets.find(m => m.name.toLowerCase() === marketName.toLowerCase()) ||
        markets.find(m => m.name.toLowerCase().includes(marketName.toLowerCase()));
      return market ? market.values : [];
    };

    const matchWinner = getMarketValues("Match Winner");
    const goalsOverUnder = getMarketValues("Goals Over/Under");
    const goalscorers = getMarketValues("Goalscorers") || getMarketValues("Anytime Goalscorer");

    return {
      bookmaker: { id: bookmakerId, name: bookmakerName },
      odds: {
        home: matchWinner.find(o => o.value === "Home")?.odd || 2.10,
        draw: matchWinner.find(o => o.value === "Draw")?.odd || 3.20,
        away: matchWinner.find(o => o.value === "Away")?.odd || 2.90,
        goals_over: goalsOverUnder.find(o => o.value === "Over 2.5")?.odd || 1.85,
        goals_under: goalsOverUnder.find(o => o.value === "Under 2.5")?.odd || 1.95,
        supersub_yes: 4.50,
        scorers: goalscorers.length > 0
          ? goalscorers.map((p, index) => ({ id: index, name: p.value, odds: p.odd })).slice(0, 20)
          : [
            { id: 1, name: "Home Striker", odds: 2.2 },
            { id: 2, name: "Away Striker", odds: 2.8 },
            { id: 3, name: "Midfield Star", odds: 3.5 }
          ]
      }
    };
  };

  const getSimulationOdds = () => ({
    bookmaker: { id: 9999, name: "SIMULATION" },
    odds: {
      home: 2.10,
      draw: 3.40,
      away: 3.10,
      goals_over: 1.85,
      goals_under: 1.95,
      supersub_yes: 4.50,
      scorers: [
        { id: 1, name: "Haaland", odds: 1.80 },
        { id: 2, name: "Salah", odds: 2.30 },
        { id: 3, name: "Saka", odds: 2.60 },
        { id: 4, name: "Rashford", odds: 2.80 },
        { id: 5, name: "Isak", odds: 3.00 }
      ]
    }
  });

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    const fetchMatchDetail = async () => {
      try {
        setLoading(true);
        const timestamp = Date.now();
        const matchRes = await fetch(`/api/matches?id=${id}&t=${timestamp}`);
        if (!matchRes.ok) throw new Error("Match unavailable");

        const matchData = await matchRes.json();
        if (!matchData.response || matchData.response.length === 0) throw new Error("No match data found");

        const matchInfo = matchData.response[0];
        setMatch(matchInfo);

        const status = matchInfo.fixture.status.short;
        const phase = getMatchPhase(status);
        setMatchPhase(phase);

        if (phase === 'POST') {
          setOdds(null);
          setActiveBookie(null);
        } else {
          const endpoint = phase === 'LIVE'
            ? `/api/odds/live?fixture=${id}&t=${timestamp}`
            : `/api/odds?fixture=${id}&bookmaker=6&t=${timestamp}`;

          const oddsRes = await fetch(endpoint);
          const oddsData = await oddsRes.json();

          if (oddsData.odds && typeof oddsData.odds === 'object') {
            setOdds({
              home: oddsData.odds.home,
              draw: oddsData.odds.draw,
              away: oddsData.odds.away,
              goals_over: 1.85,
              goals_under: 1.95,
              supersub_yes: 4.50,
              scorers: [
                { id: 1, name: "Home Striker", odds: 2.2 },
                { id: 2, name: "Away Striker", odds: 2.8 }
              ]
            });
            setActiveBookie(oddsData.source || 'Official Odds');
          } else if (oddsData.response && Array.isArray(oddsData.response)) {
            const processed = processOdds(oddsData, phase === 'LIVE');
            if (processed) {
              setOdds(processed.odds);
              setActiveBookie(processed.bookmaker.name);
            } else {
              const simulation = getSimulationOdds();
              setOdds(simulation.odds);
              setActiveBookie(simulation.bookmaker.name);
            }
          } else {
            const simulation = getSimulationOdds();
            setOdds(simulation.odds);
            setActiveBookie(simulation.bookmaker.name);
          }
        }
      } catch (err) {
        const simulation = getSimulationOdds();
        setOdds(simulation.odds);
        setActiveBookie(simulation.bookmaker.name);
      } finally {
        setLoading(false);
      }
    };
    fetchMatchDetail();
  }, [id]);

  const handleCardClick = (cardId) => {
    const count = getCardCount(cardId);
    if (count === 0) return;
    setSelectedCard(cardId);
    setFlowState('selection');
  };

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
    try {
      const result = await placeBet(
        match,
        stagedBet.selection,
        stagedBet.reward,
        stagedBet.card,
        stagedBet.odds
      );
      if (!result.success) throw new Error(result.error || "Failed to place bet");
      await consumeCard(stagedBet.card);
      const session = await supabase.auth.getSession();
      if (session?.data?.session) loadProfile(session.data.session);
      setFlowState('resolved');
    } catch (err) {
      alert("System Error: " + (err.message || "Could not place bet"));
    }
  };

  const handleReset = () => {
    setSelectedCard(null);
    setStagedBet(null);
    setFlowState('idle');
  };

  const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase();

  if (gameLoading || !userProfile) {
    return <div className="bg-black h-[100dvh] flex items-center justify-center"><Loader2 className="animate-spin text-yellow-500 w-8 h-8" /></div>;
  }

  return (
    <div className="h-[100dvh] w-full relative overflow-hidden flex flex-col justify-between font-sans select-none">
      <div className="absolute inset-0 z-0">
        <img src="/bg-tunnel.webp" className="absolute inset-0 w-full h-full object-cover" alt="Tunnel" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
      </div>

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
              <span className={`text-[9px] font-mono uppercase tracking-widest ${activeBookie === 'SIMULATION' ? 'text-orange-400' : 'text-white/60'}`}>
                {activeBookie}
              </span>
            </div>
          )}
        </div>
      </div>

      {match && (
        <div className="absolute top-16 w-full z-40 px-2">
          <div data-testid="trapezoid-hud" className="relative w-full max-w-lg mx-auto h-14 flex items-center justify-center drop-shadow-2xl mt-3">
            <div className="flex-1 h-9 bg-gradient-to-b from-gray-200 via-gray-100 to-gray-400 rounded-l-md border-b-4 border-[#2d241e] flex items-center justify-start pl-3 relative shadow-lg mr-[-8px]">
              <img src={match.teams.home.logo} className="w-5 h-5 object-contain z-10 drop-shadow-md" alt="Home" />
              <span className="ml-2 text-black/90 font-black text-[10px] md:text-xs uppercase tracking-tight truncate z-10 leading-none">{match.teams.home.name}</span>
            </div>
            <div className="relative z-20 w-28 h-14 bg-zinc-950 border-x border-zinc-700 border-b-4 border-[#2d241e] rounded-b-lg shadow-2xl flex flex-col items-center justify-center pt-0.5 pb-1">
              <div className="absolute top-0 w-full h-[1px] bg-zinc-600"></div>
              <div className="text-[7px] text-zinc-500 uppercase tracking-widest font-bold mb-0.5">{formatDate(match.fixture.date)}</div>
              <span className="text-lg md:text-xl text-white font-black tracking-widest leading-none font-mono drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                {match.fixture.status.short === 'NS' ? formatTime(match.fixture.date) : `${match.goals.home}-${match.goals.away}`}
              </span>
              {matchPhase === 'LIVE' && (
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 bg-red-600 rounded-full shadow-lg animate-pulse">
                  <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                  <span className="text-white text-[8px] font-black uppercase tracking-wider">LIVE</span>
                </div>
              )}
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
          <div className="fixed bottom-0 w-full z-50 h-64 pointer-events-none">
            <div className="absolute bottom-0 w-full h-32 bg-cover bg-bottom z-10" style={{ backgroundImage: 'url(/shelf-console.webp)' }}></div>
            <div data-testid="card-shelf" className="absolute inset-0 flex justify-center items-end gap-3 pb-14 px-4 overflow-x-auto no-scrollbar z-20 pointer-events-auto">
              {cardTypes.map(card => {
                const count = getCardCount(card.id);
                const active = count > 0;
                const selected = selectedCard === card.id;
                return (
                  <button
                    key={card.id}
                    data-testid={`card-${card.id}`}
                    onClick={() => handleCardClick(card.id)}
                    disabled={!active}
                    className={`relative transition-all duration-300 flex-shrink-0 ${selected ? 'translate-y-[-24px] ring-2 ring-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.6)] z-30' : active ? 'hover:translate-y-[-8px] z-20' : 'opacity-40 grayscale z-10'}`}
                  >
                    <div className="w-20 h-32 relative">
                      <div className="absolute inset-0 bg-[url('/frame-standard.webp')] bg-cover bg-center rounded-lg shadow-lg"></div>
                      <div className="absolute inset-0 flex items-center justify-center p-2 z-10">
                        <CardBase type={card.id} label={card.label} status="generic" variant="transparent" />
                      </div>
                      {active && (<div className="absolute -top-2 -right-2 bg-zinc-900 text-yellow-500 text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border border-yellow-500 shadow-lg z-50">x{count}</div>)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {flowState === 'selection' && match && odds && selectedCard && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
          {selectedCard === 'c_match_result' && (
            <div className="grid grid-cols-3 gap-3 w-full max-w-lg mt-20 animate-in slide-in-from-bottom-8">
              <button data-testid="panel-home" onClick={() => handleOutcomeClick('HOME_WIN', odds.home)} className="backdrop-blur-md border border-white/10 bg-gradient-to-b from-blue-500/20 to-blue-900/40 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:scale-105 transition-transform">
                <img src={match.teams.home.logo} className="w-12 h-12 object-contain" alt="Home" />
                <h3 className="font-black text-white text-xs uppercase text-center leading-tight">WIN</h3>
                <p className="text-yellow-400 font-black text-2xl">+{Math.floor(odds.home * 100)}</p>
              </button>
              <button data-testid="panel-draw" onClick={() => handleOutcomeClick('DRAW', odds.draw)} className="backdrop-blur-md border border-white/10 bg-gradient-to-b from-zinc-500/20 to-zinc-900/40 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:scale-105 transition-transform">
                <Trophy className="w-10 h-10 text-zinc-400" />
                <h3 className="font-black text-white text-sm uppercase">DRAW</h3>
                <p className="text-yellow-400 font-black text-2xl">+{Math.floor(odds.draw * 100)}</p>
              </button>
              <button data-testid="panel-away" onClick={() => handleOutcomeClick('AWAY_WIN', odds.away)} className="backdrop-blur-md border border-white/10 bg-gradient-to-b from-red-500/20 to-red-900/40 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:scale-105 transition-transform">
                <img src={match.teams.away.logo} className="w-12 h-12 object-contain" alt="Away" />
                <h3 className="font-black text-white text-xs uppercase text-center leading-tight">WIN</h3>
                <p className="text-yellow-400 font-black text-2xl">+{Math.floor(odds.away * 100)}</p>
              </button>
            </div>
          )}
          <div className="absolute inset-0 -z-10" onClick={handleReset}></div>
        </div>
      )}

      {flowState === 'staging' && stagedBet && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div data-testid="staging-bar" className="w-full max-w-md bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-end mb-6">
              <div>
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-1">SELECTED OUTCOME</p>
                <p className="text-white font-black text-2xl uppercase italic">{stagedBet.selection.replace('_', ' ')}</p>
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