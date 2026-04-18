import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../shared/context/GameContext';
import { Zap, HelpCircle, Clock, Loader2, Brain, Trophy, PlayCircle, CheckCircle, XCircle, Timer, Star, ArrowLeft } from 'lucide-react';
import MobileLayout from '../shared/ui/MobileLayout';
import AdOverlay from '../components/AdOverlay';
import GameHeader from '../shared/ui/GameHeader';
import JosebaBubble from '../shared/ui/JosebaBubble';
import CardBase from '../shared/ui/CardBase';
import gameData from '../data/gameData.json';

const TIMER_SECONDS = 10;
export const SESSION_CAP = 4;

// Joseba's in-quiz reactions, keyed on the running correct-answer count.
const JOSEBA_REACTIONS = {
  5:  "Not bad, gaffer. Keep it up.",
  7:  "You're on fire!",
  9:  "One more for the perfect score!",
  10: "Unreal. The squad's talking about you.",
};

/**
 * Pure helper — given a running correct count, returns display state for the
 * ScoreHUD: how many cards are currently banked, and the next threshold.
 */
function scoreStatus(score) {
  if (score >= 10) return { cardsEarned: 5, nextAt: null,  nextCards: null, nextBonus: false };
  if (score >= 9)  return { cardsEarned: 4, nextAt: 10,   nextCards: 5,   nextBonus: true  };
  if (score >= 7)  return { cardsEarned: 3, nextAt: 9,    nextCards: 4,   nextBonus: false };
  if (score >= 5)  return { cardsEarned: 2, nextAt: 7,    nextCards: 3,   nextBonus: false };
  return             { cardsEarned: 1, nextAt: 5,    nextCards: 2,   nextBonus: false };
}

