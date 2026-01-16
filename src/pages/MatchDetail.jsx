import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Loader2, Lock, TrendingUp } from 'lucide-react';
import { useGame } from '../context/GameContext';

const MatchDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userProfile, loading: gameLoading } = useGame();

  const [match, setMatch] = useState(null);
  const [odds, setOdds] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // PREDICTION FLOW STATE
  const [selectedCard, setSelectedCard] = useState(null);
  const [draftPrediction, setDraftPrediction] = useState(null);
  const [isDeckOpen, setIsDeckOpen] = useState(true);

  // CARD TYPES DEFINITION
  const cardTypes = [
    { id: 'c_match_result', label: 'Match Result', img: '/cards/card_match_result.webp' },
    { id: 'c_total_goals', label: 'Total Goals', img: '/cards/card_total_goals.webp' },
    { id: 'c_player_score', label: 'Player Score', img: '/cards/card_player_score.webp' },
    { id: 'c_supersub', label: 'Super Sub', img: '/cards/card_supersub.webp' },
  ];

  // REAL INVENTORY CHECK
  const getCardCount = (cardId) => {
    if (!userProfile?.inventory) return 0;
    return userProfile.inventory.filter(item => item === cardId).length;
  };

  const hasMatchResultCard = () => {
    return getCardCount('c_match_result') > 0;
  };

  const handleImageError = (e) => {
    e.target.style.opacity = 0.5;
  };

  // MOCK ODDS FUNCTION (for testing without API limits)
  const getMockOdds = (fixtureId) => {
    // Generate semi-realistic odds based on fixture ID
    const seed = parseInt(fixtureId) % 100;
    return {
      home: (1.5 + (seed % 30) / 10).toFixed(2),
      draw: (2.8 + (seed % 15) / 10).toFixed(2),
      away: (1.8 + (seed % 25) / 10).toFixed(2)
    };
  };

  // FETCH MATCH DATA & ODDS
  useEffect(() => {
    const fetchMatchDetail = async () => {
      try {
        setLoading(true);

        // Fetch match data
        const matchResponse = await fetch(`/api/matches?id=${id}`);
        if (!matchResponse.ok) throw new Error("Match unavailable");

        const matchData = await matchResponse.json();

        if (matchData.response && matchData.response.length > 0) {
          setMatch(matchData.response[0]);

          // Use mock odds for now to avoid API limits
          // TODO: Switch to real API when ready
          // const oddsResponse = await fetch(`/api/odds?fixture=${id}`);
          // const oddsData = await oddsResponse.json();
          // setOdds(oddsData.odds);

          setOdds(getMockOdds(id));
        } else {
          throw new Error("Match not found");
        }
      } catch (err) {
        console.error("Match Detail Error:", err);
        setError("Could not retrieve match intelligence.");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchMatchDetail();
  }, [id]);

  // CARD SELECTION HANDLER
  const handleCardSelect = (cardId) => {
    if (getCardCount(cardId) === 0) return; // Can't select cards you don't have
    if (cardId !== 'c_match_result') return; // Only Match Result cards work for now

    setSelectedCard(cardId);
    setDraftPrediction(null); // Clear any existing draft
  };

  // PREDICTION SELECTION HANDLER
  const handlePredictionSelect = (type) => {
    if (!selectedCard) return; // Must select a card first
    if (!hasMatchResultCard()) return; // Must have the card

    let oddsValue;
    switch (type) {
      case 'HOME_WIN':
        oddsValue = parseFloat(odds.home);
        break;
      case 'DRAW':
        oddsValue = parseFloat(odds.draw);
        break;
      case 'AWAY_WIN':
        oddsValue = parseFloat(odds.away);
        break;
      default:
        oddsValue = 2.0;
    }

    const potentialReward = Math.floor(oddsValue * 100);

    setDraftPrediction({
      type,
      odds: oddsValue,
      potentialReward
    });

    setIsDeckOpen(false); // Dim the deck
  };

  // PLAY PREDICTION HANDLER (Placeholder)
  const handlePlayPrediction = () => {
    console.log('🎯 PLAYING PREDICTION:', draftPrediction);
    // TODO: Submit to backend, deduct card from inventory, etc.
    alert(`Prediction Placed: ${draftPrediction.type} for ${draftPrediction.potentialReward} coins!`);

    // Reset state
    setDraftPrediction(null);
    setSelectedCard(null);
    setIsDeckOpen(true);
  };

  const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const formatDate = (d) => new Date(d).toLocaleDateString([], { weekday: 'long' });

  // SAFETY SHIELD
  if (gameLoading || !userProfile) {
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
      </div>
    );
  }

  const userData = userProfile;
  const isLocked = !hasMatchResultCard();

  return (
    <div className="w-full h-screen relative font-sans select-none overflow-hidden bg-gray-900">

      {/* 1. BACKGROUND IMAGE */}
      <div className="absolute inset-0 z-0">
        <img
          src="/bg-tunnel.webp"
          alt="Tunnel Background"
          className="w-full h-full object-cover opacity-90"
          onError={(e) => { e.target.onerror = null; e.target.src = "/bg-dugout.webp"; }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/90"></div>
      </div>

      {/* 2. TOP NAVIGATION */}
      <div className="absolute top-0 w-full px-4 pt-12 flex justify-between items-center z-[60] pointer-events-none">
        <button
          onClick={() => navigate('/match-hub')}
          className="flex items-center justify-center w-10 h-10 bg-black/50 backdrop-blur-md border border-white/20 rounded-full text-white hover:bg-black/70 active:scale-95 transition-all shadow-lg pointer-events-auto"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 shadow-lg pointer-events-auto">
          <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          <span className="text-white font-bold text-sm">
            {userData.energy}/{userData.max_energy}
          </span>
        </div>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center h-full z-50 relative">
          <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {error && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center h-full z-50 relative px-6 text-center">
          <p className="text-red-400 font-bold mb-4">{error}</p>
          <button onClick={() => navigate('/match-hub')} className="px-6 py-3 bg-white text-black font-black uppercase rounded">Return to Hub</button>
        </div>
      )}

      {!loading && match && odds && (
        <>
          {/* 3. SCOREBOARD (Enlarged) */}
          <div className="absolute top-24 left-0 w-full z-40 px-4">
            <div className="relative h-24 w-full bg-gradient-to-b from-gray-100 via-white to-gray-300 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-start justify-between px-4 pt-4 pb-2 border-b-4 border-[#C0A062] rounded-xl">
              {/* Home */}
              <div className="flex items-center gap-2 w-1/3 mt-2">
                <img src={match.teams.home.logo} className="w-11 h-11 object-contain drop-shadow-md" alt="Home" />
                <span className="text-gray-900 font-black text-sm uppercase tracking-tight leading-none truncate">{match.teams.home.name}</span>
              </div>
              {/* Time */}
              <div className="absolute left-1/2 -translate-x-1/2 -top-1 h-28 w-1/3 pointer-events-none filter drop-shadow-lg">
                <div className="w-full h-full bg-[#1a1a1a] clip-path-trapezoid flex flex-col items-center justify-center pt-6 border-t-2 border-[#C0A062] shadow-inner">
                  <div className="text-[10px] text-[#F5C546] font-bold uppercase tracking-[0.2em] mb-0.5">KICKOFF</div>
                  <div className="text-white font-black text-lg leading-none uppercase">{formatDate(match.fixture.date)}</div>
                  <div className="text-xl text-white font-mono leading-none tracking-widest mt-1">{formatTime(match.fixture.date)}</div>
                </div>
              </div>
              {/* Away */}
              <div className="flex items-center justify-end gap-2 w-1/3 mt-2">
                <span className="text-gray-900 font-black text-sm uppercase tracking-tight leading-none text-right truncate">{match.teams.away.name}</span>
                <img src={match.teams.away.logo} className="w-11 h-11 object-contain drop-shadow-md" alt="Away" />
              </div>
            </div>
          </div>

          {/* 4. PREDICTION STAGE */}
          <div className="absolute top-56 left-0 w-full z-30 px-4">
            <div className="relative">
              {/* Prediction Buttons */}
              <div className="flex flex-col gap-3">
                {/* HOME WIN */}
                <PredictionButton
                  type="HOME_WIN"
                  label={`${match.teams.home.name} Win`}
                  logo={match.teams.home.logo}
                  odds={odds.home}
                  isSelected={draftPrediction?.type === 'HOME_WIN'}
                  isLocked={isLocked}
                  onClick={() => handlePredictionSelect('HOME_WIN')}
                />

                {/* DRAW */}
                <PredictionButton
                  type="DRAW"
                  label="Draw"
                  logo={null}
                  odds={odds.draw}
                  isSelected={draftPrediction?.type === 'DRAW'}
                  isLocked={isLocked}
                  onClick={() => handlePredictionSelect('DRAW')}
                />

                {/* AWAY WIN */}
                <PredictionButton
                  type="AWAY_WIN"
                  label={`${match.teams.away.name} Win`}
                  logo={match.teams.away.logo}
                  odds={odds.away}
                  isSelected={draftPrediction?.type === 'AWAY_WIN'}
                  isLocked={isLocked}
                  onClick={() => handlePredictionSelect('AWAY_WIN')}
                />
              </div>

              {/* LOCKED OVERLAY */}
              {isLocked && (
                <div className="absolute inset-0 backdrop-blur-sm bg-black/40 rounded-xl flex flex-col items-center justify-center z-50">
                  <Lock className="w-12 h-12 text-yellow-500 mb-3" />
                  <p className="text-white font-bold text-lg mb-2">Locked</p>
                  <p className="text-gray-300 text-sm mb-4">You need a Match Result card</p>
                  <button
                    onClick={() => navigate('/training')}
                    className="px-6 py-2 bg-yellow-500 text-black font-black uppercase rounded-lg hover:bg-yellow-400 transition-all"
                  >
                    Get Cards
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 5. CARDS TO BE PLAYED PANEL */}
          {draftPrediction && (
            <div className="absolute bottom-36 left-0 w-full z-40 px-4">
              <div className="bg-gradient-to-b from-gray-900 to-black border-2 border-yellow-500 rounded-xl p-4 shadow-[0_0_30px_rgba(234,179,8,0.5)]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-6 h-6 text-yellow-400" />
                    <div>
                      <p className="text-white font-black text-sm uppercase">{draftPrediction.type.replace('_', ' ')}</p>
                      <p className="text-gray-400 text-xs">Odds: {draftPrediction.odds.toFixed(2)}x</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-yellow-400 font-black text-2xl">{draftPrediction.potentialReward}</p>
                    <p className="text-gray-400 text-xs uppercase">Coins</p>
                  </div>
                </div>
                <button
                  onClick={handlePlayPrediction}
                  className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-black uppercase rounded-lg transition-all active:scale-95 shadow-lg"
                >
                  ⚡ PLAY PREDICTION
                </button>
              </div>
            </div>
          )}

          {/* 6. SHELF & INVENTORY */}
          <div className="absolute bottom-0 w-full z-30">
            <div className={`w-full flex justify-center items-end gap-3 pb-4 px-4 z-40 relative translate-y-2 transition-opacity duration-300 ${!isDeckOpen ? 'opacity-50' : 'opacity-100'}`}>
              {cardTypes.map((card) => {
                const count = getCardCount(card.id);
                const isActive = count > 0;
                const isSelected = selectedCard === card.id;
                return (
                  <button
                    key={card.id}
                    onClick={() => handleCardSelect(card.id)}
                    disabled={!isActive}
                    className={`group relative flex flex-col items-center gap-1 transition-all duration-300 ${isActive ? 'opacity-100 hover:-translate-y-4 cursor-pointer' : 'opacity-40 grayscale cursor-not-allowed'
                      } ${isSelected ? 'ring-4 ring-yellow-400 rounded-lg shadow-[0_0_20px_rgba(251,191,36,0.6)]' : ''}`}
                  >
                    <div className={`relative w-[4.5rem] h-24 rounded-lg transition-all transform origin-bottom ${isActive ? 'shadow-[0_10px_20px_rgba(0,0,0,0.5)]' : ''}`}>
                      <img src={card.img} alt={card.label} className="w-full h-full object-contain drop-shadow-2xl" onError={handleImageError} />
                      {isActive && (
                        <div className="absolute -top-2 -right-2 bg-[#F5C546] text-black text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-black shadow-lg z-10">{count}</div>
                      )}
                    </div>
                    <span className={`text-[8px] font-bold uppercase tracking-wider text-center max-w-[4rem] leading-tight ${isActive ? 'text-white' : 'text-gray-500'} drop-shadow-md`}>{card.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="w-full h-12 bg-[#1a1a1a] relative z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.8)]">
              <div className="absolute top-0 w-full h-2 bg-gradient-to-b from-[#555] to-[#222] border-t border-white/20"></div>
              <div className="w-full h-full bg-gradient-to-b from-[#222] to-black opacity-90"></div>
              <div className="absolute top-4 w-full text-center">
                <span className="text-[#666] text-[9px] font-bold uppercase tracking-[0.3em] text-shadow-sm">
                  {selectedCard ? '✓ Card Selected' : 'Select a Card'}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`.clip-path-trapezoid { clip-path: polygon(0 0, 100% 0, 85% 100%, 15% 100%); }`}</style>
    </div>
  );
};

// PREDICTION BUTTON COMPONENT
const PredictionButton = ({ type, label, logo, odds, isSelected, isLocked, onClick }) => {
  const potentialReward = Math.floor(parseFloat(odds) * 100);

  return (
    <button
      onClick={onClick}
      disabled={isLocked}
      className={`relative h-20 w-full rounded-xl overflow-hidden transition-all duration-300 ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer active:scale-98'
        } ${isSelected ? 'ring-4 ring-yellow-400 shadow-[0_0_30px_rgba(251,191,36,0.8)]' : ''}`}
    >
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src={isSelected ? '/matchbutton_selected.jpg' : '/matchbutton_default.jpg'}
          alt="Button Background"
          className="w-full h-full object-cover"
        />
        <div className={`absolute inset-0 ${isSelected ? 'bg-yellow-500/20' : 'bg-black/30'}`}></div>
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex items-center justify-between px-4">
        {/* Left: Logo or Icon */}
        <div className="flex items-center gap-3">
          {logo ? (
            <img src={logo} alt={label} className="w-10 h-10 object-contain drop-shadow-lg" />
          ) : (
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-white font-black text-xl">=</span>
            </div>
          )}
          <div className="text-left">
            <p className={`font-black text-sm uppercase tracking-wide ${isSelected ? 'text-yellow-300' : 'text-white'}`}>
              {label}
            </p>
            <p className="text-gray-300 text-xs">Odds: {parseFloat(odds).toFixed(2)}x</p>
          </div>
        </div>

        {/* Right: Reward */}
        <div className="text-right">
          <p className={`font-black text-2xl ${isSelected ? 'text-yellow-300' : 'text-white'}`}>
            {potentialReward}
          </p>
          <p className="text-gray-300 text-xs uppercase">Coins</p>
        </div>
      </div>
    </button>
  );
};

export default MatchDetail;