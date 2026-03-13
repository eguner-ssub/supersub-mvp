/**
 * LEAGUE COVERAGE CONFIGURATION
 * Central source of truth for league IDs and API mappings
 */

export const LEAGUE_COVERAGE = {
    EPL: {
        id: 8,
        name: 'Premier League',
        country: 'England',
        seasonType: 'european',
    },
    CHAMPIONSHIP: {
        id: 9,
        name: 'Championship',
        country: 'England',
        seasonType: 'european',
    },
    SERIE_A: {
        id: 384,
        name: 'Serie A',
        country: 'Italy',
        seasonType: 'european',
    },
    LA_LIGA: {
        id: 564,
        name: 'La Liga',
        country: 'Spain',
        seasonType: 'european',
    },
    BUNDESLIGA: {
        id: 82,
        name: 'Bundesliga',
        country: 'Germany',
        seasonType: 'european',
    },
};
// Helper to get league config by league ID
export const getLeagueById = (id) => {
    return Object.values(LEAGUE_COVERAGE).find(league => league.id === id) || null;
};

// Export all league IDs as array for api/matches.js
export const SUPPORTED_LEAGUE_IDS = Object.values(LEAGUE_COVERAGE).map(l => l.id);

// Season calculation helpers
export const getSeasonForLeague = (leagueId) => {
    const league = getLeagueById(leagueId);
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    if (!league) return [currentYear];

    if (league.seasonType === 'european') {
        // European: Jan-May = previous year season
        const season = currentMonth < 6 ? currentYear - 1 : currentYear;
        return [season];
    } else {
        // Calendar year: try current year first, then previous
        return [currentYear, currentYear - 1];
    }
};