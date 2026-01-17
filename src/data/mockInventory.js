// Enhanced Mock Data for Locker Room System
// Cards are organized by status: AVAILABLE, PENDING, LIVE, SETTLED

export const mockCards = [
    // AVAILABLE - Cards in the Kit Bag (unused)
    {
        id: 1,
        type: 'c_match_result',
        status: 'AVAILABLE',
        label: 'Match Result',
        img: '/cards/card_match_result.webp'
    },
    {
        id: 2,
        type: 'c_total_goals',
        status: 'AVAILABLE',
        label: 'Total Goals',
        img: '/cards/card_total_goals.webp'
    },
    {
        id: 3,
        type: 'c_player_score',
        status: 'AVAILABLE',
        label: 'Player Score',
        img: '/cards/card_player_score.webp'
    },

    // PENDING - Bets placed on future matches (The Whiteboard)
    {
        id: 4,
        type: 'c_match_result',
        status: 'PENDING',
        match: 'Arsenal vs Spurs',
        homeTeam: 'Arsenal',
        awayTeam: 'Spurs',
        prediction: 'HOME_WIN',
        predictionLabel: 'Home Win',
        stake: 400,
        potentialWin: 800,
        kickoff: '2026-01-20T15:00:00',
        kickoffLabel: 'Jan 20, 15:00'
    },
    {
        id: 5,
        type: 'c_both_score',
        status: 'PENDING',
        match: 'Chelsea vs Man Utd',
        homeTeam: 'Chelsea',
        awayTeam: 'Man Utd',
        prediction: 'BOTH_SCORE',
        predictionLabel: 'Both Teams Score',
        stake: 200,
        potentialWin: 350,
        kickoff: '2026-01-21T17:30:00',
        kickoffLabel: 'Jan 21, 17:30'
    },

    // LIVE - Bets currently in play (The Tablet)
    {
        id: 6,
        type: 'c_both_score',
        status: 'LIVE',
        match: 'Man City vs Liverpool',
        homeTeam: 'Man City',
        awayTeam: 'Liverpool',
        prediction: 'BOTH_SCORE',
        predictionLabel: 'Both Teams Score',
        stake: 300,
        potentialWin: 600,
        minute: '45+2',
        score: '1-1',
        homeScore: 1,
        awayScore: 1
    },
    {
        id: 7,
        type: 'c_match_result',
        status: 'LIVE',
        match: 'Bayern vs Dortmund',
        homeTeam: 'Bayern',
        awayTeam: 'Dortmund',
        prediction: 'HOME_WIN',
        predictionLabel: 'Home Win',
        stake: 500,
        potentialWin: 1000,
        minute: '67',
        score: '2-1',
        homeScore: 2,
        awayScore: 1
    },

    // SETTLED - Past results (The Ledger)
    {
        id: 8,
        type: 'c_match_result',
        status: 'SETTLED',
        match: 'Real Madrid vs Barca',
        homeTeam: 'Real Madrid',
        awayTeam: 'Barca',
        prediction: 'AWAY_WIN',
        predictionLabel: 'Away Win',
        stake: 250,
        result: 'WON',
        payout: 500,
        finalScore: '1-2',
        settledAt: '2026-01-15T22:00:00'
    },
    {
        id: 9,
        type: 'c_total_goals',
        status: 'SETTLED',
        match: 'PSG vs Lyon',
        homeTeam: 'PSG',
        awayTeam: 'Lyon',
        prediction: 'OVER_2_5',
        predictionLabel: 'Over 2.5 Goals',
        stake: 150,
        result: 'LOST',
        payout: 0,
        finalScore: '1-1',
        settledAt: '2026-01-14T21:00:00'
    },
    {
        id: 10,
        type: 'c_match_result',
        status: 'SETTLED',
        match: 'Juventus vs Inter',
        homeTeam: 'Juventus',
        awayTeam: 'Inter',
        prediction: 'DRAW',
        predictionLabel: 'Draw',
        stake: 100,
        result: 'WON',
        payout: 300,
        finalScore: '2-2',
        settledAt: '2026-01-13T20:00:00'
    }
];

export const mockConsumables = {
    energy_drinks: 3
};

// Helper function to get card type display name
export const getCardTypeDisplay = (cardType) => {
    const displayNames = {
        'HOME_WIN': 'Home Win',
        'AWAY_WIN': 'Away Win',
        'DRAW': 'Draw',
        'BOTH_SCORE': 'Both Teams Score',
        'OVER_2_5': 'Over 2.5 Goals',
        'UNDER_2_5': 'Under 2.5 Goals'
    };
    return displayNames[cardType] || cardType;
};

// Helper function to get card type icon
export const getCardTypeIcon = (cardType) => {
    const icons = {
        'HOME_WIN': '🏠',
        'AWAY_WIN': '✈️',
        'DRAW': '🤝',
        'BOTH_SCORE': '⚽⚽',
        'OVER_2_5': '🔥',
        'UNDER_2_5': '❄️'
    };
    return icons[cardType] || '🎴';
};

// Helper to get cards by status
export const getCardsByStatus = (status) => {
    return mockCards.filter(card => card.status === status);
};

// Legacy export for backward compatibility
export const mockCardsInPlay = mockCards.filter(c => c.status === 'LIVE' || c.status === 'PENDING');
