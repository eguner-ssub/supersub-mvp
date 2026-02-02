import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Loader2, Trophy, CheckCircle, Lock } from 'lucide-react';
import { useGame } from '../context/GameContext';
import CardBase from '../components/CardBase';

const MatchDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  // Using simplified context access
  const { userProfile, loading: gameLoading, supabase, loadProfile } = useGame();

  const [match, setMatch] = useState(null);
  const [odds, setOdds] = useState(null);
  const [loading, setLoading] = useState(true);

  // STATE MACHINE: 'idle' | 'selection' | 'staging' | 'resolved'
  const [flowState, setFlowState] = useState('idle');
  const [selectedCard, setSelectedCard] = useState(null);
  const [stagedBet, setStagedBet] = useState(null);

  const cardTypes = [
    { id: 'c_match_result', label: 'Match Result' },
    { id: 'c_total_goals', label: 'Total Goals' },
    { id: 'c_player_score', label: 'Player Score' },
    { id: 'c_supersub', label: 'Super Sub' }
  ];

  // Helper to safely count cards
  const getCardCount = (cardId) => {
    if (!userProfile?.inventory || !Array.isArray(userProfile.inventory)) return 0;
    return userProfile.inventory.filter(item => item === cardId).length;
  };

  useEffect(() => {
    const fetchMatchDetail = async () => {
      try {
        setLoading(true);
        const [matchRes, oddsRes] = await Promise.all([
          fetch(`/api/matches?id=${id}`),
          fetch(`/api/odds?fixture=${id}`)
        ]);

        if (!matchRes.ok) throw new Error("Match unavailable");

        const matchData = await matchRes.json();
        const oddsData = await oddsRes.json();

        if (matchData.response && matchData.response.length > 0) {
          setMatch(matchData.response[0]);
          setOdds(oddsData.odds || { home: 2.0, draw: 3.0, away: 2.0 });
        }
      } catch (err) {
        console.error("Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchMatchDetail();
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

  // --- THE FIXED TRANSACTION LOGIC ---
  const handlePlay = async () => {
    if (!userProfile || !stagedBet) return;

    try {
      // 1. SAFE INVENTORY CHECK
      const currentInv = userProfile.inventory ? [...userProfile.inventory] : [];
      const cardIndex = currentInv.indexOf(stagedBet.card);

      if (cardIndex === -1) {
        alert("Transaction Failed: Card not found in inventory.");
        return;
      }

      // 2. Remove Card (Optimistic)
      currentInv.splice(cardIndex, 1);

      // 3. Update Profile (Consume Card)
      const { error: invError } = await supabase
        .from('profiles')
        .update({ inventory: currentInv })
        .eq('id', userProfile.id);

      if (invError) throw invError;

      // 4. Create Prediction Record
      // FIX APPLIED HERE: Changed 'market' to 'card_type'
      const { error: betError } = await supabase
        .from('predictions')
        .insert({
          user_id: userProfile.id,
          match_id: match.fixture.id,
          team_name: `${match.teams.home.name} vs ${match.teams.away.name}`,
          card_type: stagedBet.card, // <--- CHANGED FROM 'market' TO 'card_type'
          selection: stagedBet.selection,
          odds: stagedBet.odds,
          stake: 0,
          potential_reward: stagedBet.reward,
          status: 'PENDING'
        });

      if (betError) throw betError;

      // 5. Force Refresh Profile (To sync UI with DB)
      const session = await supabase.auth.getSession();
      if (session?.data?.session) {
        loadProfile(session.data.session);
      }

      setFlowState('resolved');

    } catch (err) {
      console.error("Transaction Failed:", err);
      // Alert the specific database error message so we can debug further if needed
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

  const isLocked = cardTypes.every(card => getCardCount(card.id) === 0);

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
        <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
          <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          <span className="text-white font-bold text-sm">{userProfile.energy}/{userProfile.max_energy}</span>
        </div>
      </div>

      {/* SCOREBOARD (BALANCED) */}
      {match && (
        <div className="absolute top-16 w-full z-40 px-2">
          <div className="relative w-full max-w-lg mx-auto h-14 flex items-center justify-center drop-shadow-2xl mt-3">
            {/* Left Wing */}
            <div className="flex-1 h-9 bg-gradient-to-b from-gray-200 via-gray-100 to-gray-400 rounded-l-md border-b-4 border-[#2d241e] flex items-center justify-start pl-3 relative shadow-lg mr-[-8px]">
              <img src={match.teams.home.logo} className="w-5 h-5 object-contain z-10 drop-shadow-md" />
              <span className="ml-2 text-black/90 font-black text-[10px] md:text-xs uppercase tracking-tight truncate z-10 leading-none">{match.teams.home.name}</span>
              <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/40 rounded-l-md pointer-events-none"></div>
            </div>
            {/* Center */}
            <div className="relative z-20 w-28 h-14 bg-zinc-950 border-x border-zinc-700 border-b-4 border-[#2d241e] rounded-b-lg shadow-2xl flex flex-col items-center justify-center pt-0.5 pb-1">
              <div className="absolute top-0 w-full h-[1px] bg-zinc-600"></div>
              <div className="text-[7px] text-zinc-500 uppercase tracking-widest font-bold mb-0.5">{formatDate(match.fixture.date)}</div>
              <span className="text-lg md:text-xl text-white font-black tracking-widest leading-none font-mono drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                {match.fixture.status.short === 'NS' ? formatTime(match.fixture.date) : `${match.goals.home}-${match.goals.away}`}
              </span>
              {match.fixture.status.short !== 'NS' && (<div className="absolute bottom-1 w-1 h-1 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,1)]"></div>)}
            </div>
            {/* Right Wing */}
            <div className="flex-1 h-9 bg-gradient-to-b from-gray-200 via-gray-100 to-gray-400 rounded-r-md border-b-4 border-[#2d241e] flex items-center justify-end pr-3 relative shadow-lg ml-[-8px]">
              <span className="mr-2 text-black/90 font-black text-[10px] md:text-xs uppercase tracking-tight truncate text-right z-10 leading-none">{match.teams.away.name}</span>
              <img src={match.teams.away.logo} className="w-5 h-5 object-contain z-10 drop-shadow-md" />
              <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/40 rounded-r-md pointer-events-none"></div>
            </div>
          </div>
        </div>
      )}

      {/* DECK (BOTTOM) */}
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

      {/* SELECTION MODAL */}
      {flowState === 'selection' && match && odds && selectedCard === 'c_match_result' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="grid grid-cols-3 gap-3 w-full max-w-lg mt-20">
            <button onClick={() => handleOutcomeClick('HOME', odds.home)} className="backdrop-blur-md border border-white/10 bg-gradient-to-b from-blue-500/20 to-blue-900/40 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:scale-105 transition-transform">
              <img src={match.teams.home.logo} className="w-12 h-12 object-contain" />
              <h3 className="font-black text-white text-xs uppercase text-center leading-tight">{match.teams.home.name}<br />WIN</h3>
              <p className="text-yellow-400 font-black text-2xl">+{Math.floor(odds.home * 100)}</p>
            </button>
            <button onClick={() => handleOutcomeClick('DRAW', odds.draw)} className="backdrop-blur-md border border-white/10 bg-gradient-to-b from-zinc-500/20 to-zinc-900/40 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:scale-105 transition-transform">
              <Trophy className="w-10 h-10 text-zinc-400" />
              <h3 className="font-black text-white text-sm uppercase">DRAW</h3>
              <p className="text-yellow-400 font-black text-2xl">+{Math.floor(odds.draw * 100)}</p>
            </button>
            <button onClick={() => handleOutcomeClick('AWAY', odds.away)} className="backdrop-blur-md border border-white/10 bg-gradient-to-b from-red-500/20 to-red-900/40 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:scale-105 transition-transform">
              <img src={match.teams.away.logo} className="w-12 h-12 object-contain" />
              <h3 className="font-black text-white text-xs uppercase text-center leading-tight">{match.teams.away.name}<br />WIN</h3>
              <p className="text-yellow-400 font-black text-2xl">+{Math.floor(odds.away * 100)}</p>
            </button>
          </div>
          <div className="absolute inset-0 -z-10" onClick={handleReset}></div>
        </div>
      )}

      {/* CONFIRMATION POPUP (CENTERED & FIXED) */}
      {flowState === 'staging' && stagedBet && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-end mb-6">
              <div>
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-1">SELECTED OUTCOME</p>
                <p className="text-white font-black text-2xl uppercase italic">{stagedBet.selection}</p>
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
              <button onClick={() => window.location.reload()} className="w-full py-4 bg-white text-black font-black uppercase rounded-xl hover:scale-105 transition-transform shadow-xl">Continue</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default MatchDetail;