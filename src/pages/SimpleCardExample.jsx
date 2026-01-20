import React, { useState } from 'react';
import CardBase from '../components/CardBase';
import { CARD_TYPES, CARD_STATES } from '../utils/cardConfig';

/**
 * Simple Example - Demonstrating CardBase State Transitions
 * 
 * This example shows how to implement the betting flow:
 * DEFAULT → SELECTED → PENDING → WON/LOST
 */
const SimpleCardExample = () => {
    const [state, setState] = useState(CARD_STATES.DEFAULT);

    const handleCardClick = () => {
        if (state === CARD_STATES.DEFAULT) {
            setState(CARD_STATES.SELECTED);
        }
    };

    const placeBet = () => {
        setState(CARD_STATES.PENDING);

        // Simulate match result after 3 seconds
        setTimeout(() => {
            const won = Math.random() > 0.5;
            setState(won ? CARD_STATES.WON : CARD_STATES.LOST);
        }, 3000);
    };

    const reset = () => {
        setState(CARD_STATES.DEFAULT);
    };

    return (
        <div className="min-h-screen bg-gray-900 p-8">
            <div className="max-w-md mx-auto">
                <h1 className="text-3xl font-bold text-white mb-8 text-center">
                    Simple CardBase Example
                </h1>

                {/* Card */}
                <div className="w-64 mx-auto mb-8">
                    <CardBase
                        type={CARD_TYPES.MATCH_RESULT}
                        state={state}
                        backgroundImage="https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&h=600&fit=crop"
                        label="Match Result"
                        subLabel="Home Win"
                        onClick={handleCardClick}
                    />
                </div>

                {/* Controls */}
                <div className="space-y-3">
                    <div className="text-center text-sm text-gray-400 mb-4">
                        Current State: <span className="text-white font-bold">{state}</span>
                    </div>

                    <button
                        onClick={placeBet}
                        disabled={state !== CARD_STATES.SELECTED}
                        className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-lg transition-all"
                    >
                        Place Bet
                    </button>

                    <button
                        onClick={reset}
                        className="w-full px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg transition-all"
                    >
                        Reset
                    </button>
                </div>

                {/* Instructions */}
                <div className="mt-8 p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <h3 className="text-white font-bold mb-2">How to use:</h3>
                    <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
                        <li>Click the card to SELECT it (blue ring appears)</li>
                        <li>Click "Place Bet" to enter PENDING state (yellow pulse)</li>
                        <li>Wait 3 seconds for simulated result (WON or LOST)</li>
                        <li>Click "Reset" to start over</li>
                    </ol>
                </div>
            </div>
        </div>
    );
};

export default SimpleCardExample;
