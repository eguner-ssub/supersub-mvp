import 'dotenv/config';

// ── Sportmonks odds endpoint ─────────────────────────────────────────────────
// GET /api/odds/sportmonks?fixture=<sportmonks_fixture_id>
//
// Fetches pre-match odds from Sportmonks for markets:
//   1  — Match Result (1X2)
//   80 — Over/Under Goals
//   8  — First Goalscorer
//
// Returns normalized odds or 404 if no odds available. Never returns simulated data.

const BASE_URL = 'https://api.sportmonks.com/v3/football';

function getToken() {
    const token = process.env.SPORTMONKS_API_TOKEN;
    if (!token) throw new Error('Missing env var SPORTMONKS_API_TOKEN');
    return token;
}

// ── Market IDs ───────────────────────────────────────────────────────────────
const MARKET_MATCH_RESULT = 1;
const MARKET_OVER_UNDER = 80;
const MARKET_FIRST_GOALSCORER = 8;

const ALL_MARKETS = [MARKET_MATCH_RESULT, MARKET_OVER_UNDER, MARKET_FIRST_GOALSCORER];

// ── Parsers ──────────────────────────────────────────────────────────────────

function parseMatchResult(odds) {
    const market = odds.filter(o => o.market_id === MARKET_MATCH_RESULT);
    if (market.length === 0) return null;

    // Pick lowest bookmaker_id as canonical (most consistent)
    const bookmakers = [...new Set(market.map(o => o.bookmaker_id))].sort((a, b) => a - b);
    const bookmaker = bookmakers[0];
    const filtered = market.filter(o => o.bookmaker_id === bookmaker);

    const home = filtered.find(o => o.label === 'Home');
    const draw = filtered.find(o => o.label === 'Draw');
    const away = filtered.find(o => o.label === 'Away');

    return {
        home: home ? parseFloat(home.value) : 0,
        draw: draw ? parseFloat(draw.value) : 0,
        away: away ? parseFloat(away.value) : 0,
    };
}

function parseTotalGoals(odds) {
    const market = odds.filter(o => o.market_id === MARKET_OVER_UNDER);
    if (market.length === 0) return null;

    // Filter to Over/Under 2.5 specifically
    const bookmakers = [...new Set(market.map(o => o.bookmaker_id))].sort((a, b) => a - b);
    const bookmaker = bookmakers[0];
    const filtered = market.filter(o => o.bookmaker_id === bookmaker);

    // total field contains the line (e.g. "2.5")
    const over = filtered.find(o => o.label === 'Over' && String(o.total) === '2.5');
    const under = filtered.find(o => o.label === 'Under' && String(o.total) === '2.5');

    return {
        over_2_5: over ? parseFloat(over.value) : 0,
        under_2_5: under ? parseFloat(under.value) : 0,
    };
}

function parseFirstGoalscorer(odds) {
    const market = odds.filter(o => o.market_id === MARKET_FIRST_GOALSCORER);
    if (market.length === 0) return null;

    // Pick one bookmaker for consistency
    const bookmakers = [...new Set(market.map(o => o.bookmaker_id))].sort((a, b) => a - b);
    const bookmaker = bookmakers[0];
    const filtered = market.filter(o => o.bookmaker_id === bookmaker);

    // For goalscorer markets: label/name = player name, participants may contain player info
    return filtered.map(o => ({
        player_id: o.player_id ?? null,
        player_name: o.name || o.label || 'Unknown',
        odds: parseFloat(o.value) || 0,
        participants: o.participants ?? null,
    })).filter(p => p.odds > 0)
      .sort((a, b) => a.odds - b.odds); // lowest odds first (most likely scorers)
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
    const { fixture } = req.query;

    if (!fixture) {
        return res.status(400).json({ error: 'Missing fixture query parameter' });
    }

    try {
        const token = getToken();
        const url = `${BASE_URL}/odds/pre-match/fixtures/${fixture}?api_token=${token}&filters=markets:${ALL_MARKETS.join(',')}`;

        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 404) {
                return res.status(404).json({ error: 'No odds available for this fixture' });
            }
            const body = await response.text();
            console.error(`[Sportmonks Odds] API error ${response.status}:`, body);
            return res.status(502).json({ error: 'Sportmonks API error' });
        }

        const json = await response.json();
        const odds = json.data || [];

        if (odds.length === 0) {
            return res.status(404).json({ error: 'No odds available for this fixture' });
        }

        // Check pagination — fetch remaining pages if needed
        let allOdds = [...odds];
        let pagination = json.pagination;
        while (pagination?.has_more) {
            const nextPage = (pagination.current_page || 1) + 1;
            const pageUrl = `${url}&page=${nextPage}`;
            const pageRes = await fetch(pageUrl);
            if (!pageRes.ok) break;
            const pageJson = await pageRes.json();
            allOdds = allOdds.concat(pageJson.data || []);
            pagination = pageJson.pagination;
        }

        const result = {
            source: 'Sportmonks',
            fixture_id: Number(fixture),
            match_result: parseMatchResult(allOdds),
            total_goals: parseTotalGoals(allOdds),
            first_goalscorer: parseFirstGoalscorer(allOdds),
        };

        return res.status(200).json(result);
    } catch (err) {
        console.error('[Sportmonks Odds] Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
}
