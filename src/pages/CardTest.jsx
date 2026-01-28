import React from 'react';
import CardBase from '../components/CardBase';

/**
 * Test Page for CardBase Component
 * Displays all card types in all possible states
 */
export default function CardTest() {
    const cardTypes = [
        { type: 'c_match_result', label: 'Match Result' },
        { type: 'c_total_goals', label: 'Total Goals' },
        { type: 'c_player_score', label: 'Player Score' },
        { type: 'c_supersub', label: 'Super Sub' },
    ];

    const states = [
        { status: 'generic', description: 'Generic (Inventory)' },
        { status: 'active', description: 'Active (Live Bet)' },
        { status: 'won', description: 'Won (Success)' },
        { status: 'lost', description: 'Lost (Failure)' },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-4xl font-black text-white mb-2 text-center">
                    CardBase Component Test
                </h1>
                <p className="text-gray-400 text-center mb-8">
                    Photorealistic Template-Based Cards with CSS Filter Color Grading
                </p>

                {/* Generic State Cards (Inventory) */}
                <section className="mb-12">
                    <h2 className="text-2xl font-bold text-white mb-4 border-b border-gray-700 pb-2">
                        Generic State (Inventory)
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {cardTypes.map((card) => (
                            <div key={card.type} className="space-y-2">
                                <CardBase
                                    type={card.type}
                                    label={card.label}
                                    status="generic"
                                    onClick={() => console.log('Clicked:', card.type)}
                                />
                                <p className="text-xs text-gray-500 text-center">{card.label}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Merged State Cards (With Selection) */}
                <section className="mb-12">
                    <h2 className="text-2xl font-bold text-white mb-4 border-b border-gray-700 pb-2">
                        Merged States (Played Cards)
                    </h2>

                    {states.slice(1).map((state) => (
                        <div key={state.status} className="mb-8">
                            <h3 className="text-lg font-semibold text-yellow-400 mb-3">
                                {state.description}
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                {cardTypes.map((card) => (
                                    <div key={`${card.type}-${state.status}`} className="space-y-2">
                                        <CardBase
                                            type={card.type}
                                            label={card.label}
                                            selection="Arsenal to Win"
                                            status={state.status}
                                            onClick={() => console.log('Clicked:', card.type, state.status)}
                                        />
                                        <p className="text-xs text-gray-500 text-center">
                                            {card.label} - {state.status.toUpperCase()}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </section>

                {/* Color Grading Reference */}
                <section className="mb-12">
                    <h2 className="text-2xl font-bold text-white mb-4 border-b border-gray-700 pb-2">
                        Color Grading Reference
                    </h2>
                    <div className="bg-gray-800 rounded-lg p-6 space-y-3">
                        <div className="flex items-center gap-4">
                            <div className="w-24 h-24 bg-gray-600 rounded flex items-center justify-center">
                                <span className="text-white font-bold">GENERIC</span>
                            </div>
                            <div className="flex-1">
                                <p className="text-white font-semibold">Cold Steel (Inventory)</p>
                                <p className="text-gray-400 text-sm">Grayscale + Brightness Down</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="w-24 h-24 bg-yellow-600 rounded flex items-center justify-center">
                                <span className="text-white font-bold">ACTIVE</span>
                            </div>
                            <div className="flex-1">
                                <p className="text-white font-semibold">Amber Glow (Live)</p>
                                <p className="text-gray-400 text-sm">Sepia + Hue Rotate Gold + Saturate</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="w-24 h-24 bg-green-600 rounded flex items-center justify-center">
                                <span className="text-white font-bold">WON</span>
                            </div>
                            <div className="flex-1">
                                <p className="text-white font-semibold">Toxic Green (Success)</p>
                                <p className="text-gray-400 text-sm">Sepia + Hue Rotate Lime + High Saturate</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="w-24 h-24 bg-red-600 rounded flex items-center justify-center">
                                <span className="text-white font-bold">LOST</span>
                            </div>
                            <div className="flex-1">
                                <p className="text-white font-semibold">Crimson Red (Failure)</p>
                                <p className="text-gray-400 text-sm">Sepia + Hue Rotate Red + Reduced Opacity</p>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
