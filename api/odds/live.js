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

    const apiKey = process.env.VITE_API_FOOTBALL_KEY || process.env.FOOTBALL_API_KEY || "";

    console.log('🔑 [LIVE ODDS API] API Key check:', apiKey ? '✅ Present' : '❌ Missing');

    // If no API key, return simulation immediately
    if (!apiKey) {
        console.error("⚠️ [LIVE ODDS API] CRITICAL: No API Key found - Using simulation");
        return res.status(200).json(createSimulationResponse());
    }

    const baseUrl = "https://v3.football.api-sports.io";
    const headers = {
        "x-apisports-key": apiKey,
        "Content-Type": "application/json"
    };

    try {
        const endpoint = `${baseUrl}/odds/live?fixture=${fixture}`;
        console.log('📡 [LIVE ODDS API] Fetching from upstream:', endpoint);

        // Fetch LIVE odds from API-Football
        const response = await fetch(endpoint, { headers });

        console.log('📊 [LIVE ODDS API] Upstream status:', response.status);

        if (!response.ok) {
            console.warn(`⚠️ [LIVE ODDS API] Upstream returned ${response.status} - Using simulation`);
            return res.status(200).json(createSimulationResponse());
        }

        const data = await response.json();

        console.log('📦 [LIVE ODDS API] Upstream results count:', data.results || 0);
        console.log('📦 [LIVE ODDS API] Response array length:', data.response?.length || 0);

        // Check if we got valid odds data
        if (!data.response || data.response.length === 0) {
            console.warn("⚠️ [LIVE ODDS API] No live odds available (common for minor leagues)");
            if (data.errors) {
                console.warn("⚠️ [LIVE ODDS API] API Errors:", JSON.stringify(data.errors));
            }
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
            console.log('📊 [LIVE ODDS API] Available markets:', oddsData.odds.length);

            // Target "Match Winner" (ID 1)
            matchWinnerMarket = oddsData.odds.find(
                market => market.name === "Match Winner" || market.id === 1
            );
        }
        // Fallback to nested structure (rare for live odds)
        else if (oddsData.bookmakers && oddsData.bookmakers.length > 0) {
            console.log('📊 [LIVE ODDS API] Using NESTED structure (bookmakers)');
            const bookmaker = oddsData.bookmakers[0];
            console.log('📚 [LIVE ODDS API] Bookmaker:', bookmaker.name);

            matchWinnerMarket = bookmaker.bets?.find(
                bet => bet.name === "Match Winner" || bet.id === 1
            );
        }

        if (!matchWinnerMarket || !matchWinnerMarket.values) {
            console.warn("⚠️ [LIVE ODDS API] Match Winner market not found - Using simulation");
            console.log('🔍 [LIVE ODDS API] Available markets:',
                oddsData.odds?.map(m => `${m.name} (ID: ${m.id})`) ||
                oddsData.bookmakers?.[0]?.bets?.map(b => b.name) ||
                'None'
            );
            return res.status(200).json(createSimulationResponse());
        }

        console.log('✅ [LIVE ODDS API] Found Match Winner market');
        console.log('📊 [LIVE ODDS API] Market values:', matchWinnerMarket.values.length);

        // Extract Home, Draw, Away odds
        const homeOdds = matchWinnerMarket.values.find(v => v.value === "Home");
        const drawOdds = matchWinnerMarket.values.find(v => v.value === "Draw");
        const awayOdds = matchWinnerMarket.values.find(v => v.value === "Away");

        console.log('📊 [LIVE ODDS API] Parsed Data:', {
            home: homeOdds?.odd || 'N/A',
            draw: drawOdds?.odd || 'N/A',
            away: awayOdds?.odd || 'N/A'
        });

        // Return simplified format as per spec
        const parsedResponse = {
            fixtureId: parseInt(fixture),
            isLive: true,
            source: "API-FOOTBALL",
            odds: {
                home: parseFloat(homeOdds?.odd || 2.5),
                draw: parseFloat(drawOdds?.odd || 3.2),
                away: parseFloat(awayOdds?.odd || 2.8)
            }
        };

        console.log('✅ [LIVE ODDS API] Returning live odds:', parsedResponse);
        return res.status(200).json(parsedResponse);

    } catch (error) {
        console.error("❌ [LIVE ODDS API] Exception caught:", error.message);
        console.error("❌ [LIVE ODDS API] Stack trace:", error.stack);
        // Always return simulation on error to prevent UI crashes
        return res.status(200).json(createSimulationResponse());
    }
}
