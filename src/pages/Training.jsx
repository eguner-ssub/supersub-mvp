import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { ArrowLeft, CheckCircle, XCircle, Zap, HelpCircle, Clock, Loader2, Brain, Trophy } from 'lucide-react';
import MobileLayout from '../components/MobileLayout';
import gameData from '../data/gameData.json';

const Training = () => {
  // FIX 1: Replaced 'addCard' with 'updateInventory'
  const { userProfile, spendEnergy, updateInventory, loading } = useGame(); 
  const navigate = useNavigate();
  
  const [phase, setPhase] = useState('briefing'); 
  const [questions, setQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);

  // --- 1. INITIALIZATION & BALANCING ENGINE ---
  useEffect(() => {
    // Wait for loading to finish first
    if (loading) return;

    // NOW check profile. If still null, kick out.
    if (!userProfile) {
      navigate('/dashboard'); 
      return;
    }

    if (gameData && gameData.trainingQuestions) {
      const allQuestions = gameData.trainingQuestions;
      const hardPool = allQuestions.filter(q => ['Hard', 'Legendary'].includes(q.difficulty));
      const normalPool = allQuestions.filter(q => !['Hard', 'Legendary'].includes(q.difficulty));
      const shuffle = (array) => [...array].sort(() => Math.random() - 0.5);
      const selectedHard = shuffle(hardPool).slice(0, 1);
      const neededNormal = 5 - selectedHard.length;
      const selectedNormal = shuffle(normalPool).slice(0, neededNormal);
      const sessionDeck = shuffle([...selectedHard, ...selectedNormal]);
      setQuestions(sessionDeck);
    }
  }, [userProfile, loading, navigate]);

  const handleStartSession = () => {
    if (userProfile && userProfile.energy > 0) {
      setPhase('quiz');
    }
  };

  const handleOptionClick = (index) => {
    if (isAnswered) return; 

    setSelectedOption(index);
    setIsAnswered(true);

    const currentQuestion = questions[currentQIndex];

    if (index === currentQuestion.correctIndex) {
      setScore(prev => prev + 1);
    }

    setTimeout(() => {
      handleNext();
    }, 1500);
  };

  const handleNext = () => {
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setPhase('complete');
    }
  };

  const handleFinish = () => {
    if (score >= 3) {
      // FIX 2: Use correct function name AND pass as an array
      // updateInventory expects an array of strings ['c_match_result', ...]
      updateInventory(['c_match_result']); 
    }
    
    try {
      spendEnergy(1);
    } catch (e) {
      console.error("Energy spend failed", e);
    }
    
    navigate('/dashboard');
  };

  const getDifficultyColor = (diff) => {
    switch (diff) {
      case 'Easy': return 'text-green-400 border-green-400/30 bg-green-400/10';
      case 'Medium': return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10';
      case 'Hard': return 'text-orange-500 border-orange-500/30 bg-orange-500/10';
      case 'Legendary': return 'text-purple-400 border-purple-400/30 bg-purple-400/10';
      default: return 'text-gray-400';
    }
  };

  // --- SAFETY SHIELD: LOADING ---
  if (loading) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  // Fallback for null profile (should be caught by useEffect, but good for safety)
  if (!userProfile) return null;

  // --- RENDER: BRIEFING ---
  if (phase === 'briefing') {
    const hasEnergy = userProfile.energy > 0;
    return (
      <MobileLayout bgImage="/bg-training-brief.webp">
        <div className="w-full max-w-md h-full flex flex-col justify-center p-6 relative">
          <button onClick={() => navigate('/dashboard')} className="absolute top-6 left-4 flex items-center gap-2 text-gray-300 hover:text-white z-50">
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-emerald-500/20 rounded-full border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]"><Brain className="w-10 h-10 text-emerald-400" /></div>
            </div>
            <h1 className="text-3xl font-black text-white mb-2 text-center uppercase tracking-wide">Training Camp</h1>
            <p className="text-gray-400 mb-8 text-center text-sm">Answer 3 out of 5 correctly to earn a <span className="text-yellow-400 font-bold">Match Card</span>.</p>
            <div className="grid grid-cols-3 gap-3 mb-8">
              <div className="bg-gray-900/50 border border-white/10 rounded-lg p-3 text-center">
                <Zap className={`w-5 h-5 mx-auto mb-1 ${hasEnergy ? 'text-yellow-400' : 'text-red-500'}`} />
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Cost</p>
                <p className={`font-bold ${hasEnergy ? 'text-white' : 'text-red-500'}`}>1 Energy</p>
              </div>
              <div className="bg-gray-900/50 border border-white/10 rounded-lg p-3 text-center">
                <HelpCircle className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Questions</p>
                <p className="text-white font-bold">5</p>
              </div>
              <div className="bg-gray-900/50 border border-white/10 rounded-lg p-3 text-center">
                <Clock className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Time</p>
                <p className="text-white font-bold">Unlimited</p>
              </div>
            </div>
            {hasEnergy ? (
              <button onClick={handleStartSession} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-lg transition-all shadow-lg active:scale-95 border-b-4 border-emerald-800">START SESSION</button>
            ) : (
              <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4 text-center">
                <p className="text-red-400 font-bold mb-1">Low Energy</p>
                <p className="text-xs text-gray-400">Wait for recharge or buy energy.</p>
              </div>
            )}
          </div>
        </div>
      </MobileLayout>
    );
  }

  // --- RENDER: COMPLETE ---
  if (phase === 'complete') {
    const passed = score >= 3;
    return (
      <MobileLayout bgImage="/bg-training-quiz.webp">
        <div className="h-full flex flex-col items-center justify-center p-6 relative z-50">
          <div className="w-full max-w-md bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-gray-700 text-center relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-full h-2 ${passed ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
            {passed ? (
              <>
                <div className="mb-6 inline-block p-4 rounded-full bg-yellow-500/10 border border-yellow-500/30"><Trophy className="w-16 h-16 text-yellow-400 animate-bounce" /></div>
                <h2 className="text-3xl font-black text-white mb-2">SESSION CLEAR!</h2>
                <p className="text-gray-400 mb-6">Excellent work, manager.</p>
                <div className="bg-gray-800 rounded-xl p-4 mb-6 border border-gray-700 flex justify-between items-center">
                   <div className="text-left"><p className="text-xs text-gray-500 uppercase">Score</p><p className="text-2xl font-bold text-white">{score}/5</p></div>
                   <div className="text-right"><p className="text-xs text-gray-500 uppercase">Reward</p><p className="text-emerald-400 font-bold text-lg">+1 Card</p></div>
                </div>
              </>
            ) : (
              <>
                <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">SESSION FAILED</h2>
                <p className="text-gray-400 mb-6">You need 3 correct answers to pass.</p>
                <p className="text-5xl font-black text-white/20 mb-6">{score}/5</p>
              </>
            )}
            <button onClick={handleFinish} className={`w-full py-4 font-bold rounded-xl text-lg transition-all shadow-lg active:scale-95 border-b-4 cursor-pointer relative z-50 ${passed ? 'bg-yellow-500 hover:bg-yellow-400 text-black border-yellow-700' : 'bg-gray-700 hover:bg-gray-600 text-white border-gray-900'}`}>CONTINUE</button>
          </div>
        </div>
      </MobileLayout>
    );
  }

  // --- RENDER: QUIZ ---
  if (questions.length === 0) return <div className="text-white text-center pt-20">Loading Data...</div>;
  const currentQuestion = questions[currentQIndex];

  return (
    <MobileLayout bgImage="/bg-training-quiz.webp">
      <div className="flex flex-col h-full relative p-4 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-8 mt-4">
          <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-full border border-white/10">
            <span className="text-xs text-gray-400 uppercase tracking-widest">Question</span>
            <span className="text-white font-bold">{currentQIndex + 1}<span className="text-gray-500">/5</span></span>
          </div>
          <button onClick={() => navigate('/dashboard')} className="p-2 bg-black/40 rounded-full text-gray-400 hover:text-white border border-white/10"><XCircle className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 flex flex-col">
          <div className="flex gap-2 mb-4">
            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-blue-900/30 text-blue-300 border border-blue-500/30 uppercase tracking-wider">{currentQuestion.category}</span>
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getDifficultyColor(currentQuestion.difficulty)}`}>{currentQuestion.difficulty}</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-8 leading-snug drop-shadow-md">{currentQuestion.text}</h2>
          <div className="grid gap-3">
            {currentQuestion.options.map((option, index) => {
              let btnStyle = "bg-gray-800/80 border-gray-600 text-gray-200 hover:bg-gray-700 hover:border-gray-500";
              if (isAnswered) {
                if (index === currentQuestion.correctIndex) btnStyle = "bg-emerald-500/20 border-emerald-500 text-emerald-400 font-bold"; 
                else if (index === selectedOption) btnStyle = "bg-red-500/20 border-red-500 text-red-400"; 
                else btnStyle = "bg-gray-900/50 border-gray-800 text-gray-600 opacity-40"; 
              }
              return (
                <button key={index} onClick={() => handleOptionClick(index)} disabled={isAnswered} className={`relative p-5 rounded-xl border-2 text-left transition-all duration-200 shadow-lg ${btnStyle} active:scale-[0.98]`}>
                  <div className="flex justify-between items-center"><span className="text-sm">{option}</span>{isAnswered && index === currentQuestion.correctIndex && (<CheckCircle className="w-5 h-5 text-emerald-400" />)}{isAnswered && index === selectedOption && index !== currentQuestion.correctIndex && (<XCircle className="w-5 h-5 text-red-400" />)}</div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-6 mb-4">
            <div className="w-full bg-gray-800/50 rounded-full h-1.5 overflow-hidden">
                <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${((currentQIndex + 1) / 5) * 100}%` }}></div>
            </div>
        </div>
      </div>
    </MobileLayout>
  );
};

export default Training;