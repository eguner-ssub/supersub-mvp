import React from "react";
import { usePredictions } from "../../shared/hooks/usePredictions";
import CardBase from "../../shared/ui/CardBase"; // FIXED IMPORT PATH
// Note: We assume utils are in shared/utils now, adjust if necessary
import { groupBetsByMatch, formatBetSelection } from "../../shared/utils/betUtils";

const ViewPending = () => {
    const { predictions, loading } = usePredictions();

    if (loading) return <div className="p-8 text-center text-white/50 animate-pulse">Loading...</div>;

    if (!predictions || predictions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-white/30">
                <p>No Pending Bets</p>
            </div>
        );
    }

    const grouped = groupBetsByMatch(predictions);

    return (
        <div className="p-4 space-y-4 pb-24 overflow-y-auto h-full">
            {Object.entries(grouped).map(([matchId, group]) => (
                <div key={matchId} className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <h3 className="text-white font-bold mb-3 border-b border-white/10 pb-2">{group.matchName}</h3>
                    <div className="space-y-3">
                        {group.bets.map((bet) => (
                            <div key={bet.id} className="flex items-center gap-3 bg-black/20 p-2 rounded-lg">
                                <div className="w-10">
                                    <CardBase type={bet.card_type} variant="icon" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-yellow-400 text-xs font-mono uppercase tracking-wider">
                                        {formatBetSelection(bet.selection)}
                                    </p>
                                    <p className="text-white/60 text-[10px]">Potential: {bet.potential_reward}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ViewPending;
