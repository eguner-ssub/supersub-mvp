export default async function handler(req, res) {
    const { fixture } = req.query;

    if (!fixture) {
        return res.status(400).json({ error: "Missing 'fixture' query parameter" });
    }

    const apiKey = process.env.VITE_API_FOOTBALL_KEY || process.env.FOOTBALL_API_KEY || "";

    if (!apiKey) {
        console.error("❌ [Events API] No API Key found.");
        return res.status(500).json({ error: "Server Configuration Error: Missing API Key" });
    }

    const baseUrl = "https://v3.football.api-sports.io";

    try {
        const response = await fetch(`${baseUrl}/fixtures/events?fixture=${fixture}`, {
            headers: {
                "x-apisports-key": apiKey,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            console.error(`❌ [Events API] Upstream error: ${response.status}`);
            return res.status(200).json({ response: [], error: "UPSTREAM_ERROR" });
        }

        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        console.error("❌ [Events API] Error:", error.message);
        return res.status(200).json({ response: [], error: "API_UNAVAILABLE" });
    }
}
