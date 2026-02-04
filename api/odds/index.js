export default async function handler(req, res) {
    const { fixture } = req.query;

    console.log('🔍 [ODDS API] Fixture ID received:', fixture);

    if (!fixture) {
        console.log('❌ [ODDS API] Missing fixture ID');
        return res.status(400).json({ error: "Missing fixture ID" });
    }

    const apiKey = process.env.VITE_API_FOOTBALL_KEY || process.env.FOOTBALL_API_KEY || "";

    console.log('🔑 [ODDS API] API Key present:', apiKey ? 'Yes' : 'No');

    // If no API key, return empty response (let frontend handle fallback)
    if (!apiKey) {
        console.warn("⚠️ [ODDS API] No API Key - Returning empty response");
        return res.status(200).json({ response: [] });
    }

    const baseUrl = "https://v3.football.api-sports.io";
    const headers = {
        "x-apisports-key": apiKey,
        "Content-Type": "application/json"
    };

    try {
        console.log('📡 [ODDS API] Fetching from:', `${baseUrl}/odds?fixture=${fixture}`);

        // Fetch odds from API-Football (all bookmakers, all markets)
        const response = await fetch(
            `${baseUrl}/odds?fixture=${fixture}`,
            { headers }
        );

        console.log('📊 [ODDS API] Response status:', response.status);

        if (!response.ok) {
            console.warn(`⚠️ [ODDS API] API returned ${response.status}, returning empty`);
            return res.status(200).json({ response: [] });
        }

        const data = await response.json();

        console.log('📦 [ODDS API] Response bookmakers:', data.response?.[0]?.bookmakers?.length || 0);

        // Return RAW response - let frontend parse all markets
        // This allows frontend to access Goals Over/Under, Anytime Goalscorer, etc.
        console.log('✅ [ODDS API] Returning RAW data for frontend parsing');
        return res.status(200).json(data);

    } catch (error) {
        console.error("❌ [ODDS API] Error:", error.message);
        // Return empty response to let frontend handle fallback
        return res.status(200).json({ response: [] });
    }
}