const Training = () => {
  const {
    userProfile,
    loading,
    claimAdReward,
    trainingSessionsToday,
    startTrainingSession,
    completeTrainingSession,
    supabase,
  } = useGame();
  const navigate = useNavigate();

  const [phase, setPhase]               = useState('briefing');
  const [questions, setQuestions]       = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswered, setIsAnswered]     = useState(false);
  const [score, setScore]               = useState(0);
  const [answerResults, setAnswerResults] = useState([]); // true = correct
  const [showAd, setShowAd]             = useState(false);
  const [showReward, setShowReward]     = useState(false);
  const [capToast, setCapToast]         = useState(false);
  const [timeLeft, setTimeLeft]         = useState(TIMER_SECONDS);
  const [earnedReward, setEarnedReward] = useState(null); // set after last question answered
  const [showCapMessage, setShowCapMessage] = useState(false);
  const [josebaToast, setJosebaToast]             = useState(false);
  const [josebaToastMessage, setJosebaToastMessage] = useState('');
  const [showTrainingOnboarding, setShowTrainingOnboarding] = useState(false);

  /* ─── Build question deck (10 questions: 2 hard + 8 normal) ──────────── */
  useEffect(() => {
    if (loading) return;
    if (!userProfile) { navigate('/dashboard'); return; }

    if (gameData?.trainingQuestions) {
      const all     = gameData.trainingQuestions;
      const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);
      const hard    = shuffle(all.filter(q => ['Hard', 'Legendary'].includes(q.difficulty))).slice(0, 2);
      const normal  = shuffle(all.filter(q => !['Hard', 'Legendary'].includes(q.difficulty))).slice(0, 10 - hard.length);
      setQuestions(shuffle([...hard, ...normal]));
    }
  }, [userProfile, loading, navigate]);

  /* ─── One-time Joseba briefing bubble ─────────────────────────────────── */
  // Mirrors the Kit Bag onboarding pattern (Inventory.jsx). Default-false column
  // means every existing user sees it once on next visit; tapping the bubble
  // optimistically hides it and writes training_onboarding_seen=true to profiles.
  useEffect(() => {
    if (!userProfile) return;
    if (!userProfile.training_onboarding_seen) {
      setShowTrainingOnboarding(true);
    }
  }, [userProfile]);

  /* ─── Countdown timer ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (phase !== 'quiz' || isAnswered) return;
    if (timeLeft <= 0) {
      setSelectedOption(-1);
      setIsAnswered(true);
      return;
    }
    const t = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, isAnswered, timeLeft]);

  /* ─── Auto-advance after answer ───────────────────────────────────────── */
  useEffect(() => {
    if (!isAnswered) return;
    const t = setTimeout(() => handleNext(), 1500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnswered]);

  /* ─── Handlers ────────────────────────────────────────────────────────── */
  const handleStartSession = async () => {
    const result = await startTrainingSession();
    if (result.success) {
      setAnswerResults([]);
      setTimeLeft(TIMER_SECONDS);
      setPhase('quiz');
    } else if (result.reason === 'cap') {
      setShowCapMessage(true);
    }
    // 'energy' reason: the Watch Ad CTA already handles this path via briefing guard
  };

  const handleOptionClick = (index) => {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);
    const isCorrect = index === questions[currentQIndex].correctIndex;
    setAnswerResults(prev => [...prev, isCorrect]);
    if (isCorrect) {
      const newScore = score + 1;
      setScore(newScore);
      const reaction = JOSEBA_REACTIONS[newScore];
      if (reaction) {
        setJosebaToastMessage(reaction);
        setJosebaToast(true);
        setTimeout(() => setJosebaToast(false), 2500);
      }
    }
  };

  const handleNext = async () => {
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
      setTimeLeft(TIMER_SECONDS);
    } else {
      // Last question — grant rewards then show complete screen
      const reward = await completeTrainingSession(score);
      setEarnedReward(reward);
      setPhase('complete');
    }
  };

  const handleFinish = () => {
    navigate('/dashboard');
  };

  const handleTrainingOnboardingAdvance = async () => {
    setShowTrainingOnboarding(false);
    if (userProfile?.id) {
      await supabase
        .from('profiles')
        .update({ training_onboarding_seen: true })
        .eq('id', userProfile.id);
    }
  };

  const handleAdReward = async () => {
    try {
      await claimAdReward();
      setShowReward(true);
      setTimeout(() => setShowReward(false), 3000);
    } catch (err) {
      if (err.message === 'daily_cap_reached') {
        setCapToast(true);
        setTimeout(() => setCapToast(false), 4000);
      } else {
        console.error('Ad reward failed:', err.message);
      }
    }
  };

  const getDifficultyColor = (diff) => {
    switch (diff) {
      case 'Easy':      return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10';
      case 'Medium':    return 'text-yellow-400  border-yellow-400/30  bg-yellow-400/10';
      case 'Hard':      return 'text-orange-500  border-orange-500/30  bg-orange-500/10';
      case 'Legendary': return 'text-purple-400  border-purple-400/30  bg-purple-400/10';
      default:          return 'text-gray-400';
    }
  };

  const timerColor = timeLeft <= 3 ? 'text-red-400'    : timeLeft <= 6 ? 'text-yellow-400' : 'text-emerald-400';
  const timerBg    = timeLeft <= 3 ? 'bg-red-500/15 border-red-500/40' : timeLeft <= 6 ? 'bg-yellow-500/15 border-yellow-500/40' : 'bg-emerald-500/15 border-emerald-500/40';

  const hasEnergy      = (userProfile?.energy ?? 0) > 0;
  const isCapReached   = trainingSessionsToday >= SESSION_CAP;

  /* ─── Guards ──────────────────────────────────────────────────────────── */
  if (loading) return (
    <div className="w-full h-screen bg-black flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
    </div>
  );
  if (!userProfile) return null;

  /* ══════════════════════════════════════════════════════════════
     PHASE: BRIEFING
  ══════════════════════════════════════════════════════════════ */
  if (phase === 'briefing') {
    return (
      <div className="relative min-h-screen">
        {/* Fixed header bar — replaces GameHeader for briefing */}
        <div className="fixed top-0 left-0 right-0 z-50 h-14 bg-black/80 backdrop-blur-md border-b border-white/10 flex items-center px-4">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 bg-white/10 border border-white/20 rounded-full flex items-center justify-center text-white active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="flex-1 text-center text-[11px] font-black uppercase tracking-widest text-white">
            Training Camp
          </span>
          {/* Right spacer to balance back button */}
          <div className="w-9" />
        </div>

        <MobileLayout bgImage="/bg-training-brief.webp">
          <div className="w-full max-w-md h-full flex flex-col justify-center px-5 py-6 pt-20 pb-40">

            <div className="bg-black/85 backdrop-blur-md border border-white/10 rounded-2xl p-7 shadow-[0_0_40px_rgba(16,185,129,0.15)] relative overflow-hidden">
              {/* Top accent bar */}
              <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500" />

              {/* Icon */}
              <div className="flex justify-center mb-5">
                <div className="p-4 bg-emerald-500/20 rounded-full border border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                  <Brain className="w-10 h-10 text-emerald-400" />
                </div>
              </div>

              {/* Title */}
              <h1 className="text-3xl font-black text-white mb-2 text-center uppercase tracking-wide">
                Training Camp
              </h1>
              <p className="text-gray-400 mb-7 text-center text-sm leading-relaxed">
                Answer football trivia to earn{' '}
                <span className="text-yellow-400 font-bold">Match Cards</span>.
                {' '}4 sessions per day.
              </p>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 mb-7">
                <StatTile icon={<Zap className={`w-5 h-5 ${hasEnergy ? 'text-yellow-400' : 'text-red-500'}`} />} label="Cost" value="1 Energy" valueColor={hasEnergy ? 'text-white' : 'text-red-400'} />
                <StatTile icon={<HelpCircle className="w-5 h-5 text-emerald-400" />} label="Questions" value="10" />
                <StatTile icon={<Timer className="w-5 h-5 text-blue-400" />} label="Today" value={`${trainingSessionsToday} of ${SESSION_CAP} used`} valueColor={isCapReached ? 'text-red-400' : 'text-white'} />
              </div>

              {/* Cap message */}
              {(isCapReached || showCapMessage) ? (
                <div className="w-full py-4 px-5 bg-zinc-800/80 border border-zinc-700 rounded-xl text-center">
                  <p className="text-gray-300 font-bold text-sm leading-snug">
                    You've maxed out training for today.
                  </p>
                  <p className="text-gray-500 text-xs mt-1">Come back tomorrow.</p>
                </div>
              ) : !hasEnergy ? (
                <button
                  onClick={() => setShowAd(true)}
                  className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 active:scale-95 text-white font-bold rounded-xl text-lg transition-all shadow-lg border-b-4 border-green-800 flex items-center justify-center gap-2"
                >
                  <PlayCircle className="w-5 h-5" />
                  Watch Ad (+1 Energy Drink)
                </button>
              ) : (
                <>
                  <button
                    onClick={handleStartSession}
                    disabled={showTrainingOnboarding}
                    className={`w-full py-4 bg-emerald-600 text-white font-black rounded-xl text-lg tracking-widest uppercase transition-all shadow-lg border-b-4 border-emerald-800 ${
                      showTrainingOnboarding
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-emerald-500 active:scale-95'
                    }`}
                  >
                    Start Session
                  </button>
                  {showTrainingOnboarding && (
                    <p className="text-zinc-500 text-xs text-center mt-2">Read Joseba's brief first</p>
                  )}
                </>
              )}
            </div>
          </div>
        </MobileLayout>

        {showAd && <AdOverlay onReward={handleAdReward} onClose={() => setShowAd(false)} />}

        {showTrainingOnboarding && (
          <JosebaBubble
            variant="warm"
            message="Each session is 10 questions — you have 10 seconds per question. Your score determines your card reward: 7+ correct earns 2 cards, a perfect 10 earns 4 cards plus a Supersub and an energy drink. Costs 1 energy to start. Good luck, Boss."
            onAdvance={handleTrainingOnboardingAdvance}
          />
        )}
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     PHASE: COMPLETE
  ══════════════════════════════════════════════════════════════ */
  if (phase === 'complete') {
    const tagline =
      score <= 4 ? "Rough session, Boss. Shake it off and go again." :
      score <= 6 ? "Solid effort. A few more right next time unlocks better rewards." :
      score <= 8 ? "Good session. You've earned yourself some cards." :
      score === 9 ? "Almost perfect. One slip — but still a strong haul." :
                   "Flawless. That's how a manager operates.";

    return (
      <div className="relative min-h-screen">
        <GameHeader />
        <MobileLayout bgImage="/bg-training-quiz.webp">
          {/* Bottom sheet overlay */}
          <div className="fixed inset-0 z-[100]">
            {/* Top dismiss area */}
            <button
              onClick={handleFinish}
              className="absolute top-0 left-0 right-0 h-[15vh] w-full bg-black/60"
              aria-label="Dismiss"
            />

            {/* Sheet */}
            <div className="absolute bottom-0 left-0 right-0 top-[15vh] bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 rounded-t-3xl flex flex-col animate-in slide-in-from-bottom duration-500">
              {/* Drag handle */}
              <div className="w-12 h-1 bg-emerald-500 rounded-full mx-auto mt-3 flex-shrink-0" />

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 pt-6 pb-8 flex flex-col items-center">
                {/* Trophy */}
                <div className="mb-4 p-4 rounded-full bg-yellow-500/10 border border-yellow-500/30">
                  <Trophy className="w-12 h-12 text-yellow-400" />
                </div>

                {/* Title */}
                <h2 className="text-2xl font-black text-white uppercase tracking-wide mb-2">
                  Session Clear!
                </h2>

                {/* Tagline */}
                <p className="text-zinc-400 text-sm text-center mb-6">{tagline}</p>

                {/* Score box */}
                <div className="w-full max-w-xs bg-zinc-800/80 rounded-xl p-4 border border-zinc-700 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Score</span>
                    <span className="text-2xl font-black text-white">
                      {score}<span className="text-zinc-600 text-base font-normal">/10</span>
                    </span>
                  </div>
                </div>

                {/* Rewards row */}
                <div className="flex items-end justify-center gap-4 mb-8">
                  {/* Common card */}
                  {earnedReward && (
                    <div className="relative">
                      <div style={{ transform: 'scale(0.55)', transformOrigin: 'bottom center' }}>
                        <CardBase type="c_match_result" status="generic" />
                      </div>
                      <div className="absolute -top-2 -right-2 z-30">
                        <div className="bg-yellow-500 text-black font-black font-mono text-[10px] px-2 py-0.5 rounded-md border border-black/20 shadow-lg flex items-center gap-0.5">
                          <span>x</span>
                          <span className="text-sm">{earnedReward.commonCount}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Supersub card (if earned) */}
                  {earnedReward?.hasSupersub && (
                    <div className="relative">
                      <div style={{ transform: 'scale(0.55)', transformOrigin: 'bottom center' }}>
                        <CardBase type="c_supersub" status="generic" />
                      </div>
                      <div className="absolute -top-2 -right-2 z-30">
                        <div className="bg-yellow-500 text-black font-black font-mono text-[10px] px-2 py-0.5 rounded-md border border-black/20 shadow-lg flex items-center gap-0.5">
                          <span>x</span>
                          <span className="text-sm">1</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Energy drink (if earned) */}
                  {earnedReward?.hasDrink && (
                    <div className="relative">
                      <div className="w-16 h-24 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
                        <Zap className="w-8 h-8 text-yellow-400 fill-yellow-400" />
                      </div>
                      <div className="absolute -top-2 -right-2 z-30">
                        <div className="bg-yellow-500 text-black font-black font-mono text-[10px] px-2 py-0.5 rounded-md border border-black/20 shadow-lg flex items-center gap-0.5">
                          <span>x</span>
                          <span className="text-sm">1</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Loading state */}
                  {!earnedReward && (
                    <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
                  )}
                </div>

                {/* Continue button */}
                <button
                  onClick={handleFinish}
                  className="w-full max-w-xs py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-widest rounded-xl transition-colors active:scale-95"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </MobileLayout>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     PHASE: QUIZ
  ══════════════════════════════════════════════════════════════ */
  if (questions.length === 0) {
    return (
      <div className="relative min-h-screen">
        <GameHeader />
        <div className="text-white text-center pt-24">Loading…</div>
      </div>
    );
  }

  const currentQuestion = questions[currentQIndex];

  return (
    <div className="relative min-h-screen">
      <GameHeader />
      <MobileLayout bgImage="/bg-training-quiz.webp">
        {/* min-h-screen fallback for browsers without dvh support; h-[100dvh] for modern mobile */}
        <div className="flex flex-col min-h-screen h-[100dvh] max-w-md mx-auto">

          {/* Spacer for GameHeader (~72px) */}
          <div className="h-[72px] flex-shrink-0" />

          {/* ── Status bar: question counter | timer | close ── */}
          <div className="flex justify-between items-center bg-black/60 backdrop-blur-md border-b border-white/10 px-4 py-3 flex-shrink-0">
            {/* Question counter */}
            <div className="flex items-center gap-1.5 bg-black/50 px-3 py-1.5 rounded-full border border-white/10">
              <span className="text-[10px] text-gray-400 uppercase tracking-widest">Question</span>
              <span className="text-white font-bold text-sm">
                {currentQIndex + 1}<span className="text-gray-500">/10</span>
              </span>
            </div>

            {/* Timer pill — larger */}
            <div className={`flex items-center gap-1.5 px-4 py-2 rounded-full border transition-colors duration-300 ${timerBg}`}>
              <Clock className={`w-5 h-5 ${timerColor}`} />
              <span className={`font-black text-lg font-mono tabular-nums w-6 text-center ${timerColor}`}>
                {timeLeft}
              </span>
            </div>

            {/* Close button */}
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 bg-black/50 rounded-full text-gray-400 hover:text-white border border-white/10 active:scale-95"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          {/* ── Content area ── */}
          <div className="flex flex-col flex-1 px-4 pt-3 pb-4 min-h-0 overflow-y-auto">

            {/* Score HUD */}
            <ScoreHUD score={score} currentQIndex={currentQIndex} />

            {/* Step indicators — correct/wrong/current/unanswered */}
            <div className="flex items-center justify-center gap-2 mt-2">
              {Array.from({ length: 10 }).map((_, idx) => {
                const isAnsweredDot = idx < answerResults.length;
                const isCurrentDot  = idx === currentQIndex;
                const wasCorrect    = answerResults[idx];

                let dotClass = 'w-2.5 h-2.5 rounded-full transition-all ';
                if (isCurrentDot) {
                  dotClass += 'w-3 h-3 bg-emerald-400 ring-2 ring-emerald-400/50';
                } else if (isAnsweredDot) {
                  dotClass += wasCorrect ? 'bg-emerald-500' : 'bg-red-500';
                } else {
                  dotClass += 'bg-zinc-700';
                }

                return <div key={idx} className={dotClass} />;
              })}
            </div>

            {/* Category + difficulty tags — hidden on short/narrow viewports */}
            <div className="hidden sm:flex gap-2 mt-3 mb-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-blue-900/30 text-blue-300 border border-blue-500/30 uppercase tracking-wider">
                {currentQuestion.category}
              </span>
              {currentQuestion.difficulty && (
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getDifficultyColor(currentQuestion.difficulty)}`}>
                  {currentQuestion.difficulty}
                </span>
              )}
            </div>

            {/* Question text */}
            <h2 className="text-lg md:text-xl font-bold text-white mb-3 leading-snug drop-shadow-md">
              {currentQuestion.text}
            </h2>

            {/* Answer options */}
            <div className="grid gap-2.5">
              {currentQuestion.options.map((option, index) => {
                let btnClass = 'bg-gray-800/80 border-gray-600/60 text-gray-200 hover:bg-gray-700/80 hover:border-gray-500';
                let rightIcon = null;

                if (isAnswered) {
                  if (index === currentQuestion.correctIndex) {
                    btnClass = 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold';
                    rightIcon = <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />;
                  } else if (index === selectedOption && selectedOption !== -1) {
                    btnClass = 'bg-red-500/20 border-red-500 text-red-400';
                    rightIcon = <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />;
                  } else {
                    btnClass = 'bg-gray-900/40 border-gray-800/50 text-gray-600 opacity-40';
                  }
                }

                return (
                  <button
                    key={`q${currentQIndex}-opt${index}`}
                    onClick={() => handleOptionClick(index)}
                    disabled={isAnswered}
                    className={`relative p-3 md:p-4 rounded-xl border-2 text-left transition-all duration-200 shadow-md active:scale-[0.98] ${btnClass}`}
                  >
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-sm leading-snug">{option}</span>
                      {rightIcon}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Timeout message */}
            {isAnswered && selectedOption === -1 && (
              <div className="mt-3 text-center text-red-400 text-xs font-bold uppercase tracking-widest animate-in fade-in">
                ⏱ Time's up!
              </div>
            )}

          </div>
        </div>
      </MobileLayout>

      {showReward && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-8 shadow-2xl border-4 border-yellow-400 max-w-sm mx-4 animate-in zoom-in duration-500 text-center">
            <div className="mb-4 inline-block p-4 bg-white/20 rounded-full">
              <Zap className="w-14 h-14 text-yellow-300 animate-bounce" />
            </div>
            <h2 className="text-2xl font-black text-white mb-1 uppercase tracking-wide">Energy Drink Earned!</h2>
            <p className="text-yellow-200 text-xl font-bold">+1 Energy Drink</p>
          </div>
        </div>
      )}

      {capToast && (
        <div className="fixed bottom-24 inset-x-4 z-[9999] flex justify-center animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl px-5 py-4 shadow-2xl max-w-sm w-full text-center">
            <p className="text-white font-bold text-sm">🧃 The club physio has run out of energy drinks for today.</p>
          </div>
        </div>
      )}

      {josebaToast && (
        <div className="fixed bottom-24 inset-x-4 z-[9999] flex justify-center animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-zinc-900 border border-emerald-500/30 rounded-2xl px-4 py-3 shadow-2xl max-w-sm w-full flex items-center gap-3">
            <img
              src="/assets/joseba-avatar.webp"
              alt="Joseba"
              className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-white/10"
              onError={(e) => { e.target.src = '/assets/assistant-head.png'; }}
            />
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400 mb-0.5">Joseba</p>
              <p className="text-white font-bold text-sm">{josebaToastMessage}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Stat tile used on briefing screen ──────────────────────────────────── */
const StatTile = ({ icon, label, value, valueColor = 'text-white' }) => (
  <div className="bg-gray-900/60 border border-white/10 rounded-xl p-3 text-center">
    <div className="flex justify-center mb-1">{icon}</div>
    <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
    <p className={`font-bold text-sm ${valueColor}`}>{value}</p>
  </div>
);

/* ─── Live score HUD displayed during the quiz ───────────────────────────── */
const ScoreHUD = ({ score, currentQIndex }) => {
  const isLate = currentQIndex >= 6; // Q7 onward (0-indexed)
  const { cardsEarned, nextAt, nextCards, nextBonus } = scoreStatus(score);
  return (
    <div className="flex items-center justify-between bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2 mb-3">
      <div className="flex items-center gap-2">
        <span className="text-white font-black text-sm tabular-nums">{score}</span>
        <span className="text-gray-500 text-xs">correct</span>
        <span className="text-gray-700 text-xs mx-0.5">·</span>
        <span className="text-blue-400 font-bold text-xs">{cardsEarned} card{cardsEarned !== 1 ? 's' : ''}</span>
      </div>
      {nextAt !== null ? (
        <div className={`flex items-center gap-1 ${isLate ? 'text-yellow-300' : 'text-gray-400'}`}>
          <span className={`${isLate ? 'text-xs font-black' : 'text-[10px] font-medium'}`}>
            Next: {nextCards}{nextBonus ? '+⚡' : ''} at {nextAt}
          </span>
          {isLate && <span className="text-yellow-400 text-[10px]">🔥</span>}
        </div>
      ) : (
        <span className="text-emerald-400 font-black text-xs">Perfect! 🏆</span>
      )}
    </div>
  );
};

export default Training;
