import React, { useState, useEffect } from 'react';
import { Play, Loader2 } from 'lucide-react';

const AdOverlay = ({ onReward, onClose }) => {
    const [countdown, setCountdown] = useState(5);
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => {
                setCountdown(prev => prev - 1);
            }, 1000);

            return () => clearTimeout(timer);
        } else {
            // Countdown finished
            setIsComplete(true);
            // Call the reward callback
            if (onReward) {
                onReward();
            }
        }
    }, [countdown, onReward]);

    const handleClose = () => {
        if (isComplete && onClose) {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[70] bg-black flex flex-col items-center justify-center p-6">
            {/* Mock Ad Content */}
            <div className="w-full max-w-md bg-gradient-to-br from-purple-900 to-blue-900 rounded-2xl p-8 text-center border-2 border-purple-500 shadow-[0_0_50px_rgba(168,85,247,0.5)]">

                {!isComplete ? (
                    <>
                        {/* Ad Icon */}
                        <div className="mb-6 flex justify-center">
                            <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm border-2 border-white/20">
                                <Play className="w-10 h-10 text-white fill-white" />
                            </div>
                        </div>

                        {/* Ad Title */}
                        <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-wide">
                            Sponsored Ad
                        </h2>
                        <p className="text-purple-200 text-sm mb-8">
                            Watch to earn your reward
                        </p>

                        {/* Countdown */}
                        <div className="mb-6">
                            <div className="w-24 h-24 mx-auto bg-white/10 rounded-full flex items-center justify-center border-4 border-white/30 backdrop-blur-sm">
                                <span className="text-5xl font-black text-white">{countdown}</span>
                            </div>
                            <p className="text-white/70 text-xs mt-4 uppercase tracking-widest">
                                Reward in {countdown}s...
                            </p>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-1000 ease-linear"
                                style={{ width: `${((5 - countdown) / 5) * 100}%` }}
                            />
                        </div>

                        {/* Cannot Close Message */}
                        <p className="text-white/50 text-xs mt-6 italic">
                            Please wait for the ad to complete
                        </p>
                    </>
                ) : (
                    <>
                        {/* Reward Complete */}
                        <div className="mb-6 flex justify-center">
                            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center border-2 border-green-500 animate-pulse">
                                <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>

                        <h2 className="text-2xl font-black text-white mb-2 uppercase">
                            Reward Earned!
                        </h2>
                        <p className="text-green-300 text-sm mb-8">
                            Your energy has been refilled
                        </p>

                        <button
                            onClick={handleClose}
                            className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-black uppercase rounded-xl transition-all active:scale-95 shadow-lg"
                        >
                            Continue
                        </button>
                    </>
                )}
            </div>

            {/* Branding */}
            <p className="text-white/30 text-xs mt-6 uppercase tracking-widest">
                Mock Rewarded Ad
            </p>
        </div>
    );
};

export default AdOverlay;
