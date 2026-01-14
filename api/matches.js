// api/matches.js (or wherever your Vercel function lives)

export default async function handler(req, res) {
  const { league = 39, season = 2025, id } = req.query;
  const apiKey = process.env.VITE_API_FOOTBALL_KEY; // Ensure this env var is set in Vercel

  const baseUrl = "https://v3.football.api-sports.io";
  const headers = {
    "x-rapidapi-host": "v3.football.api-sports.io",
    "x-rapidapi-key": apiKey
  };

  try {
    // SCENARIO 1: Fetch Specific Match Detail (for MatchDetail page)
    if (id) {
      const response = await fetch(`${baseUrl}/fixtures?id=${id}`, { headers });
      const data = await response.json();
      return res.status(200).json(data);
    }

    // SCENARIO 2: Fetch Active Round (The "Proper" Way)
    // First, we ask: "What is the current round?"
    const roundRes = await fetch(
      `${baseUrl}/fixtures/rounds?league=${league}&season=${season}&current=true`, 
      { headers }
    );
    const roundData = await roundRes.json();
    
    // Safety check: If API returns nothing, fallback to next 10
    if (!roundData.response || roundData.response.length === 0) {
      const backupRes = await fetch(
        `${baseUrl}/fixtures?league=${league}&season=${season}&next=10`, 
        { headers }
      );
      return res.status(200).json(await backupRes.json());
    }

    const currentRound = roundData.response[0]; // e.g., "Regular Season - 22"

    // SCENARIO 3: Fetch Matches for that Round
    // Now we ask: "Give me matches for Regular Season - 22"
    const fixturesRes = await fetch(
      `${baseUrl}/fixtures?league=${league}&season=${season}&round=${currentRound}`, 
      { headers }
    );
    const fixturesData = await fixturesRes.json();

    // Send the smart data back to the frontend
    return res.status(200).json({
      ...fixturesData,
      active_round: currentRound // We pass this so the UI can display it
    });

  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: "Failed to fetch match data" });
  }
}