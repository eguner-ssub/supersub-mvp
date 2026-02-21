import React from 'react';
import { usePredictions } from '../../shared/hooks/usePredictions';
import CardBase from '../../shared/ui/CardBase';

/**
 * Grid view for pending bets
 * Displays cards in a responsive grid on a dark charcoal background
 */
const ViewPendingGrid = () => {
    // Fetches predictions with the 'PENDING' status filter
    const { predictions: pendingBets, loading } = usePredictions('PENDING');

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <p className="text-gray-400 text-lg animate-pulse">Loading Whiteboard...</p>
            </div>
        );
    }

    if (pendingBets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <p className="text-gray-400 text-2xl font-black uppercase mb-2">No Pending Bets</p>
                <p className="text-gray-600 text-sm">Place predictions to see them here</p>
            </div>
        );
    }

    /**
     * Helper to map card_type IDs to display labels
     * Uses the card_type column from the predictions table
     */
    const getCardLabel = (type) => {
        const labelMap = {
            'c_match_result': 'MATCH RESULT',
            'c_total_goals': 'TOTAL GOALS',
            'c_player_score': 'GOALSCORER',
            'c_supersub': 'SUPERSUB',
        };
        return labelMap[type] || 'BET';
    };

    return (
        <div className="p-6">
            {/* Responsive grid using the charcoal background (#121212) 
                defined in the LockerRoom tab config
            */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 max-w-4xl mx-auto">
                {pendingBets.map((bet) => (
                    <div key={bet.id} className="w-32 md:w-40 aspect-[2/3] mx-auto">
                        <CardBase
                            // Uses the card_type directly from the database
                            type={bet.card_type}
                            label={getCardLabel(bet.card_type)}
                            // PRIORITY: Display team_name (saved in GameContext)
                            // FALLBACK: Format the selection string for legacy records
                            selection={bet.team_name || bet.selection.replace(/_/g, ' ')}
                            status="pending"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ViewPendingGrid;