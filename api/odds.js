export default async function handler(req, res) {
    const { fixture } = req.query;

    if (!fixture) {
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

    // If no API key, return defaults immediately
    if (!apiKey) {
        console.warn("⚠️ No API Key - Using default odds");
        return res.status(200).json(defaultOdds);
    }

    const baseUrl = "https://v3.football.api-sports.io";
    const headers = {
        "x-apisports-key": apiKey,
        "Content-Type": "application/json"
    };

    try {
        // Fetch odds from API-Football
        // Bookmaker 6 = Bwin (reliable for 1x2 odds)
        const response = await fetch(
            `${baseUrl}/odds?fixture=${fixture}&bookmaker=6`,
            { headers }
        );

        if (!response.ok) {
            console.warn(`Odds API returned ${response.status}, using defaults`);
            return res.status(200).json(defaultOdds);
        }

        const data = await response.json();

        // Check if we got valid odds data
        if (!data.response || data.response.length === 0) {
            console.warn("No odds data available, using defaults");
            return res.status(200).json(defaultOdds);
        }

        // Extract the "Match Winner" market (1x2)
        const oddsData = data.response[0];
        const matchWinnerMarket = oddsData.bookmakers?.[0]?.bets?.find(
            bet => bet.name === "Match Winner"
        );

        if (!matchWinnerMarket || !matchWinnerMarket.values) {
            console.warn("Match Winner odds not found, using defaults");
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

        return res.status(200).json(parsedOdds);

    } catch (error) {
        console.error("Odds API Error:", error.message);
        // Always return defaults on error to prevent UI crashes
        return res.status(200).json(defaultOdds);
    }
}
