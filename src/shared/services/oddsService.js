import { getOddsApiKey } from '../config/coverage';

const normalizeName = (name) => {
    return name.toLowerCase()
        .replace(/fc|afc|united|city|football club|hotspur/g, '')
        .trim();
};

const THE_ODDS_API_BASE = 'https://api.the-odds-api.com/v4/sports';

export const getHybridOdds = async (match, apiKey) => {
    if (!match || !match.fixture) return null;

    const matchDate = new Date(match.fixture.date);
    const today = new Date();
    const isMatchDay = matchDate.toDateString() === today.toDateString();

    if (isMatchDay) {
        try {
            const res = await fetch(`/api/odds?fixture=${match.fixture.id}`);
            const data = await res.json();
            return parseApiFootball(data, match.fixture.status.short === 'LIVE');
        } catch (err) {
            console.error("API-Football Failed:", err);
            return null;
        }
    } else {
        const leagueId = match.league?.id;
        const sportKey = getOddsApiKey(leagueId);
        if (!sportKey) return null;

        try {
            const url = `${THE_ODDS_API_BASE}/${sportKey}/odds?apiKey=${apiKey}&regions=uk,eu&markets=h2h,totals`;
            const res = await fetch(url);
            const data = await res.json();
            if (!Array.isArray(data)) throw new Error("Invalid response");

            const foundEvent = data.find(event => {
                const apiHome = normalizeName(event.home_team);
                const localHome = normalizeName(match.teams.home.name);
                return apiHome.includes(localHome) || localHome.includes(apiHome);
            });

            return foundEvent ? parseTheOddsApi(foundEvent) : null;
        } catch (err) {
            console.error("The Odds API Failed:", err);
            return null;
        }
    }
};

/**
 * PARSE THE ODDS API
 * Specifically targets the 2.5 totals line
 */
const parseTheOddsApi = (event) => {
    const bookmakers = event.bookmakers || [];
    const preferredKeys = ['williamhill', 'unibet', 'betfair', 'bet365', 'pinnacle'];
    const target = bookmakers.find(b => preferredKeys.includes(b.key)) || bookmakers[0];
    if (!target) return null;

    const h2h = target.markets.find(m => m.key === 'h2h');
    const totals = target.markets.find(m => m.key === 'totals');

    const getPrice = (outcomes, name) => outcomes?.find(o => o.name === name)?.price;

    return {
        source: `The Odds API (${target.title})`,
        odds: {
            home: getPrice(h2h?.outcomes, event.home_team) || 0,
            away: getPrice(h2h?.outcomes, event.away_team) || 0,
            draw: getPrice(h2h?.outcomes, 'Draw') || 0,
            // FIX: Explicitly find the 2.5 point line to avoid incorrect rewards
            goals_over: totals?.outcomes.find(o => o.name === 'Over' && o.point === 2.5)?.price || 0,
            goals_under: totals?.outcomes.find(o => o.name === 'Under' && o.point === 2.5)?.price || 0,
            supersub_yes: 4.50,
            scorers: []
        }
    };
};

/**
 * PARSE API-FOOTBALL
 * Fixes the "Broad Matching" bug that was pulling team-specific goals
 */
const parseApiFootball = (data, isLive) => {
    let markets = [];
    let bookmakerName = isLive ? "LIVE" : "Official Odds";

    if (isLive) {
        markets = data.response?.[0]?.odds || [];
    } else {
        const bookmakers = data.response?.[0]?.bookmakers || [];
        const target = bookmakers.find(b => [6, 10, 16, 7].includes(b.id)) || bookmakers[0];
        if (target) {
            markets = target.bets;
            bookmakerName = target.name;
        }
    }

    if (!markets || markets.length === 0) return null;

    // FIX: Changed from .includes() to exact match to avoid "Away Team Goals Over/Under"
    const findMarket = (nameKey) => markets.find(m => m.name.toLowerCase() === nameKey.toLowerCase());

    const matchWinner = findMarket("Match Winner") || findMarket("1x2");
    const goals = findMarket("Goals Over/Under");
    const scorers = findMarket("Anytime Goalscorer") || findMarket("Goalscorers");

    const getOdd = (market, name) => market?.values.find(v => v.value.toString().toLowerCase() === name.toLowerCase())?.odd;

    return {
        source: `API-Football (${bookmakerName})`,
        odds: {
            home: getOdd(matchWinner, "Home") || 0,
            draw: getOdd(matchWinner, "Draw") || 0,
            away: getOdd(matchWinner, "Away") || 0,
            // FIX: Robustly filter for the "2.5" string within the values array
            goals_over: goals?.values.find(v => v.value.toString().includes("Over") && v.value.toString().includes("2.5"))?.odd || 0,
            goals_under: goals?.values.find(v => v.value.toString().includes("Under") && v.value.toString().includes("2.5"))?.odd || 0,
            supersub_yes: 4.50,
            scorers: scorers ? scorers.values.map((p, i) => ({ id: i, name: p.value, odds: p.odd })).slice(0, 15) : []
        }
    };
};