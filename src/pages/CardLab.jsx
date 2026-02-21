import React from 'react';
import CardBase from '../shared/ui/CardBase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function CardLab() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-neutral-900 p-8 flex flex-col gap-16 overflow-y-auto">

            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/')} className="p-2 bg-white/10 rounded-full hover:bg-white/20">
                    <ArrowLeft className="text-white" />
                </button>
                <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-gray-500 uppercase italic">
                    Card Optics Lab
                </h1>
            </div>

            {/* STATE 0: INVENTORY (Generic) */}
            <div>
                <h2 className="text-gray-400 font-mono text-xs uppercase tracking-[0.3em] mb-2 border-b border-gray-700 pb-2">
                    State 0: Inventory (The Sleeper)
                </h2>
                <p className="text-zinc-600 text-xs mb-6">Raw metallic slab. Label displayed at bottom.</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl">
                    <div className="w-32 md:w-40"><CardBase type="c_match_result" label="MATCH RESULT" status="generic" /></div>
                    <div className="w-32 md:w-40"><CardBase type="c_total_goals" label="TOTAL GOALS" status="generic" /></div>
                    <div className="w-32 md:w-40"><CardBase type="c_player_score" label="GOALSCORER" status="generic" /></div>
                    <div className="w-32 md:w-40"><CardBase type="c_supersub" label="SUPERSUB" status="generic" /></div>
                </div>
            </div>

            {/* STATE 1: PENDING (The Wager) */}
            <div>
                <h2 className="text-yellow-600 font-mono text-xs uppercase tracking-[0.3em] mb-2 border-b border-yellow-900/30 pb-2">
                    State 1: Pending (The Wager)
                </h2>
                <p className="text-zinc-600 text-xs mb-6">Gold glow, NO badges. Selection replaces label.</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl">
                    <div className="w-32 md:w-40"><CardBase type="c_match_result" label="MATCH RESULT" selection="Arsenal Win" status="pending" /></div>
                    <div className="w-32 md:w-40"><CardBase type="c_total_goals" label="TOTAL GOALS" selection="Over 2.5" status="pending" /></div>
                    <div className="w-32 md:w-40"><CardBase type="c_player_score" label="GOALSCORER" selection="Woltemade" status="pending" /></div>
                    <div className="w-32 md:w-40"><CardBase type="c_supersub" label="SUPERSUB" selection="SUPERSUB" status="pending" /></div>
                </div>
            </div>

            {/* STATE 2: ACTIVE (The Action) */}
            <div>
                <h2 className="text-yellow-400 font-mono text-xs uppercase tracking-[0.3em] mb-2 border-b border-yellow-500/50 pb-2">
                    State 2: Active (The Action)
                </h2>
                <p className="text-zinc-600 text-xs mb-6">Gold glow + yellow LIVE badge. Selection displayed.</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl">
                    <div className="w-32 md:w-40"><CardBase type="c_match_result" label="MATCH RESULT" selection="Arsenal Win" status="active" /></div>
                    <div className="w-32 md:w-40"><CardBase type="c_total_goals" label="TOTAL GOALS" selection="Over 2.5" status="active" /></div>
                    <div className="w-32 md:w-40"><CardBase type="c_player_score" label="GOALSCORER" selection="Saka" status="active" /></div>
                    <div className="w-32 md:w-40"><CardBase type="c_supersub" label="SUPERSUB" selection="SUPERSUB" status="active" /></div>
                </div>
            </div>

            {/* STATE 3: SETTLED (The Result) */}
            <div>
                <h2 className="text-white font-mono text-xs uppercase tracking-[0.3em] mb-2 border-b border-gray-700 pb-2">
                    State 3: Settled (The Result)
                </h2>
                <p className="text-zinc-600 text-xs mb-6">Green (WON) or Red (LOST) glow with badges.</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl">
                    <div className="w-32 md:w-40"><CardBase type="c_match_result" label="MATCH RESULT" selection="Man City Win" status="won" /></div>
                    <div className="w-32 md:w-40"><CardBase type="c_total_goals" label="TOTAL GOALS" selection="Under 1.5" status="lost" /></div>
                    <div className="w-32 md:w-40"><CardBase type="c_player_score" label="GOALSCORER" selection="Haaland" status="won" /></div>
                    <div className="w-32 md:w-40"><CardBase type="c_supersub" label="SUPERSUB" selection="SUPERSUB" status="lost" /></div>
                </div>
            </div>

        </div>
    );
}
