import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../shared/context/GameContext';
import { XCircle, Zap, HelpCircle, Clock, Loader2, Brain, Trophy, PlayCircle, CheckCircle, Timer } from 'lucide-react';
import MobileLayout from '../shared/ui/MobileLayout';
import AdOverlay from '../components/AdOverlay';
import GameHeader from '../shared/ui/GameHeader';
import gameData from '../data/gameData.json';

/* ─── Reward card pool ──────────────────────────────────────────────────── */
const REWARD_CARDS = [
  { id: 'c_match_result', name: 'Match Result', icon: '🏆', color: 'text-blue-400',   border: 'border-blue-500/40',   bg: 'bg-blue-500/10' },
  { id: 'c_total_goals',  name: 'Total Goals',  icon: '⚽', color: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-500/10' },
  { id: 'c_player_score', name: 'Player Score', icon: '⭐', color: 'text-yellow-400',  border: 'border-yellow-500/40', bg: 'bg-yellow-500/10' },
  { id: 'c_supersub',     name: 'Supersub',     icon: '⚡', color: 'text-cyan-400',    border: 'border-cyan-500/40',   bg: 'bg-cyan-500/10' },
];

const TIMER_SECONDS = 10;

const Training = () => {
  const { userProfile, spendEnergy, gainEnergy, updateInventory, loading } = useGame();
  const navigate = useNavigate();

  const [phase, setPhase]                     = useState('briefing');
  const [questions, setQuestions]             = useState([]);
  const [currentQIndex, setCurrentQIndex]     = useState(0);
  const [selectedOption, setSelectedOption]   = useState(null);
  const [isAnswered, setIsAnswered]           = useState(false);
  const [score, setScore]                     = useState(0);
  const [showAd, setShowAd]                   = useState(false);
  const [showReward, setShowReward]           = useState(false);
  const [timeLeft, setTimeLeft]               = useState(TIMER_SECONDS);
  const [wonCard, setWonCard]                 = useState(null); // the card to award on pass

  /* ─── Build question deck ─────────────────────────────────────────────── */
  useEffect(() => {
    if (loading) return;
    if (!userProfile) { navigate('/dashboard'); return; }

    if (gameData?.trainingQuestions) {
      const all = gameData.trainingQuestions;
      const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);
      const hard   = shuffle(all.filter(q => ['Hard', 'Legendary'].includes(q.difficulty))).slice(0, 1);
      const normal = shuffle(all.filter(q => !['Hard', 'Legendary'].includes(q.difficulty))).slice(0, 5 - hard.length);
      setQuestions(shuffle([...hard, ...normal]));
    }
  }, [userProfile, loading, navigate]);

  /* ─── Countdown timer ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (phase !== 'quiz' || isAnswered) return;

    if (timeLeft <= 0) {
      // Auto-fail: no option selected, show correct answer, advance
      setSelectedOption(-1);
      setIsAnswered(true);
      return;
    }

    const t = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, isAnswered, timeLeft]);

  /* ─── Auto-advance after answer (click OR timeout) ────────────────────── */
  useEffect(() => {
    if (!isAnswered) return;
    const t = setTimeout(() => handleNext(), 1500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnswered]);

  /* ─── Handlers ────────────────────────────────────────────────────────── */
  const handleStartSession = () => {
    if (userProfile?.energy > 0) {
      const card = REWARD_CARDS[Math.floor(Math.random() * REWARD_CARDS.length)];
      setWonCard(card);
      setTimeLeft(TIMER_SECONDS);
      setPhase('quiz');
    }
  };

  const handleOptionClick = (index) => {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);
    if (index === questions[currentQIndex].correctIndex) {
      setScore(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
      setTimeLeft(TIMER_SECONDS);
    } else {
      setPhase('complete');
    }
  };

  const handleFinish = async () => {
    if (score >= 3 && wonCard) {
      await updateInventory([wonCard.id]);
    }
    try { spendEnergy(1); } catch (e) { console.error('Energy spend failed', e); }
    navigate('/dashboard');
  };

  const handleAdReward = async () => {
    try {
      await gainEnergy(3);
      setShowAd(false);
      setShowReward(true);
      setTimeout(() => setShowReward(false), 3000);
    } catch {
      alert('Failed to grant reward. Please try again.');
      setShowAd(false);
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

  /* ─── Timer colour cue ────────────────────────────────────────────────── */
  const timerColor = timeLeft <= 3 ? 'text-red-400'    : timeLeft <= 6 ? 'text-yellow-400' : 'text-emerald-400';
  const timerBg    = timeLeft <= 3 ? 'bg-red-500/15 border-red-500/40' : timeLeft <= 6 ? 'bg-yellow-500/15 border-yellow-500/40' : 'bg-emerald-500/15 border-emerald-500/40';

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
    const hasEnergy = userProfile.energy > 0;
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
                Answer 3 out of 5 correctly to earn a{' '}
                <span className="text-yellow-400 font-bold">Match Card</span>.
              </p>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 mb-7">
                <StatTile icon={<Zap className={`w-5 h-5 ${hasEnergy ? 'text-yellow-400' : 'text-red-500'}`} />} label="Cost" value="1 Energy" valueColor={hasEnergy ? 'text-white' : 'text-red-400'} />
                <StatTile icon={<HelpCircle className="w-5 h-5 text-emerald-400" />} label="Questions" value="5" />
                <StatTile icon={<Timer className="w-5 h-5 text-blue-400" />} label="Time" value="10 sec" valueColor="text-blue-300" />
              </div>

              {/* CTA */}
              {hasEnergy ? (
                <button
                  onClick={handleStartSession}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black rounded-xl text-lg tracking-widest uppercase transition-all shadow-lg border-b-4 border-emerald-800"
                >
                  Start Session
                </button>
              ) : (
                <button
                  onClick={() => setShowAd(true)}
                  className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 active:scale-95 text-white font-bold rounded-xl text-lg transition-all shadow-lg border-b-4 border-green-800 flex items-center justify-center gap-2"
                >
                  <PlayCircle className="w-5 h-5" />
                  Watch Ad (+3 Energy)
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
    const passed = score >= 3;
    return (
      <div className="relative min-h-screen">
        <GameHeader />
        <MobileLayout bgImage="/bg-training-quiz.webp">
          <div className="h-full flex flex-col items-center justify-center p-5 relative z-50">
            <div className="w-full max-w-md bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl p-7 border border-gray-700 text-center relative overflow-hidden">
              {/* Top accent bar */}
              <div className={`absolute top-0 left-0 w-full h-1.5 ${passed ? 'bg-emerald-500' : 'bg-red-500'}`} />

              {passed ? (
                <>
                  {/* Trophy */}
                  <div className="mb-5 inline-block p-4 rounded-full bg-yellow-500/10 border border-yellow-500/30">
                    <Trophy className="w-14 h-14 text-yellow-400 animate-bounce" />
                  </div>
                  <h2 className="text-3xl font-black text-white mb-1 uppercase tracking-wide">Session Clear!</h2>
                  <p className="text-gray-400 text-sm mb-6">Excellent work, manager.</p>

                  {/* Score + Reward */}
                  <div className="bg-gray-800/80 rounded-xl p-4 mb-5 border border-gray-700 flex justify-between items-center">
                    <div className="text-left">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">Score</p>
                      <p className="text-2xl font-black text-white">{score}<span className="text-gray-600 text-base font-normal">/5</span></p>
                    </div>
                    <div className="w-px h-10 bg-white/10" />
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">Reward</p>
                      {wonCard ? (
                        <div className={`flex items-center justify-end gap-1.5 px-3 py-1 rounded-lg border ${wonCard.bg} ${wonCard.border}`}>
                          <span className="text-base">{wonCard.icon}</span>
                          <span className={`font-black text-sm ${wonCard.color}`}>{wonCard.name}</span>
                        </div>
                      ) : (
                        <p className="text-emerald-400 font-bold text-sm">+1 Card</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4 mt-2" />
                  <h2 className="text-2xl font-black text-white mb-2 uppercase">Session Failed</h2>
                  <p className="text-gray-400 text-sm mb-4">You need 3 correct answers to pass.</p>
                  <p className="text-5xl font-black text-white/15 mb-6">{score}/5</p>
                </>
              )}

              <button
                onClick={handleFinish}
                className={`w-full py-4 font-black rounded-xl text-lg uppercase tracking-widest transition-all shadow-lg active:scale-95 border-b-4 cursor-pointer ${
                  passed
                    ? 'bg-yellow-500 hover:bg-yellow-400 text-black border-yellow-700'
                    : 'bg-gray-700 hover:bg-gray-600 text-white border-gray-900'
                }`}
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
                {currentQIndex + 1}<span className="text-gray-500">/5</span>
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

          {/* ── Category + difficulty tags ── */}
          <div className="flex gap-2 mb-4">
            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-blue-900/30 text-blue-300 border border-blue-500/30 uppercase tracking-wider">
              {currentQuestion.category}
            </span>
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getDifficultyColor(currentQuestion.difficulty)}`}>
              {currentQuestion.difficulty}
            </span>
          </div>

          {/* ── Question text ── */}
          <h2 className="text-xl font-bold text-white mb-6 leading-snug drop-shadow-md">
            {currentQuestion.text}
          </h2>

          {/* ── Answer options ──
               Key includes currentQIndex so React fully re-mounts buttons on question change,
               clearing any stale hover/active/focus state from the previous question. ── */}
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
                style={{ width: `${((currentQIndex + 1) / 5) * 100}%` }}
              />
            </div>
          </div>

        </div>
      </MobileLayout>

      {showAd && <AdOverlay onReward={handleAdReward} onClose={() => setShowAd(false)} />}

      {showReward && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-8 shadow-2xl border-4 border-yellow-400 max-w-sm mx-4 animate-in zoom-in duration-500 text-center">
            <div className="mb-4 inline-block p-4 bg-white/20 rounded-full">
              <Zap className="w-14 h-14 text-yellow-300 animate-bounce" />
            </div>
            <h2 className="text-2xl font-black text-white mb-1 uppercase tracking-wide">Energy Recharged!</h2>
            <p className="text-yellow-200 text-xl font-bold">+3 Energy</p>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Small stat tile used on briefing screen ─────────────────────────────── */
const StatTile = ({ icon, label, value, valueColor = 'text-white' }) => (
  <div className="bg-gray-900/60 border border-white/10 rounded-xl p-3 text-center">
    <div className="flex justify-center mb-1">{icon}</div>
    <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
    <p className={`font-bold text-sm ${valueColor}`}>{value}</p>
  </div>
);

export default Training;
