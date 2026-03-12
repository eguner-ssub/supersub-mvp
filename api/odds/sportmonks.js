import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ── Sportmonks odds endpoint ─────────────────────────────────────────────────
// GET /api/odds/sportmonks?fixture=<matches.id (API-Football ID)>
//
// Fetches pre-match odds from Sportmonks for markets:
//   1  — Match Result (1X2)
//   80 — Over/Under Goals
//   8  — First Goalscorer
//
// Internally translates the API-Football fixture ID to a Sportmonks fixture ID
// before calling the Sportmonks API. Never returns simulated data.

const BASE_URL = 'https://api.sportmonks.com/v3/football';

function getToken() {
    const token = process.env.SPORTMONKS_API_TOKEN;
    if (!token) throw new Error('Missing env var SPORTMONKS_API_TOKEN');
    return token;
}

// ── Supabase client (server-side) ────────────────────────────────────────────
let _supabase = null;
function getSupabase() {
    if (_supabase) return _supabase;
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Missing Supabase env vars');
    _supabase = createClient(url, key);
    return _supabase;
}

// ── ID translation: API-Football fixture ID → Sportmonks fixture ID ──────────
// The matches table stores API-Football IDs. Sportmonks uses completely different
// IDs (e.g. matches.id=1386996 → Sportmonks id=19432202 for Wrexham vs Swansea).
// We resolve by: checking sportmonks_id_map cache, then doing a Sportmonks
// /fixtures/between lookup matched by team name.
async function resolveToSportmonksId(apiFootballId) {
    const supabase = getSupabase();

    // 1. Check cache in sportmonks_id_map
    const { data: cached } = await supabase
        .from('sportmonks_id_map')
        .select('sportmonks_id')
        .eq('entity_type', 'fixture')
        .eq('api_football_id', apiFootballId)
        .maybeSingle();

    if (cached?.sportmonks_id) return cached.sportmonks_id;

    // 2. Look up match date and team names
    const { data: match } = await supabase
        .from('matches')
        .select('date, home_team, away_team')
        .eq('id', apiFootballId)
        .maybeSingle();

    if (!match) return null;

    // 3. Fetch all Sportmonks fixtures for that calendar date
    const token = getToken();
    const fixtureUrl = `${BASE_URL}/fixtures/between/${match.date}/${match.date}?api_token=${token}&per_page=100`;
    const fixtureRes = await fetch(fixtureUrl);
    if (!fixtureRes.ok) return null;
    const fixtureJson = await fixtureRes.json();

    // 4. Match by first significant word (>3 chars) from each team name
    const keyword = (name) =>
        name.toLowerCase().split(/\s+/).find(w => w.length > 3) ?? name.toLowerCase().slice(0, 4);
    const homeKw = keyword(match.home_team);
    const awayKw = keyword(match.away_team);

    const smFixture = fixtureJson.data?.find(f => {
        const n = f.name.toLowerCase();
        return n.includes(homeKw) && n.includes(awayKw);
    });

    if (!smFixture) return null;

    // 5. Cache result in sportmonks_id_map (ignore insert errors — best-effort)
    await supabase.from('sportmonks_id_map').insert({
        internal_id: crypto.randomUUID(),
        entity_type: 'fixture',
        sportmonks_id: smFixture.id,
        api_football_id: apiFootballId,
    }).select().maybeSingle().catch(() => null);

    return smFixture.id;
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

        // Translate API-Football ID → Sportmonks fixture ID
        const sportmonksId = await resolveToSportmonksId(Number(fixture));
        if (!sportmonksId) {
            return res.status(404).json({ error: 'No odds available for this fixture' });
        }

        const url = `${BASE_URL}/odds/pre-match/fixtures/${sportmonksId}?api_token=${token}&filters=markets:${ALL_MARKETS.join(',')}`;

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
            fixture_id: sportmonksId,
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
