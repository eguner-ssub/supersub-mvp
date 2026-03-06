import { getOddsApiKey } from '../config/coverage';

const normalizeName = (name) => {
    return name.toLowerCase()
        .replace(/fc|afc|united|city|football club|hotspur/g, '')
        .trim();
};

const THE_ODDS_API_BASE = 'https://api.the-odds-api.com/v4/sports';

/**
 * Get odds for a match — Database-First protocol.
 *
 * Match Day: Supabase odds column → the-odds-api fallback
 * Other days: the-odds-api → Supabase odds column fallback
 */
export const getHybridOdds = async (match, apiKey) => {
    if (!match) return null;

    const fixtureId = match.fixture?.id || match.id;
    const fixtureDate = match.fixture?.date || match.kickoff_time || match.date;

    if (!fixtureDate) return null;

    const leagueId = match.league?.id || match.league_id;
    const sportKey = getOddsApiKey(leagueId);
    const homeName = match.teams?.home?.name || match.home_team || 'Home';

    // ── Flat flow: the-odds-api → Supabase DB fallback ──
    const apiResult = await tryTheOddsApi(sportKey, apiKey, homeName);
    if (apiResult) return apiResult;

    const dbResult = await tryDbOdds(fixtureId);
    if (dbResult) return dbResult;

    return null;
};

// ── Data Sources ──────────────────────────────────────────────────────────────

async function tryDbOdds(fixtureId) {
    try {
        const res = await fetch(`/api/odds?fixture=${fixtureId}`);
        const data = await res.json();
        const odds = data.response;

        if (odds && (Array.isArray(odds) ? odds.length > 0 : Object.keys(odds).length > 0)) {
            return parseDbOdds(odds);
        }
    } catch (err) {
        console.error("[OddsService] DB read failed:", err);
    }
    return null;
}

async function tryTheOddsApi(sportKey, apiKey, homeName) {
    if (!sportKey) return null;

    try {
        const url = `${THE_ODDS_API_BASE}/${sportKey}/odds?apiKey=${apiKey}&regions=uk,eu&markets=h2h,totals`;
        const res = await fetch(url);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error("Invalid response");

        const foundEvent = data.find(event => {
            const apiHome = normalizeName(event.home_team);
            const localHome = normalizeName(homeName);
            return apiHome.includes(localHome) || localHome.includes(apiHome);
        });

        if (foundEvent) return parseTheOddsApi(foundEvent);
    } catch (err) {
        console.error("[OddsService] The Odds API failed:", err);
    }
    return null;
}

// ── Parsers ───────────────────────────────────────────────────────────────────

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

/**
 * Parse odds stored in the Supabase matches.odds JSONB column.
 * Handles both pre-parsed normalized objects and raw bookmaker arrays.
 */
const parseDbOdds = (odds) => {
    // If already in our normalized shape
    if (odds.home !== undefined && odds.draw !== undefined) {
        return {
            source: 'Database (cached)',
            odds: {
                home: parseFloat(odds.home) || 0,
                draw: parseFloat(odds.draw) || 0,
                away: parseFloat(odds.away) || 0,
                goals_over: parseFloat(odds.goals_over) || 0,
                goals_under: parseFloat(odds.goals_under) || 0,
                supersub_yes: 4.50,
                scorers: odds.scorers || []
            }
        };
    }

    // If stored as API-Football bookmaker format (array with bookmakers)
    if (Array.isArray(odds) && odds.length > 0) {
        const bookmakers = odds[0]?.bookmakers || [];
        const target = bookmakers.find(b => [8, 1, 6, 10, 16, 7].includes(b.id)) || bookmakers[0];
        if (!target) return null;

        const markets = target.bets || [];
        const findMarket = (keywords) => markets.find(m => {
            const name = m.name.toLowerCase();
            return keywords.some(k => name.includes(k.toLowerCase()));
        });

        const matchWinner = findMarket(["Match Winner", "1x2", "Full Time"]);
        const goalsMarket = findMarket(["Goals Over/Under", "Total Goals", "Over/Under"]);

        const getOdd = (market, name) =>
            market?.values?.find(v => v.value.toString().toLowerCase() === name.toLowerCase())?.odd;

        const getGoalsOdd = (direction) => {
            if (!goalsMarket?.values) return 0;
            const found = goalsMarket.values.find(v => {
                const val = v.value.toString();
                return (val.includes(direction) || val.startsWith(direction[0])) && val.includes("2.5");
            });
            return found ? parseFloat(found.odd) : 0;
        };

        return {
            source: `Database (${target.name})`,
            odds: {
                home: parseFloat(getOdd(matchWinner, "Home") || 0),
                draw: parseFloat(getOdd(matchWinner, "Draw") || 0),
                away: parseFloat(getOdd(matchWinner, "Away") || 0),
                goals_over: getGoalsOdd("Over"),
                goals_under: getGoalsOdd("Under"),
                supersub_yes: 4.50,
                scorers: []
            }
        };
    }

    return null;
};