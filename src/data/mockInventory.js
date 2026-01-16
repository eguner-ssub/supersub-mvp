// Mock data for Inventory System
// This simulates active predictions and consumables until we have a live predictions table

export const mockCardsInPlay = [
    {
        id: 1,
        match: 'Arsenal vs Spurs',
        cardType: 'HOME_WIN',
        coins: 400,
        status: 'OPEN',
        homeTeam: 'Arsenal',
        awayTeam: 'Spurs'
    },
    {
        id: 2,
        match: 'Real Madrid vs Barca',
        cardType: 'BOTH_SCORE',
        coins: 250,
        status: 'OPEN',
        homeTeam: 'Real Madrid',
        awayTeam: 'Barca'
    },
    {
        id: 3,
        match: 'Man City vs Liverpool',
        cardType: 'AWAY_WIN',
        coins: 300,
        status: 'OPEN',
        homeTeam: 'Man City',
        awayTeam: 'Liverpool'
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
