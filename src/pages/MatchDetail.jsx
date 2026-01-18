import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Loader2, Lock, TrendingUp, CheckCircle } from 'lucide-react';
import { useGame } from '../context/GameContext';

const MatchDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userProfile, loading: gameLoading, supabase } = useGame();

  const [match, setMatch] = useState(null);
  const [odds, setOdds] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // PREDICTION FLOW STATE
  const [selectedCard, setSelectedCard] = useState(null);
  const [draftPrediction, setDraftPrediction] = useState(null);
  const [isDeckOpen, setIsDeckOpen] = useState(true);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

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

  // Real odds will be fetched from API

  // FETCH MATCH DATA & ODDS
  useEffect(() => {
    const fetchMatchDetail = async () => {
      try {
        setLoading(true);

        console.log('🎯 [MatchDetail] Fetching data for fixture:', id);

        // Fetch match data and odds in parallel
        const [matchRes, oddsRes] = await Promise.all([
          fetch(`/api/matches?id=${id}`),
          fetch(`/api/odds?fixture=${id}`)
        ]);

        if (!matchRes.ok) throw new Error("Match unavailable");

        const matchData = await matchRes.json();
        const oddsData = await oddsRes.json();

        console.log('📊 [MatchDetail] Raw odds response:', oddsData);
        console.log('📊 [MatchDetail] Odds object:', oddsData.odds);

        if (matchData.response && matchData.response.length > 0) {
          setMatch(matchData.response[0]);

          // Safety check: ensure oddsData.odds exists, otherwise default to 2.0
          const finalOdds = oddsData.odds || { home: 2.0, draw: 3.0, away: 2.0 };
          console.log('✅ [MatchDetail] Setting odds:', finalOdds);
          setOdds(finalOdds);
        } else {
          throw new Error("Match not found");
        }
      } catch (err) {
        console.error("❌ [MatchDetail] Error:", err);
        setError("Could not retrieve match intelligence.");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchMatchDetail();
  }, [id]);

  // CARD SELECTION HANDLER WITH TOGGLE
  const handleCardSelect = (cardId) => {
    if (getCardCount(cardId) === 0) return; // Can't select cards you don't have
    if (cardId !== 'c_match_result') return; // Only Match Result cards work for now

    // TOGGLE LOGIC: If clicking the same card, deselect it
    if (selectedCard === cardId) {
      setSelectedCard(null);
      setDraftPrediction(null);
    } else {
      setSelectedCard(cardId);
      setDraftPrediction(null); // Clear any existing draft
    }
  };

  // PREDICTION SELECTION HANDLER WITH TOGGLE
  const handlePredictionSelect = (type) => {
    if (!selectedCard) return; // Must select a card first
    if (!hasMatchResultCard()) return; // Must have the card

    // TOGGLE LOGIC: If clicking the same prediction, cancel it
    if (draftPrediction?.type === type) {
      setDraftPrediction(null);
      setIsDeckOpen(true);
      return;
    }

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

  // BACKDROP CLICK HANDLER - Cancel prediction
  const handleBackdropClick = () => {
    setDraftPrediction(null);
    setIsDeckOpen(true);
  };

  // GET DISPLAY NAME FOR PREDICTION
  const getPredictionDisplayName = () => {
    if (!draftPrediction || !match) return '';

    switch (draftPrediction.type) {
      case 'HOME_WIN':
        return `${match.teams.home.name} Win`;
      case 'AWAY_WIN':
        return `${match.teams.away.name} Win`;
      case 'DRAW':
        return 'Draw';
      default:
        return draftPrediction.type;
    }
  };

  // PLAY PREDICTION HANDLER - Complete Bet Placement
  const handlePlayPrediction = async () => {
    console.log('🎯 PLAYING PREDICTION:', draftPrediction);

    try {
      // 1. Inventory Check: Verify user has a Match Result card
      if (!hasMatchResultCard()) {
        alert('❌ No Match Result card available!');
        return;
      }

      // 2. Determine team name based on selection
      let teamName = '';
      if (draftPrediction.type === 'HOME_WIN') {
        teamName = `${match.teams.home.name} vs ${match.teams.away.name}`;
      } else if (draftPrediction.type === 'AWAY_WIN') {
        teamName = `${match.teams.home.name} vs ${match.teams.away.name}`;
      } else if (draftPrediction.type === 'DRAW') {
        teamName = `${match.teams.home.name} vs ${match.teams.away.name}`;
      }

      // 3. Database Insert: Create prediction
      const { data: insertData, error: insertError } = await supabase
        .from('predictions')
        .insert({
          user_id: userProfile.id,
          match_id: match.fixture.id,
          team_name: teamName,
          selection: draftPrediction.type,
          odds: parseFloat(draftPrediction.odds),
          stake: draftPrediction.stake,
          potential_reward: draftPrediction.potentialReward,
          status: 'PENDING'
        });

      if (insertError) {
        console.error('Database insert error:', insertError);
        alert('❌ Failed to place bet. Please try again.');
        return;
      }

      // 4. Card Consumption: Remove one c_match_result from inventory
      const updatedInventory = [...userProfile.inventory];
      const cardIndex = updatedInventory.indexOf('c_match_result');
      if (cardIndex > -1) {
        updatedInventory.splice(cardIndex, 1);
      }

      // Update inventory in database
      const { error: inventoryError } = await supabase
        .from('inventory')
        .delete()
        .eq('user_id', userProfile.id)
        .eq('card_id', 'c_match_result')
        .limit(1);

      if (inventoryError) {
        console.error('Inventory update error:', inventoryError);
        // Continue anyway - bet is placed
      }

      // 5. UI Feedback: Show success modal
      console.log('✅ Bet placed successfully!');
      setShowSuccessModal(true);

    } catch (error) {
      console.error('Error placing bet:', error);
      alert('❌ An error occurred. Please try again.');
    }
  };

  // CLOSE SUCCESS MODAL AND NAVIGATE
  const handleContinue = () => {
    setShowSuccessModal(false);
    setDraftPrediction(null);
    setSelectedCard(null);
    setIsDeckOpen(true);
    navigate('/match-hub');
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

      {/* 1. HERO BACKGROUND - The Tunnel */}
      <div className="absolute inset-0 z-0">
        <img
          src="/bg-tunnel.webp"
          alt="Tunnel Background"
          className="w-full h-full object-cover opacity-90"
          onError={(e) => { e.target.onerror = null; e.target.src = "/bg-dugout.webp"; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/50"></div>
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
          {/* 3. COMPACT METALLIC HUD - Versus Header */}
          <div className="absolute top-24 left-0 w-full z-40 px-4">
            <div className="relative h-16 w-full bg-gradient-to-b from-gray-300 via-gray-200 to-gray-100 shadow-[0_8px_20px_rgba(0,0,0,0.6)] flex items-center justify-between px-4 border border-gray-400/50 rounded-lg">
              {/* Home Team */}
              <div className="flex items-center gap-2 w-1/3">
                <img src={match.teams.home.logo} className="w-8 h-8 object-contain drop-shadow-lg" alt="Home" />
                <span className="text-white font-black text-xs uppercase tracking-tight leading-none truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{match.teams.home.name}</span>
              </div>
              {/* Match Timer - Trapezoid */}
              <div className="absolute left-1/2 -translate-x-1/2 -top-2 h-20 w-1/3 pointer-events-none filter drop-shadow-xl">
                <div className="w-full h-full bg-gradient-to-b from-yellow-600 via-yellow-500 to-yellow-600 clip-path-trapezoid flex flex-col items-center justify-center pt-4 border-t-2 border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.5)]">
                  <div className="text-[9px] text-black font-bold uppercase tracking-[0.2em] mb-0.5">KICKOFF</div>
                  <div className="text-black font-black text-sm leading-none uppercase">{formatDate(match.fixture.date)}</div>
                  <div className="text-base text-black font-mono leading-none tracking-widest mt-0.5">{formatTime(match.fixture.date)}</div>
                </div>
              </div>
              {/* Away Team */}
              <div className="flex items-center justify-end gap-2 w-1/3">
                <span className="text-white font-black text-xs uppercase tracking-tight leading-none text-right truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{match.teams.away.name}</span>
                <img src={match.teams.away.logo} className="w-8 h-8 object-contain drop-shadow-lg" alt="Away" />
              </div>
            </div>
          </div>

          {/* 4. HIDDEN ACTION LAYER - Holographic Prediction Overlay */}
          {selectedCard && !isLocked && (
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 px-4 w-full max-w-md animate-in fade-in duration-300">
              <div className="bg-gradient-to-b from-blue-900/40 via-purple-900/30 to-blue-900/40 backdrop-blur-md border-2 border-cyan-400/50 shadow-[0_0_50px_rgba(34,211,238,0.4)] rounded-xl p-6">
                {/* Holographic Title */}
                <div className="text-center mb-4">
                  <h3 className="text-cyan-300 font-black text-lg uppercase tracking-wider drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]">Tactical Projection</h3>
                  <div className="h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent mt-2"></div>
                </div>

                {/* Prediction Buttons */}
                <div className="flex flex-col gap-3">
                  {/* HOME WIN */}
                  <PredictionButton
                    type="HOME_WIN"
                    label={`${match.teams.home.name} Win`}
                    logo={match.teams.home.logo}
                    odds={odds.home}
                    isSelected={draftPrediction?.type === 'HOME_WIN'}
                    isLocked={false}
                    onClick={() => handlePredictionSelect('HOME_WIN')}
                  />

                  {/* DRAW */}
                  <PredictionButton
                    type="DRAW"
                    label="Draw"
                    logo={null}
                    odds={odds.draw}
                    isSelected={draftPrediction?.type === 'DRAW'}
                    isLocked={false}
                    onClick={() => handlePredictionSelect('DRAW')}
                  />

                  {/* AWAY WIN */}
                  <PredictionButton
                    type="AWAY_WIN"
                    label={`${match.teams.away.name} Win`}
                    logo={match.teams.away.logo}
                    odds={odds.away}
                    isSelected={draftPrediction?.type === 'AWAY_WIN'}
                    isLocked={false}
                    onClick={() => handlePredictionSelect('AWAY_WIN')}
                  />
                </div>

                {/* Scan Line Effect */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-400/10 to-transparent animate-pulse"></div>
                </div>
              </div>
            </div>
          )}

          {/* LOCKED OVERLAY - Full Screen */}
          {isLocked && (
            <div className="fixed inset-0 backdrop-blur-sm bg-black/60 flex flex-col items-center justify-center z-50">
              <div className="flex flex-col items-center justify-center bg-gray-900/80 p-8 rounded-xl border-2 border-yellow-500/50">
                <Lock className="w-16 h-16 text-yellow-500 mb-4" />
                <p className="text-white font-bold text-xl mb-2">Locked</p>
                <p className="text-gray-300 text-sm mb-6 text-center">You need a Match Result card to make predictions</p>
                <button
                  onClick={() => navigate('/training')}
                  className="px-8 py-3 bg-yellow-500 text-black font-black uppercase rounded-lg hover:bg-yellow-400 transition-all shadow-lg"
                >
                  Get Cards
                </button>
              </div>
            </div>
          )}

          {/* 5. BACKDROP FOR CANCELLATION - z-50 to sit above deck but below queue */}
          {draftPrediction && (
            <div
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={handleBackdropClick}
            />
          )}

          {/* 6. CARDS TO BE PLAYED PANEL - z-[55] to sit above backdrop */}
          {draftPrediction && (
            <div className="fixed bottom-36 left-0 w-full z-[55] px-4">
              <div className="bg-gradient-to-b from-gray-900 to-black border-2 border-yellow-500 rounded-xl p-4 shadow-[0_0_30px_rgba(234,179,8,0.5)]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-6 h-6 text-yellow-400" />
                    <div>
                      <p className="text-white font-black text-sm uppercase">{getPredictionDisplayName()}</p>
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
                  className="w-full min-h-[48px] py-3 bg-green-600 hover:bg-green-500 text-white font-black uppercase rounded-lg transition-all active:scale-95 shadow-lg"
                >
                  ⚡ PLAY PREDICTION
                </button>
              </div>
            </div>
          )}

          {/* 7. CARD DECK PANEL - Bottom Bar */}
          <div className="fixed bottom-0 w-full z-30">
            <div className="bg-black/80 backdrop-blur-md border-t-2 border-yellow-600 py-4 px-4">
              {/* Deck Title */}
              <div className="text-center mb-3">
                <h3 className="text-yellow-500 font-black text-xs uppercase tracking-[0.2em]">Your Card Deck</h3>
              </div>

              {/* Cards */}
              <div className="flex justify-center items-end gap-4 overflow-x-auto scrollbar-hide pb-2">
                {cardTypes.map((card) => {
                  const count = getCardCount(card.id);
                  const isActive = count > 0;
                  const isSelected = selectedCard === card.id;
                  return (
                    <button
                      key={card.id}
                      onClick={() => handleCardSelect(card.id)}
                      disabled={!isActive}
                      className={`group relative flex flex-col items-center gap-1 transition-all duration-300 flex-shrink-0 ${isActive ? 'opacity-100 hover:-translate-y-2 cursor-pointer' : 'opacity-40 grayscale cursor-not-allowed'
                        } ${isSelected ? 'ring-4 ring-yellow-400 rounded-lg shadow-[0_0_20px_rgba(251,191,36,0.6)]' : ''} ${isActive && !isSelected ? 'shadow-[0_0_20px_rgba(234,179,8,0.6)]' : ''
                        }`}
                    >
                      <div className="relative w-20 h-28 rounded-lg transition-all transform origin-bottom">
                        <img src={card.img} alt={card.label} className="w-full h-full object-contain drop-shadow-2xl" onError={handleImageError} />
                        {isActive && (
                          <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-black shadow-lg z-10">{count}</div>
                        )}
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-wider text-center max-w-[5rem] leading-tight ${isActive ? 'text-white' : 'text-gray-500'
                        } drop-shadow-md`}>{card.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* 8. SUCCESS MODAL - z-[60] highest layer */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-8 max-w-sm w-full border-2 border-green-500 shadow-[0_0_50px_rgba(34,197,94,0.5)] animate-in fade-in zoom-in duration-300">

            {/* Success Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-white text-2xl font-black uppercase text-center mb-2">
              Success!
            </h2>

            {/* Message */}
            <p className="text-gray-300 text-center mb-6">
              Prediction Placed:<br />
              <span className="text-yellow-400 font-bold text-lg">
                {getPredictionDisplayName()}
              </span>
              <br />
              for <span className="text-green-400 font-bold">{draftPrediction?.potentialReward} coins</span>!
            </p>

            {/* Continue Button */}
            <button
              onClick={handleContinue}
              className="w-full min-h-[48px] py-3 bg-green-600 hover:bg-green-500 text-white font-black uppercase rounded-lg transition-all active:scale-95 shadow-lg"
            >
              Continue
            </button>
          </div>
        </div>
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
            <img
              src={logo}
              alt={label}
              className="w-10 h-10 shrink-0 object-contain drop-shadow-lg"
            />
          ) : (
            <div className="w-10 h-10 shrink-0 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-white font-black text-xl drop-shadow-md">=</span>
            </div>
          )}
          <div className="text-left">
            <p className={`font-black text-sm uppercase tracking-wide drop-shadow-md ${isSelected ? 'text-yellow-300' : 'text-white'}`}>
              {label}
            </p>
            <p className="text-gray-300 text-xs drop-shadow-sm">Odds: {parseFloat(odds).toFixed(2)}x</p>
          </div>
        </div>

        {/* Right: Reward */}
        <div className="text-right shrink-0">
          <p className={`font-black text-2xl drop-shadow-md ${isSelected ? 'text-yellow-300' : 'text-white'}`}>
            {potentialReward}
          </p>
          <p className="text-gray-300 text-xs uppercase drop-shadow-sm">Coins</p>
        </div>
      </div>
    </button>
  );
};

export default MatchDetail;