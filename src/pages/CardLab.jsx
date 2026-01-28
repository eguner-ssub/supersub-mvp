import React from 'react';
import CardBase from '../components/CardBase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function CardLab() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-neutral-900 p-8 flex flex-col gap-12 overflow-y-auto">

            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/')} className="p-2 bg-white/10 rounded-full hover:bg-white/20">
                    <ArrowLeft className="text-white" />
                </button>
                <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-gray-500 uppercase italic">
                    Card Optics Lab
                </h1>
            </div>

            {/* 1. INVENTORY STATE (Silver/Steel) */}
            <div>
                <h2 className="text-gray-400 font-mono text-xs uppercase tracking-[0.3em] mb-6 border-b border-gray-700 pb-2">
                    State 0: Inventory (Generic)
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <CardBase type="c_match_result" label="Match Result" />
                    <CardBase type="c_total_goals" label="Total Goals" />
                    <CardBase type="c_player_score" label="Player Score" />
                    <CardBase type="c_supersub" label="Super Sub" />
                </div>
            </div>

            {/* 2. LIVE STATE (Amber Glow) */}
            <div>
                <h2 className="text-yellow-500 font-mono text-xs uppercase tracking-[0.3em] mb-6 border-b border-yellow-900/50 pb-2">
                    State 1: Active (Live Bet)
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <CardBase type="c_match_result" label="Match Result" selection="Arsenal to Win" status="active" />
                    <CardBase type="c_total_goals" label="Total Goals" selection="Over 2.5 Goals" status="active" />
                    <CardBase type="c_player_score" label="Player Score" selection="Saka Score" status="active" />
                    <CardBase type="c_supersub" label="Super Sub" selection="Nunez Sub" status="active" />
                </div>
            </div>

            {/* 3. SETTLED STATE (Win/Green vs Loss/Red) */}
            <div>
                <h2 className="text-white font-mono text-xs uppercase tracking-[0.3em] mb-6 border-b border-gray-700 pb-2">
                    State 2: Settled
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <CardBase type="c_match_result" label="Match Result" selection="Man City Win" status="won" />
                    <CardBase type="c_total_goals" label="Total Goals" selection="Under 1.5 Goals" status="lost" />
                    <CardBase type="c_player_score" label="Player Score" selection="Haaland Hat-trick" status="won" />
                    <CardBase type="c_supersub" label="Super Sub" selection="Maguire Sub" status="lost" />
                </div>
            </div>

        </div>
    );
}
