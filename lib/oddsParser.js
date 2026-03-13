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
export const MARKET_MATCH_RESULT = 1;
export const MARKET_OVER_UNDER   = 80;
// Goalscorers market (id 8) is included in the URL filter but parsed
// by string fields (market_description / label) rather than market_id.
export const MARKET_GOALSCORERS  = 8;

export const ALL_MARKETS = [MARKET_MATCH_RESULT, MARKET_OVER_UNDER, MARKET_GOALSCORERS];

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
 * Parse Goalscorers market (Anytime scorer).
 * Requires ?include=market on the Sportmonks odds URL so that
 * market_description is populated on each odds record.
 * Filters by market_description === 'Goalscorers' and label === 'Anytime'.
 * Returns players sorted by odds ascending (most likely scorers first).
 * @param {object[]} odds
 * @returns {Array<{ player_name: string, odds: number }> | null}
 */
export function parseGoalscorers(odds) {
    // Step 1: isolate Goalscorers/Anytime entries across all bookmakers
    const market = odds.filter(
        o => o.market_description === 'Goalscorers' && o.label === 'Anytime',
    );
    console.log('[parseGoalscorers] market_description+label filter count:', market.length);

    if (market.length === 0) {
        // Diagnostic fallback: log what market_id===8 entries look like so we
        // can verify field names if the filter still fails after ?include=market
        const byId = odds.filter(o => o.market_id === 8);
        console.log('[parseGoalscorers] market_id===8 fallback count:', byId.length);
        if (byId.length > 0) {
            const s = byId[0];
            console.log('[parseGoalscorers] market_id===8 sample fields:', {
                market_description: s.market_description,
                label:              s.label,
                name:               s.name,
                value:              s.value,
            });
        }
        return null;
    }

    // Step 2: pick preferred bookmaker
    const bookmaker_id = pickBookmaker(market);
    const filtered = market.filter(o => o.bookmaker_id === bookmaker_id);
    console.log('[parseGoalscorers] after bookmaker filter count:', filtered.length);

    // Step 3: map — name is the player name on Sportmonks goalscorer records
    const result = filtered
        .map(o => ({
            player_name: o.name,
            odds:        parseFloat(o.value) || 0,
        }))
        .filter(p => p.odds > 0)
        .sort((a, b) => a.odds - b.odds);

    console.log('[parseGoalscorers] final result count:', result.length);
    return result.length > 0 ? result : null;
}
