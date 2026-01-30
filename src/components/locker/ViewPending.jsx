import React from 'react';
import { usePredictions } from '../../hooks/usePredictions';
import CardBase from '../CardBase';
import { groupBetsByMatch, formatBetSelection } from '../../utils/betUtils';

const ViewPending = () => {
    const { predictions: pendingBets, loading } = usePredictions('PENDING');

    // Group bets by match
    const matchGroups = groupBetsByMatch(pendingBets);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-[#1a1a1a]">
                <p className="text-gray-400">Loading...</p>
            </div>
        );
    }

    if (pendingBets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-[#1a1a1a] text-center p-8">
                <p className="text-gray-400 text-lg font-bold mb-2">No Pending Bets</p>
                <p className="text-gray-500 text-sm">Place predictions to see them here</p>
            </div>
        );
    }

    return (
        // THE DARK ROOM (Concrete Grey Background)
        <div className="w-full min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-start py-8 px-4 overflow-y-auto scrollbar-hide pb-32">

            {/* Container for all whiteboards */}
            <div className="w-full max-w-md mx-auto space-y-12">
                {matchGroups.map((matchGroup, groupIndex) => {
                    // Random rotation between -1 and 1 degree for each whiteboard
                    const boardRotation = (Math.random() * 2 - 1);

                    return (
                        <div
                            key={matchGroup.matchId || groupIndex}
                            className="transform transition-transform hover:scale-[1.02]"
                            style={{ transform: `rotate(${boardRotation}deg)` }}
                        >
                            {/* THE TACTICAL BOARD (Container with drop shadow) */}
                            <div className="relative w-full aspect-[3/4] bg-white rounded-xl shadow-2xl overflow-hidden">

                                {/* Background Asset (The Board Texture) */}
                                <img
                                    src="/assets/bg-whiteboard-vertical.webp"
                                    alt="Tactical Board"
                                    className="absolute inset-0 w-full h-full object-cover z-0 opacity-90"
                                />

                                {/* THE CONTENT LAYER (Z-10) */}
                                <div className="relative z-10 w-full h-full flex flex-col items-center p-6">

                                    {/* Match Header (Marker Style) */}
                                    <h2 className="font-permanent-marker text-2xl text-black/85 text-center leading-tight mt-2 mb-8 -rotate-1 drop-shadow-sm">
                                        {matchGroup.matchName}
                                    </h2>

                                    {/* The Bet Cards (Pinned with Magnets) */}
                                    <div className="flex flex-wrap justify-center gap-4">
                                        {matchGroup.bets.map((bet) => {
                                            // Random slight rotation for each card
                                            const cardRotation = (Math.random() * 4 - 2);

                                            return (
                                                <div
                                                    key={bet.id}
                                                    className="relative w-[90px] group"
                                                    style={{ transform: `rotate(${cardRotation}deg)` }}
                                                >
                                                    {/* THE CSS MAGNET (3D Glossy Red Plastic) */}
                                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">

                                                        {/* 1. The Main Body (3D Form) */}
                                                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-red-500 via-red-600 to-red-800 shadow-[0_3px_4px_rgba(0,0,0,0.4)] ring-1 ring-white/20 border border-black/10">

                                                            {/* 2. The Specular Highlight (The "Glossy" Reflection) */}
                                                            <div className="absolute top-[3px] left-[4px] w-2 h-1.5 bg-gradient-to-b from-white/90 to-white/10 rounded-full blur-[0.3px]"></div>

                                                        </div>

                                                        {/* 3. The Drop Shadow (Contact Shadow) */}
                                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-1 bg-black/40 blur-[2px] rounded-full -z-10"></div>

                                                    </div>

                                                    {/* THE CARD (Scaled to fit) */}
                                                    <div className="transform transition-transform group-hover:scale-105">
                                                        <CardBase
                                                            type={bet.card_type || 'c_match_result'}
                                                            label={bet.card_type?.replace('c_', '').replace('_', ' ').toUpperCase() || 'MATCH RESULT'}
                                                            selection={formatBetSelection(bet)}
                                                            status="active"
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* The Pot (Red Marker Circle at Bottom) */}
                                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 transform -rotate-2">
                                        <div className="border-4 border-red-600/80 rounded-[50%_40%_60%_30%] px-6 py-2 bg-white/10">
                                            <span className="font-permanent-marker text-red-700 text-2xl font-bold drop-shadow-sm">
                                                POT: {matchGroup.totalPotentialPayout.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ViewPending;
