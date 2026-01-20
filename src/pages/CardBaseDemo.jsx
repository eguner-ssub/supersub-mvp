import React, { useState } from 'react';
import CardBase from '../components/CardBase';
import { CARD_TYPES, CARD_STATES } from '../utils/cardConfig';

/**
 * CardBase Demo - Interactive Showcase
 * 
 * Demonstrates all card types and states with live state transitions
 */
const CardBaseDemo = () => {
    const [selectedCard, setSelectedCard] = useState(null);
    const [cardStates, setCardStates] = useState({
        card1: CARD_STATES.DEFAULT,
        card2: CARD_STATES.DEFAULT,
        card3: CARD_STATES.DEFAULT,
        card4: CARD_STATES.DEFAULT
    });

    const cards = [
        {
            id: 'card1',
            type: CARD_TYPES.MATCH_RESULT,
            label: 'Match Result',
            subLabel: 'Home Win',
            backgroundImage: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&h=600&fit=crop'
        },
        {
            id: 'card2',
            type: CARD_TYPES.TOTAL_GOALS,
            label: 'Total Goals',
            subLabel: 'Over 2.5',
            backgroundImage: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400&h=600&fit=crop'
        },
        {
            id: 'card3',
            type: CARD_TYPES.PLAYER_SCORE,
            label: 'Player Score',
            subLabel: 'Haaland',
            backgroundImage: 'https://images.unsplash.com/photo-1606925797300-0b35e9d1794e?w=400&h=600&fit=crop'
        },
        {
            id: 'card4',
            type: CARD_TYPES.SUPERSUB,
            label: 'Super Sub',
            subLabel: 'Foden',
            backgroundImage: 'https://images.unsplash.com/photo-1589487391730-58f20eb2c308?w=400&h=600&fit=crop'
        }
    ];

    const handleCardClick = (cardId) => {
        setSelectedCard(cardId);
        setCardStates(prev => ({
            ...prev,
            [cardId]: CARD_STATES.SELECTED
        }));
    };

    const simulatePending = () => {
        if (!selectedCard) return;
        setCardStates(prev => ({
            ...prev,
            [selectedCard]: CARD_STATES.PENDING
        }));
    };

    const simulateWin = () => {
        if (!selectedCard) return;
        setCardStates(prev => ({
            ...prev,
            [selectedCard]: CARD_STATES.WON
        }));
    };

    const simulateLoss = () => {
        if (!selectedCard) return;
        setCardStates(prev => ({
            ...prev,
            [selectedCard]: CARD_STATES.LOST
        }));
    };

    const resetAll = () => {
        setSelectedCard(null);
        setCardStates({
            card1: CARD_STATES.DEFAULT,
            card2: CARD_STATES.DEFAULT,
            card3: CARD_STATES.DEFAULT,
            card4: CARD_STATES.DEFAULT
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-black text-white mb-4 tracking-tight">
                        CardBase Component
                    </h1>
                    <p className="text-xl text-gray-400 mb-2">
                        Living Component with State Transitions
                    </p>
                    <p className="text-sm text-gray-500">
                        DEFAULT → SELECTED → PENDING → WON/LOST
                    </p>
                </div>

                {/* Control Panel */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 mb-8 border border-gray-700">
                    <h2 className="text-2xl font-bold text-white mb-4">State Controls</h2>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={simulatePending}
                            disabled={!selectedCard}
                            className="px-6 py-3 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-lg transition-all duration-200 shadow-lg hover:shadow-yellow-500/50"
                        >
                            → Pending
                        </button>
                        <button
                            onClick={simulateWin}
                            disabled={!selectedCard}
                            className="px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-lg transition-all duration-200 shadow-lg hover:shadow-green-500/50"
                        >
                            → Won
                        </button>
                        <button
                            onClick={simulateLoss}
                            disabled={!selectedCard}
                            className="px-6 py-3 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-lg transition-all duration-200 shadow-lg hover:shadow-red-500/50"
                        >
                            → Lost
                        </button>
                        <button
                            onClick={resetAll}
                            className="px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg transition-all duration-200 shadow-lg ml-auto"
                        >
                            Reset All
                        </button>
                    </div>
                    {selectedCard && (
                        <p className="text-sm text-gray-400 mt-4">
                            Selected: <span className="text-blue-400 font-semibold">{selectedCard}</span>
                        </p>
                    )}
                </div>

                {/* Card Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    {cards.map((card) => (
                        <div key={card.id} className="aspect-[3/4]">
                            <CardBase
                                type={card.type}
                                state={cardStates[card.id]}
                                backgroundImage={card.backgroundImage}
                                label={card.label}
                                subLabel={card.subLabel}
                                onClick={() => handleCardClick(card.id)}
                            />
                        </div>
                    ))}
                </div>

                {/* State Legend */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
                    <h2 className="text-2xl font-bold text-white mb-6">State Visual Guide</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-3 rounded-lg border-2 border-gray-600 ring-0 shadow-md" />
                            <p className="text-sm font-semibold text-gray-300">DEFAULT</p>
                            <p className="text-xs text-gray-500">Gray border</p>
                        </div>
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-3 rounded-lg border-2 border-blue-500 ring-2 ring-blue-400/50 shadow-lg shadow-blue-500/30" />
                            <p className="text-sm font-semibold text-blue-400">SELECTED</p>
                            <p className="text-xs text-gray-500">Blue ring</p>
                        </div>
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-3 rounded-lg border-2 border-yellow-500 ring-2 ring-yellow-400/50 shadow-lg shadow-yellow-500/30 animate-pulse" />
                            <p className="text-sm font-semibold text-yellow-400">PENDING</p>
                            <p className="text-xs text-gray-500">Pulsing yellow</p>
                        </div>
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-3 rounded-lg border-2 border-green-500 ring-4 ring-green-400/60 shadow-xl shadow-green-500/50" />
                            <p className="text-sm font-semibold text-green-400">WON</p>
                            <p className="text-xs text-gray-500">Green glow</p>
                        </div>
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-3 rounded-lg border-2 border-red-500 ring-2 ring-red-400/50 shadow-lg shadow-red-500/30" />
                            <p className="text-sm font-semibold text-red-400">LOST</p>
                            <p className="text-xs text-gray-500">Red border</p>
                        </div>
                    </div>
                </div>

                {/* Architecture Notes */}
                <div className="mt-8 bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
                    <h3 className="text-lg font-bold text-white mb-3">Architecture Highlights</h3>
                    <ul className="space-y-2 text-sm text-gray-400">
                        <li className="flex items-start">
                            <span className="text-green-400 mr-2">✓</span>
                            <span><strong className="text-white">DOM Stability:</strong> No conditional rendering - all elements always present</span>
                        </li>
                        <li className="flex items-start">
                            <span className="text-green-400 mr-2">✓</span>
                            <span><strong className="text-white">Config-Driven:</strong> All styles from VISUAL_CONFIG in cardConfig.js</span>
                        </li>
                        <li className="flex items-start">
                            <span className="text-green-400 mr-2">✓</span>
                            <span><strong className="text-white">Smooth Transitions:</strong> CSS transition-all duration-300 on all state changes</span>
                        </li>
                        <li className="flex items-start">
                            <span className="text-green-400 mr-2">✓</span>
                            <span><strong className="text-white">Test Coverage:</strong> 19 tests covering rendering, logic, states, interaction, and DOM stability</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default CardBaseDemo;
