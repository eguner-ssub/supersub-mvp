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
        source: "Default",
        odds: {
            home: 2.0,
            draw: 3.0,
            away: 2.0
        }
    };

    const apiKey = process.env.VITE_API_FOOTBALL_KEY || process.env.FOOTBALL_API_KEY || "";

    console.log('🔑 [ODDS API] API Key present:', apiKey ? 'Yes' : 'No');

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

    // Priority bookmaker IDs (Bet365, 1xBet, Unibet)
    const PRIORITY_BOOKMAKER_IDS = [6, 10, 16];
    const BOOKMAKER_NAMES = {
        6: "Bet365",
        10: "1xBet",
        16: "Unibet"
    };

    try {
        console.log('📡 [ODDS API] Fetching from:', `${baseUrl}/odds?fixture=${fixture}`);

        // Fetch odds from API-Football (all bookmakers)
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

        console.log('📦 [ODDS API] Response array length:', data.response?.length || 0);

        // Check if we got valid odds data
        if (!data.response || data.response.length === 0) {
            console.warn("⚠️ [ODDS API] No odds data available, using defaults");
            console.warn("⚠️ [ODDS API] Empty Response. Errors:", JSON.stringify(data.errors));
            return res.status(200).json(defaultOdds);
        }

        // Extract the odds data
        const oddsData = data.response[0];
        console.log('🎯 [ODDS API] Odds data bookmakers:', oddsData.bookmakers?.length || 0);

        if (!oddsData.bookmakers || oddsData.bookmakers.length === 0) {
            console.warn("⚠️ [ODDS API] No bookmakers found, using defaults");
            return res.status(200).json(defaultOdds);
        }

        // Smart bookmaker selection: prioritize high-quality bookmakers
        let selectedBookmaker = null;
        let bookmakerSource = "Unknown";

        // Try to find a priority bookmaker
        for (const priorityId of PRIORITY_BOOKMAKER_IDS) {
            const found = oddsData.bookmakers.find(b => b.id === priorityId);
            if (found) {
                selectedBookmaker = found;
                bookmakerSource = BOOKMAKER_NAMES[priorityId] || found.name;
                console.log(`✅ [ODDS API] Found priority bookmaker: ${bookmakerSource} (ID: ${priorityId})`);
                break;
            }
        }

        // Fallback to first available bookmaker if no priority match
        if (!selectedBookmaker) {
            selectedBookmaker = oddsData.bookmakers[0];
            bookmakerSource = selectedBookmaker.name;
            console.log(`📚 [ODDS API] Using fallback bookmaker: ${bookmakerSource} (ID: ${selectedBookmaker.id})`);
        }

        // Find Match Winner market
        const matchWinnerMarket = selectedBookmaker.bets?.find(
            bet => bet.name === "Match Winner"
        );

        if (!matchWinnerMarket || !matchWinnerMarket.values) {
            console.warn("⚠️ [ODDS API] Match Winner odds not found, using defaults");
            console.log('🔍 [ODDS API] Available markets:', selectedBookmaker.bets?.map(b => b.name));
            return res.status(200).json(defaultOdds);
        }

        // Parse the odds values
        const homeOdds = matchWinnerMarket.values.find(v => v.value === "Home");
        const drawOdds = matchWinnerMarket.values.find(v => v.value === "Draw");
        const awayOdds = matchWinnerMarket.values.find(v => v.value === "Away");

        const parsedOdds = {
            fixtureId: parseInt(fixture),
            source: bookmakerSource,
            odds: {
                home: parseFloat(homeOdds?.odd || 2.0),
                draw: parseFloat(drawOdds?.odd || 3.0),
                away: parseFloat(awayOdds?.odd || 2.0)
            }
        };

        console.log('✅ [ODDS API] Returning real odds from:', bookmakerSource);
        console.log('📊 [ODDS API] Odds:', parsedOdds.odds);
        return res.status(200).json(parsedOdds);

    } catch (error) {
        console.error("❌ [ODDS API] Error:", error.message);
        console.error("❌ [ODDS API] Stack:", error.stack);
        // Always return defaults on error to prevent UI crashes
        return res.status(200).json(defaultOdds);
    }
}
