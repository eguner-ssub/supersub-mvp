import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingScreen() {
    return (
        <div className="w-full h-[100dvh] bg-black flex flex-col items-center justify-center gap-4 z-[100]">
            {/* BRANDING LOGO */}
            <h1 className="text-2xl font-black italic text-white tracking-widest uppercase">
                Super<span className="text-yellow-500">Sub</span>
            </h1>

            {/* SPINNER */}
            <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />

            {/* STATUS TEXT */}
            <p className="text-white/50 text-[10px] font-mono uppercase tracking-[0.3em] animate-pulse">
                Loading Assets...
            </p>
        </div>
    );
}
