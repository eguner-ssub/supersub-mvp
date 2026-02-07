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
            goals_over: totals?.outcomes.find(o => o.name === 'Over' && o.point === 2.5)?.price || 0,
            goals_under: totals?.outcomes.find(o => o.name === 'Under' && o.point === 2.5)?.price || 0,
            supersub_yes: 4.50,
            scorers: []
        }
    };
};

const parseApiFootball = (data, isLive) => {
    let markets = [];
    let bookmakerName = isLive ? "LIVE" : "Official Odds";

    if (isLive) {
        markets = data.response?.[0]?.odds || [];
    } else {
        const bookmakers = data.response?.[0]?.bookmakers || [];
        const target = bookmakers.find(b => [8, 1, 6, 10, 16, 7].includes(b.id)) || bookmakers[0];
        if (target) {
            markets = target.bets;
            bookmakerName = target.name;
        }
    }

    if (!markets || markets.length === 0) return null;

    // Robust matching for various bookmaker naming conventions
    const findMarket = (searchTerms) => markets.find(m => {
        const name = m.name.toLowerCase();
        const isTarget = searchTerms.some(term => name.includes(term.toLowerCase()));
        const isTeamSpecific = name.includes("home") || name.includes("away") || name.includes("team");
        return isTarget && !isTeamSpecific;
    });

    const matchWinner = findMarket(["match winner", "1x2", "full time result"]);
    const goalsMarket = findMarket(["goals over/under", "total goals", "over/under"]);
    const scorers = findMarket(["anytime goalscorer", "goalscorers", "to score anytime"]);

    const getOdd = (market, name) => {
        return market?.values?.find(v => v.value.toString().toLowerCase() === name.toLowerCase())?.odd;
    };

    const getGoalsOdd = (direction) => {
        if (!goalsMarket?.values) return 0;
        const found = goalsMarket.values.find(v => {
            const val = v.value.toString();
            return (val.includes(direction) || val.startsWith(direction[0])) && val.includes("2.5");
        });
        return found ? parseFloat(found.odd) : 0;
    };

    return {
        source: `API-Football (${bookmakerName})`,
        odds: {
            home: parseFloat(getOdd(matchWinner, "Home") || 0),
            draw: parseFloat(getOdd(matchWinner, "Draw") || 0),
            away: parseFloat(getOdd(matchWinner, "Away") || 0),
            goals_over: getGoalsOdd("Over"),
            goals_under: getGoalsOdd("Under"),
            supersub_yes: 4.50,
            scorers: scorers ? scorers.values.map((p, i) => ({
                id: i,
                name: p.value,
                odds: parseFloat(p.odd)
            })).slice(0, 15) : []
        }
    };
};