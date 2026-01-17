export default async function handler(req, res) {
    const { fixture } = req.query;

    console.log('🔍 [ODDS API] Fixture ID received:', fixture);

    if (!fixture) {
        console.log('❌ [ODDS API] Missing fixture ID');
        return res.status(400).json({ error: "Missing fixture ID" });
    }

    // Default fallback odds
    const defaultOdds = {
        fixtureId: parseInt(fixture),
        odds: {
            home: 2.0,
            draw: 3.0,
            away: 2.0
        }
    };

    const apiKey = process.env.VITE_API_FOOTBALL_KEY || process.env.FOOTBALL_API_KEY || "";

    console.log('🔑 [ODDS API] API Key present:', apiKey ? 'Yes' : 'No');
    console.log('🔑 [ODDS API] Checking VITE_API_FOOTBALL_KEY:', process.env.VITE_API_FOOTBALL_KEY ? 'Found' : 'Not found');
    console.log('🔑 [ODDS API] Checking FOOTBALL_API_KEY:', process.env.FOOTBALL_API_KEY ? 'Found' : 'Not found');

    // If no API key, return defaults immediately
    if (!apiKey) {
        console.warn("⚠️ [ODDS API] No API Key - Using default odds");
        return res.status(200).json(defaultOdds);
    }

    const baseUrl = "https://v3.football.api-sports.io";
    const headers = {
        "x-apisports-key": apiKey,
        "Content-Type": "application/json"
    };

    try {
        console.log('📡 [ODDS API] Fetching from:', `${baseUrl}/odds?fixture=${fixture}`);

        // Fetch odds from API-Football (any bookmaker)
        const response = await fetch(
            `${baseUrl}/odds?fixture=${fixture}`,
            { headers }
        );

        console.log('📊 [ODDS API] Response status:', response.status);

        if (!response.ok) {
            console.warn(`⚠️ [ODDS API] API returned ${response.status}, using defaults`);
            return res.status(200).json(defaultOdds);
        }

        const data = await response.json();

        console.log('📦 [ODDS API] Raw response:', JSON.stringify(data, null, 2));
        console.log('📦 [ODDS API] Response array length:', data.response?.length || 0);

        // Check if we got valid odds data
        if (!data.response || data.response.length === 0) {
            console.warn("⚠️ [ODDS API] No odds data available, using defaults");
            console.warn("⚠️ [ODDS API] Empty Response. Errors:", JSON.stringify(data.errors));
            return res.status(200).json(defaultOdds);
        }

        // Extract the "Match Winner" market (1x2) from first available bookmaker
        const oddsData = data.response[0];
        console.log('🎯 [ODDS API] Odds data bookmakers:', oddsData.bookmakers?.length || 0);

        // Take the first available bookmaker
        const bookmaker = oddsData.bookmakers?.[0];

        if (!bookmaker) {
            console.warn("⚠️ [ODDS API] No bookmakers found, using defaults");
            return res.status(200).json(defaultOdds);
        }

        console.log('📚 [ODDS API] Using bookmaker:', bookmaker.name);

        const matchWinnerMarket = bookmaker.bets?.find(
            bet => bet.name === "Match Winner"
        );

        if (!matchWinnerMarket || !matchWinnerMarket.values) {
            console.warn("⚠️ [ODDS API] Match Winner odds not found, using defaults");
            console.log('🔍 [ODDS API] Available markets for selected bookmaker:', bookmaker.bets?.map(b => b.name));
            return res.status(200).json(defaultOdds);
        }

        // Parse the odds values
        const homeOdds = matchWinnerMarket.values.find(v => v.value === "Home");
        const drawOdds = matchWinnerMarket.values.find(v => v.value === "Draw");
        const awayOdds = matchWinnerMarket.values.find(v => v.value === "Away");

        const parsedOdds = {
            fixtureId: parseInt(fixture),
            odds: {
                home: parseFloat(homeOdds?.odd || 2.0),
                draw: parseFloat(drawOdds?.odd || 3.0),
                away: parseFloat(awayOdds?.odd || 2.0)
            }
        };

        console.log('✅ [ODDS API] Returning real odds:', parsedOdds);
        return res.status(200).json(parsedOdds);

    } catch (error) {
        console.error("❌ [ODDS API] Error:", error.message);
        console.error("❌ [ODDS API] Stack:", error.stack);
        // Always return defaults on error to prevent UI crashes
        return res.status(200).json(defaultOdds);
    }
}
