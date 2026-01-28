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
            <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Loading...</p>
            </div>
        );
    }

    if (pendingBets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <p className="text-gray-500 text-lg font-bold mb-2">No Pending Bets</p>
                <p className="text-gray-600 text-sm">Place predictions to see them here</p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto scrollbar-hide p-6 pb-32 pt-6">
            {/* Main Container */}
            <div className="max-w-md mx-auto space-y-8">
                {matchGroups.map((matchGroup, groupIndex) => {
                    // Random rotation between -1 and 1 degree for each whiteboard
                    const boardRotation = (Math.random() * 2 - 1);

                    return (
                        <div
                            key={matchGroup.matchId || groupIndex}
                            style={{ transform: `rotate(${boardRotation}deg)` }}
                        >
                            {/* THE VERTICAL WHITEBOARD */}
                            <div
                                className="relative w-full aspect-[3/4] p-6 pb-12 mb-8 bg-[url('/assets/bg-whiteboard-vertical.webp')] bg-cover bg-center rounded-xl shadow-2xl overflow-hidden"
                            >
                                {/* HEADER: Match Name (Marker Text) */}
                                <div className="relative">
                                    <h2 className="font-permanent-marker text-black/85 text-2xl uppercase tracking-tighter text-center mb-6 drop-shadow-md">
                                        {matchGroup.matchName}
                                    </h2>
                                </div>

                                {/* CARD GRID (Vertical Stack) */}
                                <div className="flex flex-wrap justify-center gap-4">
                                    {matchGroup.bets.map((bet) => {
                                        // Random slight rotation for each card
                                        const cardRotation = (Math.random() * 4 - 2);

                                        return (
                                            <div
                                                key={bet.id}
                                                className="relative w-[90px]"
                                                style={{ transform: `rotate(${cardRotation}deg)` }}
                                            >
                                                {/* THE CSS MAGNET (Glossy Plastic) */}
                                                <div
                                                    className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 w-4 h-4 rounded-full bg-gradient-to-br from-red-600 to-red-800 shadow-md border border-black/20 after:content-[''] after:absolute after:top-0 after:left-0 after:w-2 after:h-2 after:rounded-full after:bg-white/40 after:blur-[1px]"
                                                />

                                                {/* THE CARD */}
                                                <CardBase
                                                    type={bet.card_type || 'c_match_result'}
                                                    label={bet.card_type?.replace('c_', '').replace('_', ' ').toUpperCase() || 'MATCH RESULT'}
                                                    selection={formatBetSelection(bet)}
                                                    status="active"
                                                />
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* FOOTER: Payout (Centered Bottom Line) */}
                                <div className="absolute bottom-6 w-full text-center">
                                    <p className="font-permanent-marker text-red-700 text-3xl font-bold -rotate-2 inline-block">
                                        Pot: {matchGroup.totalPotentialPayout.toLocaleString()}
                                    </p>
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
