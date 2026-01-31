import React from 'react';
import { usePredictions } from '../../hooks/usePredictions';
import TacticalBoardCarousel from '../TacticalBoardCarousel';

/**
 * Wrapper component that fetches pending bets and passes them to TacticalBoardCarousel
 * This component is used in the LockerRoom's "Whiteboard" tab
 */
const ViewPendingCarousel = () => {
    const { predictions: pendingBets, loading } = usePredictions('PENDING');

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-black">
                <p className="text-gray-400">Loading...</p>
            </div>
        );
    }

    if (pendingBets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-black text-center p-8">
                <p className="text-gray-400 text-lg font-bold mb-2">No Pending Bets</p>
                <p className="text-gray-500 text-sm">Place predictions to see them here</p>
            </div>
        );
    }

    // Transform the data to match TacticalBoardCarousel's expected format
    const transformedBets = pendingBets.map(bet => ({
        id: bet.id,
        match_name: bet.match_name || `${bet.home_team} vs ${bet.away_team}`,
        team_name: bet.selection || bet.team_name,
        market: bet.market_type || bet.card_type?.replace('c_', '').replace('_', ' ').toUpperCase(),
        potential_return: bet.potential_payout || bet.potential_return,
        card_type: bet.card_type,
        status: bet.status
    }));

    return <TacticalBoardCarousel bets={transformedBets} />;
};

export default ViewPendingCarousel;
