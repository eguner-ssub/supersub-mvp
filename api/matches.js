export default async function handler(req, res) {
  const { league, season: requestedSeason, id } = req.query;
  let { date } = req.query;

  // 1. ROBUST KEY RETRIEVAL
  const apiKey = process.env.VITE_API_FOOTBALL_KEY || process.env.FOOTBALL_API_KEY || "";

  if (!apiKey) {
    console.error("❌ CRITICAL: No API Key found in environment variables.");
    return res.status(500).json({ error: "Server Configuration Error: Missing API Key" });
  }

  const baseUrl = "https://v3.football.api-sports.io";
  const headers = {
    "x-apisports-key": apiKey,
    "Content-Type": "application/json"
  };

  // 2. DYNAMIC SEASON HANDLING
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11

  // European seasons run Aug-May: if we're in Jan-Jun (0-5), the season is previous year
  const europeanDefaultSeason = currentMonth < 6 ? currentYear - 1 : currentYear;

  // 3. GLOBAL FEED DEFAULT: If no specific ID or league requested, default to date-based query
  if (!date && !id && !league) {
    date = new Date().toISOString().split('T')[0];
    console.log(`🌍 [Matches API] Global feed enabled - defaulting to today: ${date}`);
  }

  try {
    // SCENARIO 1: Date-Specific Query (Bypass round logic)
    if (date) {
      const europeanSeason = requestedSeason ? parseInt(requestedSeason) : europeanDefaultSeason;
      const brazilianSeasons = [currentYear, currentYear - 1]; // [2026, 2025]

      // Multi-League Support - UPDATED: Added Italy (135) and Portugal (94)
      const LEAGUE_CONFIG = [
        { id: 39, name: 'EPL', seasons: [europeanSeason] },
        { id: 40, name: 'Championship', seasons: [europeanSeason] },
        { id: 135, name: 'Serie A', seasons: [europeanSeason] },
        { id: 94, name: 'Liga Portugal', seasons: [europeanSeason] },
        { id: 71, name: 'Série A (Brazil)', seasons: brazilianSeasons },
        { id: 78, name: 'Bundesliga', seasons: [europeanSeason] },
      ];

      try {
        // Parallel fetch for all leagues to avoid cascading delays
        const fetchPromises = LEAGUE_CONFIG.map(async (league) => {
          let allData = [];

          for (const season of league.seasons) {
            try {
              const response = await fetch(
                `${baseUrl}/fixtures?league=${league.id}&season=${season}&date=${date}`,
                { headers }
              );

              if (response.status === 429 || response.status === 403) {
                return { leagueId: league.id, error: 'RATE_LIMIT', data: [] };
              }

              if (!response.ok) continue;

              const data = await response.json();
              const matches = data.response || [];

              if (matches.length > 0) {
                allData = [...allData, ...matches];
                // Break once data is found for the primary season to save calls
                break;
              }
            } catch (error) {
              continue;
            }
          }

          return { leagueId: league.id, error: null, data: allData };
        });

        const results = await Promise.all(fetchPromises);
        const allMatches = results.flatMap(r => r.data);

        // Sort by fixture date for a clean chronological feed
        const sortedMatches = allMatches.sort((a, b) =>
          new Date(a.fixture.date) - new Date(b.fixture.date)
        );

        return res.status(200).json({
          response: sortedMatches,
          date_queried: date,
          season_used: europeanSeason,
          leagues_queried: LEAGUE_CONFIG.map(l => l.id)
        });
      } catch (error) {
        return res.status(200).json({ error: 'API_UNAVAILABLE', response: [] });
      }
    }

    // SCENARIO 2: Match Detail
    if (id) {
      const response = await fetch(`${baseUrl}/fixtures?id=${id}`, { headers });
      const data = await response.json();
      return res.status(200).json(data);
    }

    return res.status(200).json({ response: [] });

  } catch (error) {
    console.error("❌ [Matches API] Error:", error.message);
    return res.status(200).json({ error: 'API_UNAVAILABLE', response: [] });
  }
}