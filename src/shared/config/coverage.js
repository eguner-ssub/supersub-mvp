/**
 * LEAGUE COVERAGE CONFIGURATION
 * Central source of truth for league IDs and API mappings
 */

export const LEAGUE_COVERAGE = {
    // English Premier League
    EPL: {
        id: 39,
        name: 'Premier League',
        country: 'England',
        theOddsApiKey: 'soccer_epl',
        seasonType: 'european', // Aug-May
    },

    // English Championship
    CHAMPIONSHIP: {
        id: 40,
        name: 'Championship',
        country: 'England',
        theOddsApiKey: 'soccer_england_efl_championship',
        seasonType: 'european',
    },

    // Brazilian Série A
    SERIE_A_BRAZIL: {
        id: 71,
        name: 'Série A',
        country: 'Brazil',
        theOddsApiKey: 'soccer_brazil_campeonato',
        seasonType: 'calendar', // Jan-Dec
    },

    // Saudi Pro League
    SAUDI_PRO_LEAGUE: {
        id: 307,
        name: 'Pro League',
        country: 'Saudi Arabia',
        theOddsApiKey: 'soccer_saudi_arabia_pro_league',
        seasonType: 'european',
    },
};

// Helper to get league config by API-Football ID
export const getLeagueById = (id) => {
    return Object.values(LEAGUE_COVERAGE).find(league => league.id === id) || null;
};

// Helper to get The Odds API sport key by league ID
export const getOddsApiKey = (leagueId) => {
    const league = getLeagueById(leagueId);
    return league?.theOddsApiKey || null;
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