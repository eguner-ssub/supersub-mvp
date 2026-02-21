import React from 'react';
import CardBase from '../../shared/ui/CardBase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function GenericLab() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-8">

            {/* Header */}
            <div className="w-full max-w-2xl mb-12">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/card-lab')} className="p-2 bg-white/10 rounded-full hover:bg-white/20">
                        <ArrowLeft className="text-white w-5 h-5" />
                    </button>
                    <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-gray-500 uppercase italic">
                        State 0: Generic Lab
                    </h1>
                </div>
                <p className="text-zinc-600 text-sm mt-2 ml-12">
                    Inspecting the "Metallic Slab" inventory state.
                </p>
            </div>

            {/* Card Grid - Large for inspection */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-2xl">

                <div className="w-32 md:w-40">
                    <CardBase type="c_match_result" label="MATCH RESULT" status="generic" />
                </div>

                <div className="w-32 md:w-40">
                    <CardBase type="c_total_goals" label="TOTAL GOALS" status="generic" />
                </div>

                <div className="w-32 md:w-40">
                    <CardBase type="c_player_score" label="PLAYER SCORE" status="generic" />
                </div>

                <div className="w-32 md:w-40">
                    <CardBase type="c_supersub" label="SUPERSUB" status="generic" />
                </div>

            </div>

        </div>
    );
}
