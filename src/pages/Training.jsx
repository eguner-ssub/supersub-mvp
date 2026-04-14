import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../shared/context/GameContext';
import { Zap, HelpCircle, Clock, Loader2, Brain, Trophy, PlayCircle, CheckCircle, XCircle, Timer, Star } from 'lucide-react';
import MobileLayout from '../shared/ui/MobileLayout';
import AdOverlay from '../components/AdOverlay';
import GameHeader from '../shared/ui/GameHeader';
import gameData from '../data/gameData.json';

const TIMER_SECONDS = 10;
const SESSION_CAP   = 4;

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
  } = useGame();
  const navigate = useNavigate();

  const [phase, setPhase]               = useState('briefing');
  const [questions, setQuestions]       = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswered, setIsAnswered]     = useState(false);
  const [score, setScore]               = useState(0);
  const [showAd, setShowAd]             = useState(false);
  const [showReward, setShowReward]     = useState(false);
  const [capToast, setCapToast]         = useState(false);
  const [timeLeft, setTimeLeft]         = useState(TIMER_SECONDS);
  const [earnedReward, setEarnedReward] = useState(null); // set after last question answered
  const [showCapMessage, setShowCapMessage] = useState(false);
  const [josebaToast, setJosebaToast]             = useState(false);
  const [josebaToastMessage, setJosebaToastMessage] = useState('');

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
    if (index === questions[currentQIndex].correctIndex) {
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
        <GameHeader />
        <MobileLayout bgImage="/bg-training-brief.webp">
          <div className="w-full max-w-md h-full flex flex-col justify-center px-5 py-6 pt-24">

            <div className="bg-black/85 backdrop-blur-md border border-white/10 rounded-2xl p-7 shadow-2xl">
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
                <StatTile icon={<Timer className="w-5 h-5 text-blue-400" />} label="Sessions" value={`${trainingSessionsToday}/${SESSION_CAP}`} valueColor={isCapReached ? 'text-red-400' : 'text-white'} />
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
                <button
                  onClick={handleStartSession}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black rounded-xl text-lg tracking-widest uppercase transition-all shadow-lg border-b-4 border-emerald-800"
                >
                  Start Session
                </button>
              )}
            </div>
          </div>
        </MobileLayout>

        {showAd && <AdOverlay onReward={handleAdReward} onClose={() => setShowAd(false)} />}
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     PHASE: COMPLETE
  ══════════════════════════════════════════════════════════════ */
  if (phase === 'complete') {
    return (
      <div className="relative min-h-screen">
        <GameHeader />
        <MobileLayout bgImage="/bg-training-quiz.webp">
          <div className="h-full flex flex-col items-center justify-center p-5 relative z-50">
            <div className="w-full max-w-md bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl p-7 border border-gray-700 text-center relative overflow-hidden">
              {/* Top accent bar */}
              <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500" />

              {/* Trophy */}
              <div className="mb-5 inline-block p-4 rounded-full bg-yellow-500/10 border border-yellow-500/30">
                <Trophy className="w-14 h-14 text-yellow-400 animate-bounce" />
              </div>
              <h2 className="text-3xl font-black text-white mb-1 uppercase tracking-wide">Session Clear!</h2>
              <p className="text-gray-400 text-sm mb-6">
                {score === 10 ? 'Perfect score! Outstanding.' : score >= 7 ? 'Excellent work, manager.' : 'Not bad, manager. Keep training.'}
              </p>

              {/* Score + Rewards */}
              <div className="bg-gray-800/80 rounded-xl p-4 mb-5 border border-gray-700 space-y-3">
                {/* Score row */}
                <div className="flex justify-between items-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">Score</p>
                  <p className="text-2xl font-black text-white">
                    {score}<span className="text-gray-600 text-base font-normal">/10</span>
                  </p>
                </div>

                <div className="border-t border-gray-700/60" />

                {/* Rewards */}
                <div className="flex justify-between items-start">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest pt-0.5">Earned</p>
                  <div className="flex flex-col items-end gap-1.5">
                    {earnedReward ? (
                      <>
                        <RewardBadge icon="🏆" label={`Match Result ×${earnedReward.commonCount}`} color="text-blue-400" border="border-blue-500/40" bg="bg-blue-500/10" />
                        {earnedReward.hasSupersub && (
                          <RewardBadge icon="⚡" label="Super Sub ×1" color="text-cyan-400" border="border-cyan-500/40" bg="bg-cyan-500/10" />
                        )}
                        {earnedReward.hasDrink && (
                          <RewardBadge icon="🧃" label="Energy Drink ×1" color="text-yellow-400" border="border-yellow-500/40" bg="bg-yellow-500/10" />
                        )}
                      </>
                    ) : (
                      <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={handleFinish}
                className="w-full py-4 font-black rounded-xl text-lg uppercase tracking-widest transition-all shadow-lg active:scale-95 border-b-4 cursor-pointer bg-yellow-500 hover:bg-yellow-400 text-black border-yellow-700"
              >
                Continue
              </button>
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
        <div className="flex flex-col h-full relative p-4 pt-20 max-w-md mx-auto">

          {/* ── Top bar: question counter + timer ── */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full border border-white/10">
              <span className="text-[10px] text-gray-400 uppercase tracking-widest">Question</span>
              <span className="text-white font-bold text-sm">
                {currentQIndex + 1}<span className="text-gray-500">/10</span>
              </span>
            </div>

            {/* Countdown pill */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors duration-300 ${timerBg}`}>
              <Clock className={`w-3.5 h-3.5 ${timerColor}`} />
              <span className={`font-black text-sm font-mono tabular-nums w-5 text-center ${timerColor}`}>
                {timeLeft}
              </span>
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 bg-black/50 rounded-full text-gray-400 hover:text-white border border-white/10 active:scale-95"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          {/* ── Score HUD ── */}
          <ScoreHUD score={score} currentQIndex={currentQIndex} />

          {/* ── Category + difficulty tags ── */}
          <div className="flex gap-2 mb-4">
            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-blue-900/30 text-blue-300 border border-blue-500/30 uppercase tracking-wider">
              {currentQuestion.category}
            </span>
            {currentQuestion.difficulty && (
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getDifficultyColor(currentQuestion.difficulty)}`}>
                {currentQuestion.difficulty}
              </span>
            )}
          </div>

          {/* ── Question text ── */}
          <h2 className="text-xl font-bold text-white mb-6 leading-snug drop-shadow-md">
            {currentQuestion.text}
          </h2>

          {/* ── Answer options ── */}
          <div className="grid gap-3 flex-1">
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
                  className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 shadow-md active:scale-[0.98] ${btnClass}`}
                >
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-sm leading-snug">{option}</span>
                    {rightIcon}
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── Timeout message ── */}
          {isAnswered && selectedOption === -1 && (
            <div className="mt-3 text-center text-red-400 text-xs font-bold uppercase tracking-widest animate-in fade-in">
              ⏱ Time's up!
            </div>
          )}

          {/* ── Progress bar ── */}
          <div className="mt-5 mb-2">
            <div className="w-full bg-gray-800/50 rounded-full h-1 overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${((currentQIndex + 1) / 10) * 100}%` }}
              />
            </div>
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

/* ─── Reward badge used on complete screen ───────────────────────────────── */
const RewardBadge = ({ icon, label, color, border, bg }) => (
  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border ${bg} ${border}`}>
    <span className="text-base">{icon}</span>
    <span className={`font-black text-sm ${color}`}>{label}</span>
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
