export default async function handler(req, res) {
  // 1. Get the Key securely from the server environment
  const API_KEY = process.env.FOOTBALL_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'Server misconfiguration: No API Key found' });
  }

  // 2. Extract query parameters from the frontend request
  const { league, season, round } = req.query;

  // Basic validation to save API calls
  if (!league || !season) {
    return res.status(400).json({ error: 'Missing required parameters: league, season' });
  }

  try {
    // 3. Call the external provider (API-Football)
    // Note: We use the 'v3.football.api-sports.io' endpoint
    const url = `https://v3.football.api-sports.io/fixtures?league=${league}&season=${season}${round ? `&round=${round}` : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-apisports-key': API_KEY, // Key is used here, server-side only
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    const data = await response.json();

    // 4. Return the clean data to your frontend
    return res.status(200).json(data);

  } catch (error) {
    console.error('Proxy Error:', error);
    return res.status(500).json({ error: 'Failed to fetch match data' });
  }
}