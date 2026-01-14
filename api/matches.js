export default async function handler(req, res) {
  const { league = 39, season = 2025, id } = req.query;

  // 1. ROBUST KEY RETRIEVAL
  // We check both names to prevent the "Localhost vs Vercel" confusion.
  // If both fail, we fallback to an empty string which will trigger a clean error below.
  const apiKey = process.env.VITE_API_FOOTBALL_KEY || process.env.FOOTBALL_API_KEY || "";

  // --- DEBUGGING (Temporary) ---
  // Uncomment the line below and paste your key strictly for testing if it still fails.
  // const apiKey = "PASTE_YOUR_REAL_KEY_HERE"; 

  if (!apiKey) {
    console.error("CRITICAL: No API Key found in environment variables.");
    return res.status(500).json({ error: "Server Configuration Error: Missing API Key" });
  }

  const baseUrl = "https://v3.football.api-sports.io";
  
  // 2. CORRECT HEADERS
  // Use 'x-apisports-key' for the direct URL. 
  // 'x-rapidapi-key' is only for the RapidAPI proxy URL.
  const headers = {
    "x-apisports-key": apiKey,
    "Content-Type": "application/json"
  };

  try {
    // SCENARIO 1: Fetch Specific Match Detail (for MatchDetail page)
    if (id) {
      const response = await fetch(`${baseUrl}/fixtures?id=${id}`, { headers });
      
      // Check for API errors (like 401 Unauthorized or 403 Forbidden)
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return res.status(200).json(data);
    }

    // SCENARIO 2: Fetch Active Round (The "Proper" Way)
    // First, we ask: "What is the current round?"
    const roundRes = await fetch(
      `${baseUrl}/fixtures/rounds?league=${league}&season=${season}&current=true`, 
      { headers }
    );
    
    if (!roundRes.ok) {
       // Only log this if it fails, otherwise it's just noise
       console.error("Round Fetch Failed:", roundRes.status);
    }

    const roundData = await roundRes.json();
    
    // Safety check: If API returns nothing, fallback to 'next=10'
    // This handles off-season or breaks where there is no "current" round.
    if (!roundData.response || roundData.response.length === 0) {
      console.log("No active round found, falling back to next 10 matches.");
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

    // Check if the provider returned an internal error (like rate limit reached)
    if (fixturesData.errors && Object.keys(fixturesData.errors).length > 0) {
      console.error("Provider Errors:", fixturesData.errors);
      // Pass the error message to the frontend so you can see it in the console
      return res.status(403).json({ error: "API Provider Error", details: fixturesData.errors });
    }

    // Send the smart data back to the frontend
    return res.status(200).json({
      ...fixturesData,
      active_round: currentRound // We pass this so the UI can display it
    });

  } catch (error) {
    console.error("API Route Exception:", error);
    return res.status(500).json({ error: "Failed to fetch match data", details: error.message });
  }
}