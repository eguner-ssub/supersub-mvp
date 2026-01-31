import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Construction } from 'lucide-react';

const ComingSoon = ({ title, message }) => {
    const navigate = useNavigate();

    return (
        <div className="w-full h-[100dvh] bg-black flex flex-col items-center justify-center p-8 text-center font-sans select-none border-x border-gray-800 md:max-w-[480px] md:mx-auto">
            <div className="w-24 h-24 bg-yellow-500/10 rounded-full flex items-center justify-center mb-6 border border-yellow-500/20 animate-pulse">
                <Construction className="w-10 h-10 text-yellow-500" />
            </div>

            <h1 className="text-3xl font-black text-white italic uppercase tracking-wider mb-2">
                {title}
            </h1>

            <p className="text-gray-400 text-sm max-w-xs mb-8">
                {message || "This feature is currently under development."}
            </p>

            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 px-8 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-full transition-colors uppercase tracking-widest text-xs"
            >
                <ArrowLeft size={16} /> Return to HQ
            </button>
        </div>
    );
};

export default ComingSoon;
