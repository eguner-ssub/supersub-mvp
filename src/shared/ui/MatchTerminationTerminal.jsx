import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

/**
 * MatchTerminationTerminal - Glass-Dark Terminal for Finished Matches
 * 
 * Displays when a match transitions to FINISHED state (FT, AET, PEN)
 * Prevents zombie betting and directs users back to Match Hub
 */
const MatchTerminationTerminal = () => {
    const navigate = useNavigate();

    return (
        <div className="fixed bottom-0 w-full z-50 p-6 flex items-center justify-center">
            {/* Glass-Dark Terminal */}
            <div className="w-full max-w-lg bg-zinc-950/80 backdrop-blur-[12px] border border-[#1a1a1a] rounded-2xl p-8 shadow-2xl">
                {/* Header */}
                <div className="text-center mb-6">
                    <h2 className="text-white font-black text-2xl uppercase tracking-widest mb-2">
                        Match Terminated
                    </h2>
                    <div className="h-[1px] w-20 bg-[#39ff14] mx-auto mb-4"></div>
                    <p className="text-zinc-400 text-sm font-bold uppercase tracking-wider leading-relaxed">
                        This match is finished, go and check other matches to play your cards on them!
                    </p>
                </div>

                {/* CTA Button */}
                <button
                    onClick={() => navigate('/match-hub')}
                    className="w-full bg-[#39ff14] text-black font-black uppercase py-4 px-6 rounded-xl text-lg tracking-widest hover:bg-[#2dd910] transition-all duration-300 flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(57,255,20,0.3)]"
                >
                    Return to Match Hub
                    <ArrowRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

export default MatchTerminationTerminal;
