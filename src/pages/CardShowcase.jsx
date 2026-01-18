import React from 'react';
import CardBase from '../components/CardBase';
import { CARD_CONFIG } from '../utils/cardConfig';

/**
 * CardShowcase - Demo Component
 * 
 * Demonstrates the new CardBase component with all rarity tiers
 * This file shows how to integrate CardBase into existing components
 */
const CardShowcase = () => {
    return (
        <div className="min-h-screen bg-gray-900 p-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-4xl font-black text-white uppercase tracking-wider mb-8 text-center">
                    Card System Refactor
                </h1>

                {/* Rarity Tiers */}
                <div className="space-y-12">
                    {/* Common Cards */}
                    <div>
                        <h2 className="text-2xl font-bold text-gray-400 uppercase tracking-wide mb-4">
                            Common (Gray)
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <CardBase
                                rarity="common"
                                role="total_goals"
                                label="Total Goals"
                            />
                        </div>
                    </div>

                    {/* Rare Cards */}
                    <div>
                        <h2 className="text-2xl font-bold text-blue-400 uppercase tracking-wide mb-4">
                            Rare (Blue)
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <CardBase
                                rarity="rare"
                                role="match_result"
                                label="Match Result"
                            />
                        </div>
                    </div>

                    {/* Legendary Cards */}
                    <div>
                        <h2 className="text-2xl font-bold text-yellow-400 uppercase tracking-wide mb-4">
                            Legendary (Gold)
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <CardBase
                                rarity="legendary"
                                role="player_score"
                                label="Player Score"
                            />
                            <CardBase
                                rarity="legendary"
                                role="supersub"
                                label="Super Sub"
                            />
                        </div>
                    </div>
                </div>

                {/* Integration Example */}
                <div className="mt-16 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-6">
                    <h3 className="text-xl font-black text-white uppercase mb-4">
                        Integration Example
                    </h3>
                    <pre className="text-sm text-green-400 font-mono overflow-x-auto">
                        {`// OLD WAY (Static PNG)
<img 
  src="/cards/card_match_result.webp" 
  alt="Match Result"
  className="w-full h-full object-contain"
/>

// NEW WAY (Pure CSS/SVG)
import CardBase from '../components/CardBase';
import { getCardConfig } from '../utils/cardConfig';

const config = getCardConfig('c_match_result');
<CardBase 
  rarity={config.rarity} 
  role={config.role} 
  label={config.label}
/>`}
                    </pre>
                </div>
            </div>
        </div>
    );
};

export default CardShowcase;
