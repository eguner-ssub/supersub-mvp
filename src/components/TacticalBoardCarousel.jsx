import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CardBase from './CardBase'; // Ensure this path matches your project structure

const TacticalBoardCarousel = ({ bets = [] }) => {
    const navigate = useNavigate();
    const [activeIndex, setActiveIndex] = useState(0);

    // Fallback Mock Data for Development/Visual Testing
    const displayBets = bets.length > 0 ? bets : [
        { id: 1, match_name: 'ARSENAL vs CHELSEA', team_name: 'ARSENAL', market: 'MATCH WINNER', potential_return: 240, status: 'pending' },
        { id: 2, match_name: 'LIVERPOOL vs MAN CITY', team_name: 'DRAW', market: 'FULL TIME', potential_return: 350, status: 'pending' },
    ];

    const handleScroll = (e) => {
        const scrollPosition = e.target.scrollLeft;
        const width = e.target.clientWidth;
        const index = Math.round(scrollPosition / width);
        setActiveIndex(index);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col font-sans select-none">

            {/* LAYER 0: SCENE BACKGROUND */}
            <div className="absolute inset-0 z-0">
                <img
                    src="/assets/bg-board-bench.webp"
                    alt="Bench Background"
                    className="w-full h-full object-cover opacity-100"
                />
                <div className="absolute inset-0 bg-radial-gradient from-transparent via-black/20 to-black/80"></div>
            </div>

            {/* LAYER 1: HUD CONTROLS */}
            <div className="relative z-50 flex justify-between items-center p-6 pt-12">
                <h2 className="text-white/80 font-black uppercase tracking-widest text-xs md:text-sm drop-shadow-md">
                    Tactical Brief ({activeIndex + 1}/{displayBets.length})
                </h2>
                <button
                    onClick={() => navigate(-1)}
                    data-testid="close-button"
                    className="bg-black/40 backdrop-blur-md p-2 rounded-full border border-white/10 text-white hover:bg-white/10 transition-colors active:scale-95"
                >
                    <X size={24} />
                </button>
            </div>

            {/* LAYER 2: SCROLL CONTAINER */}
            <div
                className="relative z-10 flex-1 flex overflow-x-auto snap-x snap-mandatory no-scrollbar items-center"
                onScroll={handleScroll}
                data-testid="carousel-container"
            >
                {displayBets.map((bet) => (
                    <div
                        key={bet.id}
                        className="snap-center shrink-0 w-full h-full flex items-center justify-center p-4 perspective-1000"
                    >
                        {/* THE BOARD PROP */}
                        <div className="relative w-full max-w-[90vw] md:max-w-md aspect-[9/16] max-h-[85vh] transition-transform duration-500">

                            <img
                                src="/assets/tactic-board.webp"
                                alt="Tactical Board"
                                className="absolute inset-0 w-full h-full object-contain drop-shadow-2xl"
                            />

                            {/* DIEGETIC CONTENT ZONE */}
                            <div className="absolute top-[12%] left-[10%] right-[10%] bottom-[10%] flex flex-col items-center">

                                {/* Match Header */}
                                <div className="mt-4 mb-6 transform -rotate-1 w-full text-center">
                                    <h1 className="font-permanent-marker text-xl md:text-2xl text-black/85 leading-none uppercase break-words">
                                        {bet.match_name || "MATCH PENDING"}
                                    </h1>
                                </div>

                                {/* The Pinned Card */}
                                <div className="relative group scale-90 origin-top mt-2">
                                    {/* Glossy Magnet */}
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-red-500 via-red-600 to-red-800 shadow-md ring-1 ring-white/20 border border-black/10">
                                            <div className="absolute top-[3px] left-[4px] w-2 h-1.5 bg-gradient-to-b from-white/90 to-white/10 rounded-full blur-[0.3px]"></div>
                                        </div>
                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-1 bg-black/40 blur-[2px] rounded-full -z-10"></div>
                                    </div>

                                    {/* Card Base */}
                                    <div className="transform transition-transform duration-300">
                                        <CardBase
                                            type={bet.card_type || 'c_match_result'}
                                            label={bet.market || 'MATCH WINNER'}
                                            selection={bet.team_name}
                                            status="active"
                                        />
                                    </div>
                                </div>

                                {/* Pot Amount */}
                                <div className="mt-auto mb-10 transform -rotate-2">
                                    <div className="border-[3px] border-red-600/80 rounded-[50%_40%_60%_30%] px-5 py-2 rotate-1">
                                        <span className="font-permanent-marker text-red-600 text-2xl md:text-3xl font-bold">
                                            POT: {bet.potential_return || 0}
                                        </span>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* LAYER 3: PAGINATION DOTS */}
            <div className="relative z-50 h-16 flex justify-center items-start gap-2">
                {displayBets.map((_, i) => (
                    <div
                        key={i}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${i === activeIndex ? 'bg-yellow-500 w-4 shadow-[0_0_10px_rgba(234,179,8,0.5)]' : 'bg-white/20'
                            }`}
                    />
                ))}
            </div>

        </div>
    );
};

export default TacticalBoardCarousel;
