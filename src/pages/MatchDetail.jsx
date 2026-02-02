import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Loader2, Trophy, CheckCircle, Goal, User, ArrowUpCircle, Signal } from 'lucide-react';
import { useGame } from '../context/GameContext';
import CardBase from '../components/CardBase';

const MatchDetail = () => {
  const { id } = useParams(); // Ensure this is not undefined!
  const navigate = useNavigate();

  const { userProfile, loading: gameLoading, placeBet, consumeCard, loadProfile, supabase } = useGame();

  const [match, setMatch] = useState(null);
  const [odds, setOdds] = useState(null);
  const [activeBookie, setActiveBookie] = useState(null);
  const [matchPhase, setMatchPhase] = useState(null); // 'PRE' | 'LIVE' | 'POST'
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

  // === MATCH PHASE DETECTOR ===
  const getMatchPhase = (status) => {
    const PRE_MATCH = ['NS', 'TBD', 'PST', 'CANC', 'ABD'];
    const LIVE = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'];
    const POST_MATCH = ['FT', 'AET', 'PEN'];

    if (PRE_MATCH.includes(status)) return 'PRE';
    if (LIVE.includes(status)) return 'LIVE';
    if (POST_MATCH.includes(status)) return 'POST';
    return 'PRE'; // Default fallback
  };

  // === ODDS NORMALIZATION ===
  const processOdds = (data, isLive) => {
    let markets = [];
    let bookmakerId = null;
    let bookmakerName = null;

    if (isLive) {
      // LIVE: Flat structure - response[0].odds[]
      markets = data.response?.[0]?.odds || [];
      bookmakerName = "LIVE";
    } else {
      // PRE-MATCH: Nested structure - response[0].bookmakers[]
      const bookmakers = data.response?.[0]?.bookmakers || [];

      // Priority: Bet365 (6) > 1xBet (10) > Unibet (16) > Bwin (7) > First available
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

    // If no markets found, return null to trigger simulation
    if (markets.length === 0) return null;

    // Helper to extract market values
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

  // === SIMULATION FALLBACK ===
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
      console.error("⛔ CRITICAL: Match ID is missing from URL.");
      setLoading(false);
      return;
    }

    const fetchMatchDetail = async () => {
      try {
        setLoading(true);
        const timestamp = Date.now();
        console.log(`🔌 Fetching Data for Match ID: ${id}`);

        // === STEP 1: FETCH FIXTURE (Sequential) ===
        const matchRes = await fetch(`/api/matches?id=${id}&t=${timestamp}`);
        if (!matchRes.ok) throw new Error("Match unavailable");

        const matchData = await matchRes.json();
        if (!matchData.response || matchData.response.length === 0) {
          throw new Error("No match data found");
        }

        const matchInfo = matchData.response[0];
        setMatch(matchInfo);

        // === STEP 2: DETERMINE MATCH PHASE ===
        const status = matchInfo.fixture.status.short;
        const phase = getMatchPhase(status);
        setMatchPhase(phase);
        console.log(`🎯 Match Phase: ${phase} (Status: ${status})`);

        // === STEP 3: CONDITIONAL ODDS FETCHING ===
        if (phase === 'POST') {
          // Post-match: No odds needed
          console.log("⚽ Match finished. Skipping odds fetch.");
          setOdds(null);
          setActiveBookie(null);
        } else {
          // Determine endpoint
          const endpoint = phase === 'LIVE'
            ? `/api/odds/live?fixture=${id}&t=${timestamp}`
            : `/api/odds?fixture=${id}&bookmaker=6&t=${timestamp}`;

          console.log(`📡 Fetching ${phase} odds from: ${endpoint}`);
          
          const oddsRes = await fetch(endpoint);
          const oddsData = await oddsRes.json();
          
          console.log("📊 Raw Odds Response:", oddsData);

          // Check if response is in simplified format (from our live odds API)
          if (oddsData.isLive !== undefined && oddsData.odds) {
            // Simplified format: { fixtureId, isLive, source, odds: {home, draw, away} }
            console.log(`✅ Odds loaded from: ${oddsData.source || 'LIVE'}`);
            setOdds({
              home: oddsData.odds.home,
              draw: oddsData.odds.draw,
              away: oddsData.odds.away,
              goals_over: 1.85, // Default for live (not provided in simplified format)
              goals_under: 1.95,
              supersub_yes: 4.50,
              scorers: [
                { id: 1, name: "Home Striker", odds: 2.2 },
                { id: 2, name: "Away Striker", odds: 2.8 },
                { id: 3, name: "Midfield Star", odds: 3.5 }
              ]
            });
            setActiveBookie(oddsData.source || 'LIVE');
          } else {
            // Standard API-Football format
            const processed = processOdds(oddsData, phase === 'LIVE');
            
            if (processed) {
              setOdds(processed.odds);
              setActiveBookie(processed.bookmaker.name);
              console.log(`✅ Odds loaded from: ${processed.bookmaker.name}`);
            } else {
              // Fallback to simulation
              console.warn("⚠️ No odds available. Activating Simulation.");
              const simulation = getSimulationOdds();
              setOdds(simulation.odds);
              setActiveBookie(simulation.bookmaker.name);
            }
          }
        }
      } catch (err) {
        console.error("❌ Fetch Error:", err);
        // On error, try simulation fallback
        const simulation = getSimulationOdds();
        setOdds(simulation.odds);
        setActiveBookie(simulation.bookmaker.name);
      } finally {
        setLoading(false);
      }
    };

    fetchMatchDetail();
  }, [id]);

  // --- HANDLERS ---
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

      const consumed = await consumeCard(stagedBet.card);
      if (!consumed) console.warn("Bet placed, but failed to update inventory.");

      const session = await supabase.auth.getSession();
      if (session?.data?.session) loadProfile(session.data.session);

      setFlowState('resolved');

    } catch (err) {
      console.error("Transaction Failed:", err);
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

      {/* BACKGROUND */}
      <div className="absolute inset-0 z-0">
        <img src="/bg-tunnel.webp" className="absolute inset-0 w-full h-full object-cover" alt="Tunnel" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
      </div>

      {/* TOP NAV */}
      <div className="absolute top-0 left-0 w-full px-4 pt-8 pb-4 flex justify-between items-center z-[60]">
        <button onClick={() => navigate('/match-hub')} className="flex items-center justify-center w-10 h-10 bg-black/50 backdrop-blur-md border border-white/20 rounded-full text-white active:scale-95 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-end gap-1">
          {/* ENERGY BAR */}
          <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
            <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span className="text-white font-bold text-sm">{userProfile.energy}/{userProfile.max_energy}</span>
          </div>

          {/* --- THE SIGNAL (VISUAL DEBUGGER) --- */}
          {activeBookie && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/40 border border-white/5 backdrop-blur-sm">
              {/* Orange pulse if SIMULATION, Green if Live */}
              <Signal className={`w-3 h-3 ${activeBookie === 'SIMULATION' ? 'text-orange-500' : 'text-green-500'} animate-pulse`} />
              <span className={`text-[9px] font-mono uppercase tracking-widest ${activeBookie === 'SIMULATION' ? 'text-orange-400' : 'text-white/60'}`}>
                {activeBookie}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* SCOREBOARD */}
      {match && (
        <div className="absolute top-16 w-full z-40 px-2">
          <div className="relative w-full max-w-lg mx-auto h-14 flex items-center justify-center drop-shadow-2xl mt-3">
            {/* Left Wing */}
            <div className="flex-1 h-9 bg-gradient-to-b from-gray-200 via-gray-100 to-gray-400 rounded-l-md border-b-4 border-[#2d241e] flex items-center justify-start pl-3 relative shadow-lg mr-[-8px]">
              <img src={match.teams.home.logo} className="w-5 h-5 object-contain z-10 drop-shadow-md" alt="Home" />
              <span className="ml-2 text-black/90 font-black text-[10px] md:text-xs uppercase tracking-tight truncate z-10 leading-none">{match.teams.home.name}</span>
            </div>
            {/* Center */}
            <div className="relative z-20 w-28 h-14 bg-zinc-950 border-x border-zinc-700 border-b-4 border-[#2d241e] rounded-b-lg shadow-2xl flex flex-col items-center justify-center pt-0.5 pb-1">
              <div className="absolute top-0 w-full h-[1px] bg-zinc-600"></div>
              <div className="text-[7px] text-zinc-500 uppercase tracking-widest font-bold mb-0.5">{formatDate(match.fixture.date)}</div>
              <span className="text-lg md:text-xl text-white font-black tracking-widest leading-none font-mono drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                {match.fixture.status.short === 'NS' ? formatTime(match.fixture.date) : `${match.goals.home}-${match.goals.away}`}
              </span>

              {/* MATCH PHASE INDICATOR */}
              {matchPhase === 'LIVE' && (
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 bg-red-600 rounded-full shadow-lg animate-pulse">
                  <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                  <span className="text-white text-[8px] font-black uppercase tracking-wider">LIVE</span>
                </div>
              )}
              {matchPhase === 'POST' && (
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 bg-zinc-700 rounded-full shadow-lg">
                  <span className="text-zinc-300 text-[8px] font-black uppercase tracking-wider">FINISHED</span>
                </div>
              )}
            </div>
            {/* Right Wing */}
            <div className="flex-1 h-9 bg-gradient-to-b from-gray-200 via-gray-100 to-gray-400 rounded-r-md border-b-4 border-[#2d241e] flex items-center justify-end pr-3 relative shadow-lg ml-[-8px]">
              <span className="mr-2 text-black/90 font-black text-[10px] md:text-xs uppercase tracking-tight truncate text-right z-10 leading-none">{match.teams.away.name}</span>
              <img src={match.teams.away.logo} className="w-5 h-5 object-contain z-10 drop-shadow-md" alt="Away" />
            </div>
          </div>
        </div>
      )}

      {/* DECK (BOTTOM) - Hidden for finished matches */}
      {matchPhase !== 'POST' && (
        <>
          <div className="flex-1"></div>
          <div className="fixed bottom-0 w-full z-50 h-64 pointer-events-none">
            <div className="absolute bottom-0 w-full h-32 bg-cover bg-bottom z-10" style={{ backgroundImage: 'url(/shelf-console.webp)' }}></div>
            <div className="absolute inset-0 flex justify-center items-end gap-3 pb-14 px-4 overflow-x-auto no-scrollbar z-20 pointer-events-auto">
              {cardTypes.map(card => {
                const count = getCardCount(card.id);
                const active = count > 0;
                const selected = selectedCard === card.id;
                return (
                  <button
                    key={card.id}
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

      {/* FINISHED MATCH BANNER */}
      {matchPhase === 'POST' && match && (
        <div className="fixed bottom-0 w-full z-50 pb-8">
          <div className="max-w-md mx-auto px-4">
            <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
              <div className="text-center">
                <div className="text-zinc-500 text-xs uppercase tracking-widest mb-2">FULL TIME</div>
                <div className="text-white font-black text-4xl mb-2">{match.goals.home} - {match.goals.away}</div>
                <div className="text-zinc-400 text-sm">
                  {match.teams.home.name} vs {match.teams.away.name}
                </div>
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-zinc-500 text-xs">Betting is closed for this match</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SELECTION MODAL (DYNAMIC) */}
      {flowState === 'selection' && match && odds && selectedCard && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">

          {/* CASE 1: MATCH RESULT */}
          {selectedCard === 'c_match_result' && (
            <div className="grid grid-cols-3 gap-3 w-full max-w-lg mt-20 animate-in slide-in-from-bottom-8">
              <button onClick={() => handleOutcomeClick('HOME_WIN', odds.home)} className="backdrop-blur-md border border-white/10 bg-gradient-to-b from-blue-500/20 to-blue-900/40 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:scale-105 transition-transform">
                <img src={match.teams.home.logo} className="w-12 h-12 object-contain" alt="Home" />
                <h3 className="font-black text-white text-xs uppercase text-center leading-tight">WIN</h3>
                <p className="text-yellow-400 font-black text-2xl">+{Math.floor(odds.home * 100)}</p>
              </button>
              <button onClick={() => handleOutcomeClick('DRAW', odds.draw)} className="backdrop-blur-md border border-white/10 bg-gradient-to-b from-zinc-500/20 to-zinc-900/40 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:scale-105 transition-transform">
                <Trophy className="w-10 h-10 text-zinc-400" />
                <h3 className="font-black text-white text-sm uppercase">DRAW</h3>
                <p className="text-yellow-400 font-black text-2xl">+{Math.floor(odds.draw * 100)}</p>
              </button>
              <button onClick={() => handleOutcomeClick('AWAY_WIN', odds.away)} className="backdrop-blur-md border border-white/10 bg-gradient-to-b from-red-500/20 to-red-900/40 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:scale-105 transition-transform">
                <img src={match.teams.away.logo} className="w-12 h-12 object-contain" alt="Away" />
                <h3 className="font-black text-white text-xs uppercase text-center leading-tight">WIN</h3>
                <p className="text-yellow-400 font-black text-2xl">+{Math.floor(odds.away * 100)}</p>
              </button>
            </div>
          )}

          {/* CASE 2: TOTAL GOALS */}
          {selectedCard === 'c_total_goals' && (
            <div className="flex flex-col gap-4 w-full max-w-xs mt-20 animate-in slide-in-from-bottom-8">
              <h3 className="text-white text-center font-black uppercase text-xl">Over / Under 2.5 Goals</h3>
              <div className="flex gap-4">
                <button onClick={() => handleOutcomeClick('OVER_2.5', odds.goals_over)} className="flex-1 backdrop-blur-md border border-white/10 bg-gradient-to-b from-emerald-500/20 to-emerald-900/40 rounded-xl p-6 flex flex-col items-center gap-2 hover:scale-105 transition-transform">
                  <Goal className="w-8 h-8 text-emerald-400" />
                  <span className="font-black text-white uppercase">OVER</span>
                  <span className="text-yellow-400 font-black text-2xl">+{Math.floor(odds.goals_over * 100)}</span>
                </button>
                <button onClick={() => handleOutcomeClick('UNDER_2.5', odds.goals_under)} className="flex-1 backdrop-blur-md border border-white/10 bg-gradient-to-b from-red-500/20 to-red-900/40 rounded-xl p-6 flex flex-col items-center gap-2 hover:scale-105 transition-transform">
                  <Goal className="w-8 h-8 text-red-400" />
                  <span className="font-black text-white uppercase">UNDER</span>
                  <span className="text-yellow-400 font-black text-2xl">+{Math.floor(odds.goals_under * 100)}</span>
                </button>
              </div>
            </div>
          )}

          {/* CASE 3: SUPER SUB */}
          {selectedCard === 'c_supersub' && (
            <div className="w-full max-w-xs mt-20 animate-in slide-in-from-bottom-8">
              <button onClick={() => handleOutcomeClick('SUPERSUB_GOAL', odds.supersub_yes)} className="w-full backdrop-blur-md border border-yellow-500/50 bg-gradient-to-b from-yellow-500/10 to-yellow-900/20 rounded-xl p-8 flex flex-col items-center gap-4 hover:scale-105 transition-transform">
                <ArrowUpCircle className="w-12 h-12 text-yellow-400" />
                <div className="text-center">
                  <h3 className="font-black text-white text-xl uppercase">IMPACT SUB</h3>
                  <p className="text-zinc-400 text-xs">Goal scored by a substitute</p>
                </div>
                <span className="text-yellow-400 font-black text-4xl">+{Math.floor(odds.supersub_yes * 100)}</span>
              </button>
            </div>
          )}

          {/* CASE 4: PLAYER SCORE */}
          {selectedCard === 'c_player_score' && (
            <div className="w-full max-w-sm mt-20 max-h-[60vh] overflow-y-auto animate-in slide-in-from-bottom-8">
              <h3 className="text-white text-center font-black uppercase text-xl mb-4">To Score Anytime</h3>
              <div className="flex flex-col gap-2">
                {odds.scorers?.map((player) => (
                  <button key={player.id || player.name} onClick={() => handleOutcomeClick(`GOAL: ${player.name}`, player.odds)} className="flex items-center justify-between backdrop-blur-md border border-white/10 bg-zinc-900/80 rounded-lg p-4 hover:bg-zinc-800 transition-colors">
                    <div className="flex items-center gap-3">
                      <User className="w-8 h-8 text-zinc-500 bg-zinc-800 rounded-full p-1.5" />
                      <span className="font-bold text-white uppercase text-sm">{player.name}</span>
                    </div>
                    <span className="text-yellow-400 font-black text-lg">+{Math.floor(player.odds * 100)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Click Outside to Close */}
          <div className="absolute inset-0 -z-10" onClick={handleReset}></div>
        </div>
      )}

      {/* CONFIRMATION POPUP */}
      {flowState === 'staging' && stagedBet && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
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
              <button onClick={handlePlay} className="flex-[2] py-4 bg-green-500 hover:bg-green-400 rounded-xl font-black uppercase text-black text-lg transition-colors shadow-lg shadow-green-500/20">CONFIRM PLAY</button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL */}
      {flowState === 'resolved' && (
        <div className="fixed inset-0 z-[80] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in duration-300">
          <div className="text-center w-full max-w-sm border border-white/10 bg-zinc-900/50 p-8 rounded-3xl relative overflow-hidden">
            <div className="absolute inset-0 bg-green-500/10 animate-pulse"></div>
            <div className="relative z-10">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.5)]">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="font-black uppercase text-white text-3xl mb-2 tracking-tighter">Locked In!</h2>
              <button onClick={() => navigate('/dashboard')} className="w-full py-4 bg-white text-black font-black uppercase rounded-xl hover:scale-105 transition-transform shadow-xl">Continue</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default MatchDetail;