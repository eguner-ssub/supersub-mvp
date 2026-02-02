import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CardBase from './CardBase';

const TacticalBoardCarousel = ({ bets = [] }) => {
    const navigate = useNavigate();
    const [activeIndex, setActiveIndex] = useState(0);

    // 1. DATA NORMALIZATION
    const normalizedBets = bets.map(bet => {
        if (!bet) return null;

        // --- A. TITLE FINDER ---
        let title = bet.match_title;

        if (!title && bet.home_team && bet.away_team) {
            title = `${bet.home_team} vs ${bet.away_team}`;
        }
        if (!title && bet.team_name && typeof bet.team_name === 'string' && bet.team_name.includes(' vs ')) {
            title = bet.team_name;
        }
        if (!title) title = "Unknown Match";

        // --- B. SELECTION FORMATTER ---
        let pick = bet.selection || bet.prediction || "Pending";
        pick = pick.replace(/_/g, ' ');

        // --- C. MAPPING ---
        return {
            id: bet.id || Math.random(),
            title: title,
            pick: pick,
            pot: Number(bet.potential_reward || 0),
            cardType: bet.card_type || 'c_match_result',
            label: (bet.card_type || 'TACTIC').replace('c_', '').replace(/_/g, ' ').toUpperCase(),
            status: 'active'
        };
    }).filter(Boolean);

    // FALLBACK
    const displayBets = normalizedBets.length > 0 ? normalizedBets : [];

    const handleScroll = (e) => {
        const scrollPosition = e.target.scrollLeft;
        const width = e.target.clientWidth;
        const index = Math.round(scrollPosition / width);
        setActiveIndex(index);
    };

    return (
        <div className="fixed inset-0 z-50 bg-neutral-900 flex flex-col font-sans select-none overflow-hidden">

            {/* LAYER 0: THE DESK */}
            <div className="absolute inset-0 z-0">
                <img
                    src="/assets/bg-board-bench.webp"
                    alt="Desk"
                    className="w-full h-full object-cover opacity-100 scale-105"
                />
                <div className="absolute inset-0 bg-radial-gradient from-transparent via-black/40 to-black/90"></div>
            </div>

            {/* LAYER 1: HUD */}
            <div className="relative z-50 flex justify-between items-start p-6">
                <div>
                    <h2 className="text-white/40 font-mono text-[10px] uppercase tracking-[0.3em]">CONFIDENTIAL</h2>
                    <h1 className="text-white font-black text-xl uppercase italic tracking-tighter">Tactical Brief</h1>
                </div>
                <button
                    onClick={() => navigate(-1)}
                    className="bg-black/40 backdrop-blur-md p-2 rounded-full border border-white/10 text-white hover:bg-white/10 transition-colors active:scale-95"
                >
                    <X size={24} />
                </button>
            </div>

            {/* LAYER 2: CAROUSEL */}
            <div
                className="relative z-10 flex-1 flex overflow-x-auto snap-x snap-mandatory no-scrollbar items-center py-4"
                onScroll={handleScroll}
            >
                {displayBets.length === 0 ? (
                    <div className="w-full flex flex-col items-center justify-center opacity-50">
                        <p className="text-white font-mono uppercase tracking-widest">No Active Tactics</p>
                    </div>
                ) : (
                    displayBets.map((bet) => (
                        <div
                            key={bet.id}
                            className="snap-center shrink-0 w-full h-full flex items-center justify-center p-4 perspective-1000"
                        >
                            <div className="relative w-full max-w-sm aspect-[3/4] transition-transform duration-500">

                                {/* A. BOARD IMAGE */}
                                <img
                                    src="/assets/tactic-board.webp"
                                    alt="Tactical Board"
                                    className="absolute inset-0 w-full h-full object-contain drop-shadow-2xl z-0 rounded-xl"
                                />

                                {/* B. CONTENT LAYER */}
                                <div className="absolute top-[8%] left-[8%] right-[8%] bottom-[8%] flex flex-col z-10">

                                    {/* 1. HEADER: Silver Tape */}
                                    <div className="relative w-[106%] -ml-[3%] mb-2 z-20">
                                        <div
                                            className="h-12 w-full flex items-center justify-center relative shadow-lg transform -rotate-1 origin-center"
                                            style={{
                                                background: 'linear-gradient(180deg, #e5e7eb 0%, #9ca3af 20%, #f3f4f6 45%, #9ca3af 80%, #6b7280 100%)',
                                                clipPath: 'polygon(1% 2%, 99% 0%, 100% 98%, 0% 100%)'
                                            }}
                                        >
                                            <div className="absolute inset-0 opacity-20 bg-noise mix-blend-overlay"></div>
                                            <span className="text-black/90 font-black text-sm md:text-base uppercase tracking-tighter truncate px-4 relative z-30 font-sans">
                                                {bet.title}
                                            </span>
                                        </div>
                                    </div>

                                    {/* 2. BODY: The Pinned Card (SIZE FIX: 65% -> 75%) */}
                                    <div className="flex-1 flex items-center justify-center relative w-full z-10 p-4">
                                        <div className="relative w-[75%]">

                                            {/* Red Magnet Pin */}
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-50 w-6 h-6 bg-gradient-to-br from-red-500 via-red-600 to-red-900 rounded-full shadow-lg border border-red-400/50">
                                                <div className="absolute top-[3px] left-[3px] w-2 h-1.5 bg-gradient-to-b from-white/80 to-transparent rounded-full blur-[0.5px]"></div>
                                            </div>

                                            {/* The Card Component */}
                                            <div className="transform rotate-2 shadow-2xl transition-transform duration-300 hover:rotate-0">
                                                <CardBase
                                                    type={bet.cardType}
                                                    label={bet.label}
                                                    selection={bet.pick}
                                                    status="active"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 3. FOOTER: The Pot (TEXT FIX) */}
                                    {/* Adjusted margin and svg stroke for cleaner look */}
                                    <div className="mt-auto relative shrink-0 flex justify-center z-10 -mb-4">
                                        <div className="relative px-8 py-3 transform -rotate-3">
                                            {/* Marker Circle */}
                                            <svg className="absolute inset-0 w-full h-full text-red-600/90 pointer-events-none overflow-visible" viewBox="0 0 120 60" preserveAspectRatio="none">
                                                <path d="M10,35 Q20,5 60,5 T110,30 T60,58 T10,35" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>

                                            <div className="text-center leading-none relative z-10 pt-1">
                                                <span className="font-permanent-marker text-red-600/80 text-[10px] font-bold block -mb-1 ml-1">POTENTIAL</span>
                                                <span className="font-permanent-marker text-red-600 text-3xl font-bold block drop-shadow-sm">
                                                    {bet.pot}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* LAYER 3: PAGINATION */}
            <div className="relative z-50 h-16 flex justify-center items-center gap-2">
                {displayBets.map((_, i) => (
                    <div
                        key={i}
                        className={`h-1.5 rounded-full transition-all duration-300 ${i === activeIndex
                                ? 'bg-white w-6 shadow-[0_0_10px_white]'
                                : 'bg-white/20 w-1.5'
                            }`}
                    />
                ))}
            </div>

        </div>
    );
};

export default TacticalBoardCarousel;