import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ── Lazy Supabase Client ──────────────────────────────────────────────────────
let _client = null;

function getSupabaseClient() {
    if (_client) return _client;

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error(
            `Missing env vars – SUPABASE_URL: ${url ? '✓' : '✗'}, SUPABASE_SERVICE_ROLE_KEY: ${key ? '✓' : '✗'}`
        );
    }

    _client = createClient(url, key);
    return _client;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
    const { fixture } = req.query;

    console.log('🔴 [LIVE ODDS API] Incoming request - Fixture ID:', fixture);

    if (!fixture) {
        console.log('❌ [LIVE ODDS API] Missing fixture ID');
        return res.status(400).json({ error: "Missing fixture ID" });
    }

    // Simplified simulation response matching the spec
    const createSimulationResponse = () => ({
        fixtureId: parseInt(fixture),
        isLive: true,
        source: "SIMULATION",
        odds: {
            home: 2.5,
            draw: 3.2,
            away: 2.8
        }
    });

    try {
        const supabase = getSupabaseClient();

        const { data: dbRow, error } = await supabase
            .from('matches')
            .select('odds')
            .eq('id', Number(fixture))
            .single();

        // If Supabase error or no odds cached, fall back to simulation
        if (error || !dbRow?.odds || (Array.isArray(dbRow.odds) && dbRow.odds.length === 0)) {
            console.warn('⚠️ [LIVE ODDS API] No cached odds available - Using simulation');
            return res.status(200).json(createSimulationResponse());
        }

        // Feed the cached odds through the existing parsing logic
        const data = { response: dbRow.odds };

        // Check if we got valid odds data
        if (!data.response || data.response.length === 0) {
            console.warn("⚠️ [LIVE ODDS API] No live odds available (common for minor leagues)");
            return res.status(200).json(createSimulationResponse());
        }

        // === DATA PARSING (CRITICAL) ===
        // Live odds structure: response[0].odds[] (flat array, not nested under bookmakers)
        const oddsData = data.response[0];

        console.log('🔍 [LIVE ODDS API] Checking odds structure...');

        let matchWinnerMarket = null;

        // Try flat structure first (response[0].odds[])
        if (oddsData.odds && Array.isArray(oddsData.odds)) {
            console.log('📊 [LIVE ODDS API] Using FLAT structure - odds array found');

            // Target "Match Winner" (ID 1)
            matchWinnerMarket = oddsData.odds.find(
                market => market.name === "Match Winner" || market.id === 1
            );
        }
        // Fallback to nested structure (rare for live odds)
        else if (oddsData.bookmakers && oddsData.bookmakers.length > 0) {
            console.log('📊 [LIVE ODDS API] Using NESTED structure (bookmakers)');
            const bookmaker = oddsData.bookmakers[0];

            matchWinnerMarket = bookmaker.bets?.find(
                bet => bet.name === "Match Winner" || bet.id === 1
            );
        }

        if (!matchWinnerMarket || !matchWinnerMarket.values) {
            console.warn("⚠️ [LIVE ODDS API] Match Winner market not found - Using simulation");
            return res.status(200).json(createSimulationResponse());
        }

        console.log('✅ [LIVE ODDS API] Found Match Winner market');

        // Extract Home, Draw, Away odds
        const homeOdds = matchWinnerMarket.values.find(v => v.value === "Home");
        const drawOdds = matchWinnerMarket.values.find(v => v.value === "Draw");
        const awayOdds = matchWinnerMarket.values.find(v => v.value === "Away");

        // Return simplified format as per spec
        const parsedResponse = {
            fixtureId: parseInt(fixture),
            isLive: true,
            source: "CACHED-DB",
            odds: {
                home: parseFloat(homeOdds?.odd || 2.5),
                draw: parseFloat(drawOdds?.odd || 3.2),
                away: parseFloat(awayOdds?.odd || 2.8)
            }
        };

        console.log('✅ [LIVE ODDS API] Returning cached live odds:', parsedResponse);
        return res.status(200).json(parsedResponse);

    } catch (err) {
        console.error("❌ [LIVE ODDS API] Error:", err.message);
        // Always return simulation on error to prevent UI crashes
        return res.status(200).json(createSimulationResponse());
    }
}
