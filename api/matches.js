export default async function handler(req, res) {
  // --- DEBUG LOGS: CHECK YOUR TERMINAL ---
  console.log("➡️ API Function Invoked");
  console.log("🔑 API Key defined?", !!process.env.FOOTBALL_API_KEY);
  // ---------------------------------------

  // 1. Get the Key securely from the server environment
  const API_KEY = process.env.FOOTBALL_API_KEY;

  if (!API_KEY) {
    console.error("❌ CRITICAL: API Key is missing. Check .env.local file.");
    return res.status(500).json({ error: 'Server misconfiguration: No API Key found' });
  }

  // 2. Extract query parameters from the frontend request
  const { league, season, round } = req.query;

  // Basic validation to save API calls
  if (!league || !season) {
    console.error("❌ Missing parameters. Received:", req.query);
    return res.status(400).json({ error: 'Missing required parameters: league, season' });
  }

  try {
    // 3. Call the external provider (API-Football)
    const url = `https://v3.football.api-sports.io/fixtures?league=${league}&season=${season}${round ? `&round=${round}` : ''}`;
    
    console.log(`🌍 Fetching from: ${url}`); // Debug the URL being called

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-apisports-key': API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`❌ External API Error: ${response.status} ${response.statusText}`);
      throw new Error(`API Error: ${response.statusText}`);
    }

    const data = await response.json();

    // 4. Return the clean data to your frontend
    console.log(`✅ Success! Fetched ${data.response?.length || 0} matches.`);
    return res.status(200).json(data);

  } catch (error) {
    console.error('❌ Proxy Error:', error);
    return res.status(500).json({ error: 'Failed to fetch match data' });
  }
}