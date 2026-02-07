import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Loader2, Trophy, Signal, Goal, User, ArrowUpCircle } from 'lucide-react';
import { useGame } from '../../shared/context/GameContext';
import CardBase from '../../shared/ui/CardBase';
import { getHybridOdds } from '../../shared/services/oddsService';

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

  // Updated card count for the selection shelf
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
            setOdds(oddsData.odds);
            setActiveBookie(oddsData.source);
          } else {
            setOdds({ home: 2.10, draw: 3.20, away: 2.80, goals_over: 1.85, goals_under: 1.95, supersub_yes: 4.50, scorers: [] });
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

      {match && (
        <div className="absolute top-16 w-full z-40 px-2">
          <div className="relative w-full max-w-lg mx-auto h-14 flex items-center justify-center mt-3 drop-shadow-2xl">
            <div className="flex-1 h-9 bg-gradient-to-b from-gray-200 via-gray-100 to-gray-400 rounded-l-md border-b-4 border-[#2d241e] flex items-center pl-3">
              <img src={match.teams.home.logo} className="w-5 h-5 object-contain" alt="Home" />
              <span className="ml-2 text-black/90 font-black text-[10px] md:text-xs uppercase truncate leading-none">{match.teams.home.name}</span>
            </div>
            <div className="w-28 h-14 bg-zinc-950 border-x border-zinc-700 border-b-4 border-[#2d241e] rounded-b-lg flex flex-col items-center justify-center">
              <span className="text-lg md:text-xl text-white font-black font-mono">
                {match.fixture.status.short === 'NS' ? new Date(match.fixture.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `${match.goals.home}-${match.goals.away}`}
              </span>
            </div>
            <div className="flex-1 h-9 bg-gradient-to-b from-gray-200 via-gray-100 to-gray-400 rounded-r-md border-b-4 border-[#2d241e] flex items-center justify-end pr-3">
              <span className="mr-2 text-black/90 font-black text-[10px] md:text-xs uppercase truncate text-right leading-none">{match.teams.away.name}</span>
              <img src={match.teams.away.logo} className="w-5 h-5 object-contain" alt="Away" />
            </div>
          </div>
        </div>
      )}

      {matchPhase !== 'POST' && (
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
                  <div className="w-20 h-32 relative">
                    <div className="absolute inset-0 bg-[url('/frame-standard.webp')] bg-cover bg-center rounded-lg shadow-lg"></div>
                    <div className="absolute inset-0 flex items-center justify-center p-2 z-10"><CardBase type={card.id} label={card.label} status="generic" variant="transparent" /></div>
                    {count > 0 && <div className="absolute -top-2 -right-2 bg-zinc-900 text-yellow-500 text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border border-yellow-500 shadow-lg z-50">x{count}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {flowState === 'selection' && match && odds && selectedCard && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          {selectedCard === 'c_match_result' && (
            <div className="grid grid-cols-3 gap-3 w-full max-w-lg mt-20">
              <button onClick={() => handleOutcomeClick('HOME_WIN', odds.home, match.teams.home.name)} className="bg-gradient-to-b from-blue-500/20 to-blue-900/40 rounded-xl p-4 flex flex-col items-center gap-2 hover:scale-105 transition-transform border border-white/10">
                <img src={match.teams.home.logo} className="w-12 h-12 object-contain" alt="Home" />
                <h3 className="text-white text-xs font-black">WIN</h3>
                <p className="text-yellow-400 font-black text-2xl">+{Math.floor(odds.home * 100)}</p>
              </button>
              <button onClick={() => handleOutcomeClick('DRAW', odds.draw, 'Draw Result')} className="bg-gradient-to-b from-zinc-500/20 to-zinc-900/40 rounded-xl p-4 flex flex-col items-center gap-2 hover:scale-105 transition-transform border border-white/10">
                <Trophy className="w-10 h-10 text-zinc-400" />
                <h3 className="text-white text-xs font-black">DRAW</h3>
                <p className="text-yellow-400 font-black text-2xl">+{Math.floor(odds.draw * 100)}</p>
              </button>
              <button onClick={() => handleOutcomeClick('AWAY_WIN', odds.away, match.teams.away.name)} className="bg-gradient-to-b from-red-500/20 to-red-900/40 rounded-xl p-4 flex flex-col items-center gap-2 hover:scale-105 transition-transform border border-white/10">
                <img src={match.teams.away.logo} className="w-12 h-12 object-contain" alt="Away" />
                <h3 className="text-white text-xs font-black">WIN</h3>
                <p className="text-yellow-400 font-black text-2xl">+{Math.floor(odds.away * 100)}</p>
              </button>
            </div>
          )}
          {selectedCard === 'c_total_goals' && (
            <div className="flex gap-4 w-full max-w-lg mt-20">
              <button onClick={() => handleOutcomeClick('OVER_2.5', odds.goals_over, 'Over 2.5 Goals')} className="flex-1 bg-zinc-800/80 rounded-xl p-6 flex flex-col items-center hover:bg-zinc-700 border border-white/10">
                <ArrowUpCircle className="w-10 h-10 text-green-400 mb-2" />
                <div className="text-white font-bold uppercase">Over 2.5</div>
                <div className="text-yellow-400 font-black text-2xl">+{Math.floor(odds.goals_over * 100)}</div>
              </button>
              <button onClick={() => handleOutcomeClick('UNDER_2.5', odds.goals_under, 'Under 2.5 Goals')} className="flex-1 bg-zinc-800/80 rounded-xl p-6 flex flex-col items-center hover:bg-zinc-700 border border-white/10">
                <Goal className="w-10 h-10 text-red-400 mb-2" />
                <div className="text-white font-bold uppercase">Under 2.5</div>
                <div className="text-yellow-400 font-black text-2xl">+{Math.floor(odds.goals_under * 100)}</div>
              </button>
            </div>
          )}
          {selectedCard === 'c_player_score' && (
            <div className="w-full max-w-lg mt-20 bg-zinc-900/90 rounded-xl p-4 max-h-[60vh] overflow-y-auto border border-white/10">
              <h3 className="text-white font-bold mb-4 border-b border-white/10 pb-2">Select Scorer</h3>
              <div className="grid grid-cols-1 gap-2">
                {odds.scorers?.map((player) => (
                  <button key={player.id} onClick={() => handleOutcomeClick(`SCORE_${player.id}`, player.odds, player.name)} className="flex justify-between items-center p-3 bg-white/5 rounded-lg hover:bg-white/10 text-white">
                    <div className="flex items-center gap-3"><User className="w-5 h-5 text-zinc-400" /><span>{player.name}</span></div>
                    <span className="text-yellow-400 font-bold">+{Math.floor(player.odds * 100)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {selectedCard === 'c_supersub' && (
            <div className="w-full max-w-sm mt-20">
              <button onClick={() => handleOutcomeClick('SUPERSUB_YES', odds.supersub_yes, 'Super Sub')} className="w-full bg-gradient-to-br from-yellow-900/80 to-black rounded-xl p-8 flex flex-col items-center gap-4 hover:scale-105 transition-transform border border-yellow-500/50">
                <Zap className="w-16 h-16 text-yellow-400" />
                <div className="text-center"><div className="text-white font-black text-2xl uppercase">Activate Super Sub</div><div className="text-white/60 text-sm mt-1 uppercase">Any Substitute to Score</div></div>
                <div className="bg-yellow-500 text-black font-black px-6 py-2 rounded-full text-xl">+{Math.floor(odds.supersub_yes * 100)} PTS</div>
              </button>
            </div>
          )}
          <div className="absolute inset-0 -z-10" onClick={handleReset}></div>
        </div>
      )}

      {flowState === 'staging' && stagedBet && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900/95 border border-white/10 rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-end mb-6">
              <div><p className="text-zinc-500 text-[10px] uppercase">SELECTED OUTCOME</p><p className="text-white font-black text-2xl uppercase italic leading-tight">{stagedBet.displayLabel}</p></div>
              <div className="text-right"><p className="text-zinc-500 text-[10px] uppercase">REWARD</p><p className="text-yellow-400 font-black text-3xl">{stagedBet.reward} PTS</p></div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleReset} className="flex-1 py-4 bg-zinc-800 rounded-xl font-bold uppercase text-zinc-400 text-xs">Cancel</button>
              <button onClick={handlePlay} className="flex-[2] py-4 bg-green-500 rounded-xl font-black uppercase text-black text-lg">CONFIRM PLAY</button>
            </div>
          </div>
        </div>
      )}

      {/* MODIFIED: STAY ON PAGE INSTEAD OF NAVIGATING AWAY */}
      {flowState === 'resolved' && (
        <div className="fixed inset-0 z-[80] bg-black/95 backdrop-blur-md flex items-center justify-center p-6">
          <div className="text-center w-full max-w-sm border border-white/10 bg-zinc-900/50 p-8 rounded-3xl relative overflow-hidden">
            <h2 className="text-white font-black uppercase text-3xl mb-4">Locked In!</h2>
            <button onClick={handleReset} className="w-full py-4 bg-white text-black font-black uppercase rounded-xl shadow-xl">Continue</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchDetail;