#!/bin/bash

# Script to add data-testid attributes to MatchDetail.jsx

cd "$(dirname "$0")/../src/features/match-day" || exit 1

echo "🔧 Adding test IDs to MatchDetail.jsx..."

# Add data-testid to trapezoid HUD (scoreboard)
sed -i '' 's|<div className="relative w-full max-w-lg mx-auto h-14 flex items-center justify-center drop-shadow-2xl mt-3">|<div data-testid="trapezoid-hud" className="relative w-full max-w-lg mx-auto h-14 flex items-center justify-center drop-shadow-2xl mt-3">|g' MatchDetail.jsx

# Add data-testid to card shelf container
sed -i '' 's|<div className="absolute inset-0 flex justify-center items-end gap-3 pb-14 px-4 overflow-x-auto no-scrollbar z-20 pointer-events-auto">|<div data-testid="card-shelf" className="absolute inset-0 flex justify-center items-end gap-3 pb-14 px-4 overflow-x-auto no-scrollbar z-20 pointer-events-auto">|g' MatchDetail.jsx

# Add data-testid to individual cards (need to add to button element)
# This is more complex - we'll add it to the button with key={card.id}
sed -i '' 's|<button$|<button data-testid={`card-${card.id}`}|g' MatchDetail.jsx
sed -i '' 's|key={card.id}$|key={card.id} data-testid={`card-${card.id}`}|g' MatchDetail.jsx

echo "✅ Test IDs added to MatchDetail.jsx!"
