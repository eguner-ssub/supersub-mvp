import 'dotenv/config';
import {
    ALL_MARKETS,
    parseMatchResult,
    parseTotalGoals,
    parseGoalscorers,
} from '../../lib/oddsParser.js';

// ── Sportmonks odds endpoint ─────────────────────────────────────────────────
// GET /api/odds/sportmonks?fixture=<matches.id (Sportmonks fixture ID)>
//
// Fetches pre-match odds from Sportmonks for markets:
//   1  — Match Result (1X2)
//   80 — Over/Under Goals
//   8  — Goalscorers (Anytime scorer, filtered by string fields)
//
// matches.id now stores Sportmonks fixture IDs natively (migration 021).
// No ID translation is needed.
//
// Bookmaker preference: Bet365 (id 2) — see lib/oddsParser.js for details.

const BASE_URL = 'https://api.sportmonks.com/v3/football';

function getToken() {
    const token = process.env.SPORTMONKS_API_TOKEN;
    if (!token) throw new Error('Missing env var SPORTMONKS_API_TOKEN');
    return token;
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
    const { fixture } = req.query;

    if (!fixture) {
        return res.status(400).json({ error: 'Missing fixture query parameter' });
    }

    try {
        const token = getToken();

        // matches.id is now the Sportmonks fixture ID directly (migration 021)
        const sportmonksId = Number(fixture);

        const url = `${BASE_URL}/odds/pre-match/fixtures/${sportmonksId}?api_token=${token}&filters=markets:${ALL_MARKETS.join(',')}&include=market`;

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

        // Fetch remaining pages if paginated
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

        // ── Diagnostic: log raw odds shape before parsing ─────────────────────
        console.log('[Sportmonks Odds] Total odds records:', allOdds.length);
        if (allOdds.length > 0) {
            console.log('[Sportmonks Odds] Sample record fields:', Object.keys(allOdds[0]));
        }
        const market8 = allOdds.filter(o => o.market_id === 8);
        console.log('[Sportmonks Odds] market_id===8 count:', market8.length);
        if (market8.length > 0) {
            console.log('[Sportmonks Odds] market_id===8 sample:', JSON.stringify(market8[0], null, 2));
        }
        // ─────────────────────────────────────────────────────────────────────

        const matchResult  = parseMatchResult(allOdds);
        const totalGoals   = parseTotalGoals(allOdds);
        const goalscorers  = parseGoalscorers(allOdds);

        // Surface which bookmaker was used (same across all markets when preferred is available)
        const bookmaker_id = matchResult?.bookmaker_id
            ?? totalGoals?.bookmaker_id
            ?? goalscorers?.[0]?.bookmaker_id
            ?? null;

        const result = {
            source:       'Sportmonks',
            bookmaker_id,
            fixture_id:   sportmonksId,
            match_result: matchResult,
            total_goals:  totalGoals,
            goalscorers,
        };

        return res.status(200).json(result);
    } catch (err) {
        console.error('[Sportmonks Odds] Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
}
