export default async function handler(req, res) {
    // 1. Get the secret key from Vercel Environment Variables
    const API_KEY = process.env.FOOTBALL_API_KEY;
  
    if (!API_KEY) {
      return res.status(500).json({ error: "API Key missing on server" });
    }
  
    // 2. Get params from the frontend request (e.g. ?league=39)
    const { league, season, round } = req.query;
  
    // 3. Fetch from the real API (Server-to-Server)
    try {
      const url = `https://v3.football.api-sports.io/fixtures?league=${league}&season=${season}&round=${round || 'Regular Season - 22'}`;
      
      const response = await fetch(url, {
        headers: {
          "x-apisports-key": API_KEY // The key is used here, safe from the user
        }
      });
      
      const data = await response.json();
      
      // 4. Send clean data back to your app
      res.status(200).json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch matches" });
    }
  }