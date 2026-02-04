// HELPER: Normalize strings for fuzzy matching
const normalizeName = (name) => {
    return name.toLowerCase()
        .replace(/fc|afc|united|city|football club|hotspur/g, '')
        .trim();
};

const THE_ODDS_API_BASE = 'https://api.the-odds-api.com/v4/sports/soccer_epl/odds';

export const getHybridOdds = async (match, apiKey) => {
    if (!match || !match.fixture) return null;

    const matchDate = new Date(match.fixture.date);
    const today = new Date();

    // Check if it's strictly Match Day (YYYY-MM-DD comparison)
    const isMatchDay = matchDate.toDateString() === today.toDateString();

    // --- MODE A: LIVE / MATCH DAY (API-FOOTBALL) ---
    if (isMatchDay) {
        console.log("📡 SERVICE: Match Day Detected. Fetching LIVE data (API-Football)...");
        try {
            // Use local proxy
            const res = await fetch(`/api/odds?fixture=${match.fixture.id}`);
            const data = await res.json();
            return parseApiFootball(data, match.fixture.status.short === 'LIVE');
        } catch (err) {
            console.error("API-Football Failed:", err);
            return null;
        }
    }

    // --- MODE B: PRE-MATCH (THE ODDS API) ---
    else {
        console.log("📅 SERVICE: Pre-Match. Fetching standard odds (The Odds API)...");
        try {
            const url = `${THE_ODDS_API_BASE}?apiKey=${apiKey}&regions=uk&markets=h2h,totals`;
            const res = await fetch(url);
            const data = await res.json();

            if (!Array.isArray(data)) throw new Error("Invalid response from The Odds API");

            // Find the specific match by fuzzy comparing Team Names
            const foundEvent = data.find(event => {
                const apiHome = normalizeName(event.home_team);
                const localHome = normalizeName(match.teams.home.name);
                return apiHome.includes(localHome) || localHome.includes(apiHome);
            });

            if (!foundEvent) {
                console.warn("⚠️ Match not found in The Odds API feed.");
                return null;
            }

            return parseTheOddsApi(foundEvent);
        } catch (err) {
            console.error("The Odds API Failed:", err);
            return null;
        }
    }
};

// --- PARSERS ---

const parseTheOddsApi = (event) => {
    // Priority: William Hill, Unibet, or first available
    const bookmakers = event.bookmakers;
    const target = bookmakers.find(b => ['williamhill', 'unibet'].includes(b.key)) || bookmakers[0];

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
            goals_over: totals?.outcomes.find(o => o.name === 'Over')?.price || 0,
            goals_under: totals?.outcomes.find(o => o.name === 'Under')?.price || 0,
            supersub_yes: 4.50, // Fixed
            scorers: [] // MARKET UNAVAILABLE IN FREE TIER
        }
    };
};

const parseApiFootball = (data, isLive) => {
    // Robust parsing logic
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

    const findMarket = (nameKey) => markets.find(m => m.name.toLowerCase().includes(nameKey.toLowerCase()));
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
            goals_over: goals?.values.find(v => v.value.includes("Over") && v.value.includes("2.5"))?.odd || 0,
            goals_under: goals?.values.find(v => v.value.includes("Under") && v.value.includes("2.5"))?.odd || 0,
            supersub_yes: 4.50,
            scorers: scorers ? scorers.values.map((p, i) => ({ id: i, name: p.value, odds: p.odd })).slice(0, 15) : []
        }
    };
};
