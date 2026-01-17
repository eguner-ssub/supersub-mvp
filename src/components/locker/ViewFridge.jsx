import React, { useState } from 'react';
import { Zap, X } from 'lucide-react';
import { mockConsumables } from '../../data/mockInventory';

const ViewFridge = () => {
    const [showDrinkPopup, setShowDrinkPopup] = useState(false);
    const [showToast, setShowToast] = useState(false);

    const handleDrink = () => {
        console.log('✅ Energy Drink consumed!');
        setShowDrinkPopup(false);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    };

    return (
        <>
            <div className="h-full overflow-y-auto p-6">
                {/* Fridge Header */}
                <div className="mb-6 text-center">
                    <h2 className="text-3xl font-black text-white uppercase tracking-tight">
                        The Fridge
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">Consumables & Boosts</p>
                </div>

                {/* Consumables Grid */}
                <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
                    {/* Energy Drink */}
                    <button
                        onClick={() => setShowDrinkPopup(true)}
                        className="bg-gradient-to-br from-blue-900/40 to-yellow-900/40 backdrop-blur-md border border-blue-500/30 rounded-xl p-6 hover:scale-105 transition-all active:scale-95"
                    >
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center border-2 border-blue-400/50">
                                <Zap className="w-10 h-10 text-yellow-400 fill-yellow-400" />
                            </div>
                            <div className="text-center">
                                <p className="text-white font-bold text-sm">Energy Drink</p>
                                <p className="text-blue-300 text-xs font-mono">x{mockConsumables.energy_drinks}</p>
                            </div>
                        </div>
                    </button>

                    {/* Placeholder for future consumables */}
                    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-6 opacity-50">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-20 h-20 bg-gray-500/20 rounded-full flex items-center justify-center border-2 border-gray-400/50">
                                <span className="text-3xl">🔒</span>
                            </div>
                            <div className="text-center">
                                <p className="text-gray-400 font-bold text-sm">Coming Soon</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Energy Drink Popup */}
            {showDrinkPopup && (
                <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
                    <div className="bg-gradient-to-br from-gray-900 to-black border-2 border-blue-500/50 rounded-2xl p-8 max-w-sm w-full relative animate-in zoom-in slide-in-from-bottom duration-300">
                        {/* Close button */}
                        <button
                            onClick={() => setShowDrinkPopup(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        {/* Energy Drink Icon */}
                        <div className="flex justify-center mb-6">
                            <div className="w-24 h-24 bg-gradient-to-br from-blue-500/20 to-yellow-500/20 rounded-full flex items-center justify-center border-4 border-blue-400/50 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                                <Zap className="w-12 h-12 text-yellow-400 fill-yellow-400 animate-pulse" />
                            </div>
                        </div>

                        {/* Text */}
                        <h3 className="text-2xl font-black text-white text-center mb-2 uppercase">Energy Drink</h3>
                        <p className="text-blue-300 text-center mb-6">Restore 3 Energy?</p>

                        {/* Drink Button */}
                        <button
                            onClick={handleDrink}
                            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-lg"
                        >
                            DRINK
                        </button>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {showToast && (
                <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-lg shadow-lg z-[100] animate-in slide-in-from-bottom fade-in duration-300">
                    ⚡ Energy Restored!
                </div>
            )}
        </>
    );
};

export default ViewFridge;
