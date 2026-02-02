import React from 'react';
import { usePredictions } from '../../hooks/usePredictions';
import TacticalBoardCarousel from '../TacticalBoardCarousel';

/**
 * Wrapper component that fetches pending bets and passes them to TacticalBoardCarousel
 * This component is used in the LockerRoom's "Whiteboard" tab
 */
const ViewPendingCarousel = () => {
    // 1. Fetch the clean data (which now includes 'match_title', 'selection', etc.)
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

    // 2. PASS DATA DIRECTLY - DO NOT TRANSFORM
    // TacticalBoardCarousel has its own internal normalization logic that expects
    // the keys exactly as they come from Supabase (e.g., 'match_title').
    return <TacticalBoardCarousel bets={pendingBets} />;
};

export default ViewPendingCarousel;