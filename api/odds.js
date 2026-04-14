import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import {
    ALL_MARKETS,
    parseMatchResult,
    parseTotalGoals,
    parseGoalscorers,
} from '../lib/oddsParser.js';

// ── Lazy Supabase Client ─────────────────────────────────────────────────────
let _supabase = null;

function getSupabaseClient() {
    if (_supabase) return _supabase;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error(
            `Missing env vars – SUPABASE_URL: ${url ? '✓' : '✗'}, SUPABASE_SERVICE_ROLE_KEY: ${key ? '✓' : '✗'}`
        );
    }
    _supabase = createClient(url, key);
    return _supabase;
}

// ── Sportmonks odds endpoint ─────────────────────────────────────────────────
// GET /api/odds/sportmonks?fixture=<matches.id (Sportmonks fixture ID)>
//
// Fetches pre-match odds from Sportmonks for markets:
//   1  — Match Result (1X2)
//   80 — Over/Under Goals
//   90 — Goalscorers (Anytime scorer, filtered by string fields)
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

        const matchResult  = parseMatchResult(allOdds);
        const totalGoals   = parseTotalGoals(allOdds);
        let   goalscorers  = parseGoalscorers(allOdds);

        // ── Enrich goalscorers with team data from player_squad_cache ────────
        // The odds payload only has player names — no team info.  Look up each
        // name in the squad cache to attach team_id and team_name so the frontend
        // can split scorers by team.  Unmatched players get null (kept, not dropped).
        if (goalscorers && goalscorers.length > 0) {
            try {
                const db = getSupabaseClient();
                const playerNames = goalscorers.map(g => g.player_name);

                const { data: squadRows } = await db
                    .from('player_squad_cache')
                    .select('player_name, team_id, team_name')
                    .in('player_name', playerNames);

                const teamLookup = new Map(
                    (squadRows || []).map(r => [r.player_name, { team_id: r.team_id, team_name: r.team_name }])
                );

                goalscorers = goalscorers.map(g => ({
                    ...g,
                    team_id:   teamLookup.get(g.player_name)?.team_id   ?? null,
                    team_name: teamLookup.get(g.player_name)?.team_name ?? null,
                }));
            } catch (enrichErr) {
                // Non-fatal: return scorers without team data rather than failing the request
                console.error('[Sportmonks Odds] Squad cache enrichment failed:', enrichErr.message);
                goalscorers = goalscorers.map(g => ({ ...g, team_id: null, team_name: null }));
            }
        }

        // Surface which bookmaker was used (same across all markets when preferred is available)
        const bookmaker_id = matchResult?.bookmaker_id
            ?? totalGoals?.bookmaker_id
            ?? null;

        const result = {
            source:       'Sportmonks',
            bookmaker_id,
            fixture_id:   sportmonksId,
            match_result: matchResult,
            total_goals:  totalGoals,
            goalscorers,
        };

        res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=15');
        return res.status(200).json(result);
    } catch (err) {
        console.error('[Sportmonks Odds] Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
}
