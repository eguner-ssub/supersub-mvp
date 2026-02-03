import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CardBase from '../../shared/ui/CardBase';

const TacticalBoardCarousel = ({ bets = [] }) => {
    const navigate = useNavigate();
    const [currentIndex, setCurrentIndex] = useState(0);

    if (!bets || bets.length === 0) return null;

    const nextSlide = () => setCurrentIndex((prev) => (prev === bets.length - 1 ? 0 : prev + 1));
    const prevSlide = () => setCurrentIndex((prev) => (prev === 0 ? bets.length - 1 : prev - 1));
    const currentBet = bets[currentIndex];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-0 overflow-hidden">
            {/* Background */}
            <img src="/assets/bg-desk-dark.webp" className="absolute inset-0 w-full h-full object-cover opacity-60 z-0" alt="Desk" />

            {/* BOARD CONTAINER */}
            <div className="relative w-full max-w-lg aspect-[3/4] max-h-[85vh] z-10 animate-in zoom-in-95 duration-300">
                <img src="/assets/tactic-board.webp" alt="Tactical Board" className="w-full h-full object-contain drop-shadow-2xl" />

                {/* 1. SILVER TAPE HEADER */}
                <div className="absolute top-[12%] left-1/2 -translate-x-1/2 w-[85%] z-20 rotate-[-1deg]">
                    <div className="bg-zinc-300 text-black font-black text-center py-2 px-4 shadow-lg border-b-2 border-zinc-400 text-xl uppercase tracking-tighter opacity-95 skew-x-1">
                        {currentBet.match_name || "MATCHDAY PREDICTION"}
                    </div>
                    {/* Tape Textures (Optional css tricks for realism) */}
                    <div className="absolute top-0 -left-1 w-2 h-full bg-zinc-400/50 skew-x-12"></div>
                </div>

                {/* 2. PINNED CARD CENTER */}
                <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 transition-transform hover:scale-105 duration-300">
                    {/* Red Pin */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-50 filter drop-shadow-md">
                        <div className="w-4 h-4 bg-red-600 rounded-full border border-red-900 shadow-inner"></div>
                    </div>
                    {/* Card Body */}
                    <div className="transform rotate-[2deg] shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                        <CardBase type={currentBet.market} label={currentBet.team_name} status="locked" />
                    </div>
                </div>

                {/* 3. RED MARKER CIRCLE FOOTER */}
                <div className="absolute bottom-[18%] left-1/2 -translate-x-1/2 w-[60%] z-20">
                    <div className="relative flex items-center justify-center py-4">
                        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" viewBox="0 0 200 80">
                            <path d="M10,40 Q100,-10 190,40 Q100,90 10,40" fill="none" stroke="#dc2626" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="opacity-90 drop-shadow-md" />
                        </svg>
                        <div className="text-3xl md:text-4xl text-zinc-800 -rotate-2 font-black tracking-widest font-marker">
                            POT: {currentBet.potential_return}
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <button data-testid="close-button" onClick={() => navigate(-1)} className="absolute top-6 right-6 p-3 bg-black/50 text-white rounded-full hover:bg-red-600 transition-colors z-50 border border-white/10"><X size={24} /></button>
            <div className="absolute bottom-10 left-0 w-full flex justify-center items-center gap-8 z-50">
                <button onClick={prevSlide} className="p-4 bg-white/10 rounded-full backdrop-blur-md hover:bg-white/20 active:scale-95"><ChevronLeft size={32} className="text-white" /></button>
                <div className="text-white/50 font-mono text-xs tracking-widest">BRIEF {currentIndex + 1}/{bets.length}</div>
                <button onClick={nextSlide} className="p-4 bg-white/10 rounded-full backdrop-blur-md hover:bg-white/20 active:scale-95"><ChevronRight size={32} className="text-white" /></button>
            </div>
        </div>
    );
};
export default TacticalBoardCarousel;