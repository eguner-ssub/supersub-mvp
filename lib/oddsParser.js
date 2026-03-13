// lib/oddsParser.js
//
// Shared Sportmonks odds parsers used by:
//   api/odds/sportmonks.js  — live endpoint
//   scripts/backfill-sportmonks.js — odds caching during fixture backfill
//
// Bookmaker preference:
//   Bet365 (bookmaker_id 2) is the most complete bookmaker across all five
//   supported leagues (EPL, Championship, Bundesliga, Serie A, La Liga).
//   Verify via GET /v3/odds/bookmakers?api_token=<token> if this ever changes.

export const PREFERRED_BOOKMAKER_ID = 2; // Bet365

// Market IDs
export const MARKET_MATCH_RESULT     = 1;
export const MARKET_OVER_UNDER       = 80;
export const MARKET_FIRST_GOALSCORER = 8;

export const ALL_MARKETS = [MARKET_MATCH_RESULT, MARKET_OVER_UNDER, MARKET_FIRST_GOALSCORER];

/**
 * From an array of odds objects for a single market, pick the preferred
 * bookmaker_id. Falls back to the lowest available ID if preferred is absent.
 *
 * @param {object[]} market - Odds rows already filtered to one market
 * @returns {number} bookmaker_id to use
 */
export function pickBookmaker(market) {
    const ids = [...new Set(market.map(o => o.bookmaker_id))].sort((a, b) => a - b);
    return ids.includes(PREFERRED_BOOKMAKER_ID) ? PREFERRED_BOOKMAKER_ID : ids[0];
}

/**
 * Parse market 1 (1X2 / Match Result).
 * @param {object[]} odds - Full odds array for a fixture
 * @returns {{ home: number, draw: number, away: number, bookmaker_id: number } | null}
 */
export function parseMatchResult(odds) {
    const market = odds.filter(o => o.market_id === MARKET_MATCH_RESULT);
    if (market.length === 0) return null;

    const bookmaker_id = pickBookmaker(market);
    const filtered = market.filter(o => o.bookmaker_id === bookmaker_id);

    const home = filtered.find(o => o.label === 'Home');
    const draw = filtered.find(o => o.label === 'Draw');
    const away = filtered.find(o => o.label === 'Away');

    return {
        home: home ? parseFloat(home.value) : 0,
        draw: draw ? parseFloat(draw.value) : 0,
        away: away ? parseFloat(away.value) : 0,
        bookmaker_id,
    };
}

/**
 * Parse market 80 (Over/Under Goals), hard-coded to the 2.5 line.
 * @param {object[]} odds
 * @returns {{ over_2_5: number, under_2_5: number, bookmaker_id: number } | null}
 */
export function parseTotalGoals(odds) {
    const market = odds.filter(o => o.market_id === MARKET_OVER_UNDER);
    if (market.length === 0) return null;

    const bookmaker_id = pickBookmaker(market);
    const filtered = market.filter(o => o.bookmaker_id === bookmaker_id);

    const over  = filtered.find(o => o.label === 'Over'  && String(o.total) === '2.5');
    const under = filtered.find(o => o.label === 'Under' && String(o.total) === '2.5');

    return {
        over_2_5:  over  ? parseFloat(over.value)  : 0,
        under_2_5: under ? parseFloat(under.value) : 0,
        bookmaker_id,
    };
}

/**
 * Parse market 8 (First Goalscorer).
 * Returns players sorted by odds ascending (most likely scorers first).
 * @param {object[]} odds
 * @returns {Array<{ player_id: number|null, player_name: string, odds: number }> | null}
 */
export function parseFirstGoalscorer(odds) {
    const market = odds.filter(o => o.market_id === MARKET_FIRST_GOALSCORER);
    if (market.length === 0) return null;

    const bookmaker_id = pickBookmaker(market);
    const filtered = market.filter(o => o.bookmaker_id === bookmaker_id);

    return filtered
        .map(o => ({
            player_id:   o.player_id ?? null,
            player_name: o.name || o.label || 'Unknown',
            odds:        parseFloat(o.value) || 0,
            bookmaker_id,
        }))
        .filter(p => p.odds > 0)
        .sort((a, b) => a.odds - b.odds);
}
