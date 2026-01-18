export default async function handler(req, res) {
  const { league = 39, season: requestedSeason, id } = req.query;

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
  // Determine current year and build season fallback list
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11

  // Football seasons typically run Aug-May, so if we're in Jan-Jul, use previous year
  const defaultSeason = currentMonth < 7 ? currentYear : currentYear;
  const seasonsToTry = requestedSeason
    ? [parseInt(requestedSeason)]
    : [defaultSeason, defaultSeason + 1, defaultSeason - 1];

  console.log(`🔍 [Matches API] Seasons to try: ${seasonsToTry.join(', ')}`);

  try {
    // SCENARIO 1: Fetch Specific Match Detail (for MatchDetail page)
    if (id) {
      console.log(`🎯 [Matches API] Fetching specific match: ${id}`);

      try {
        const response = await fetch(`${baseUrl}/fixtures?id=${id}`, { headers });

        // Detect rate limit errors
        if (response.status === 429 || response.status === 403) {
          console.error(`🚫 [Matches API] Rate limit hit: ${response.status}`);
          return res.status(200).json({
            error: 'API_LIMIT_REACHED',
            response: [],
            message: 'API rate limit exceeded. Please try again later.',
            statusCode: response.status
          });
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ [Matches API] Match fetch failed: ${response.status} - ${errorText}`);
          return res.status(200).json({
            error: 'API_UNAVAILABLE',
            response: [],
            message: 'Match data temporarily unavailable',
            statusCode: response.status
          });
        }

        const data = await response.json();

        // Check for API-level errors
        if (data.errors && Object.keys(data.errors).length > 0) {
          console.error(`❌ [Matches API] API returned errors:`, data.errors);
          return res.status(200).json({
            error: 'API_ERROR',
            response: [],
            message: 'API returned an error',
            details: data.errors
          });
        }

        return res.status(200).json(data);
      } catch (error) {
        console.error(`❌ [Matches API] Exception fetching match ${id}:`, error.message);
        // Return safe empty state instead of crashing
        return res.status(200).json({
          error: 'API_UNAVAILABLE',
          response: [],
          message: 'Match not found',
          details: error.message
        });
      }
    }

    // SCENARIO 2: Fetch Matches for League (with resilient fallback strategy)
    let matchesData = null;
    let activeRound = null;
    let successfulSeason = null;

    // STRATEGY 1: Try to find current round for each season
    for (const season of seasonsToTry) {
      console.log(`🔄 [Matches API] Trying season ${season}...`);

      try {
        // Step 1: Try to get current round
        const roundRes = await fetch(
          `${baseUrl}/fixtures/rounds?league=${league}&season=${season}&current=true`,
          { headers }
        );

        // Check for rate limit on round fetch
        if (roundRes.status === 429 || roundRes.status === 403) {
          console.error(`🚫 [Matches API] Rate limit hit on round fetch: ${roundRes.status}`);
          return res.status(200).json({
            error: 'API_LIMIT_REACHED',
            response: [],
            message: 'API rate limit exceeded. Please try again later.',
            statusCode: roundRes.status
          });
        }

        if (roundRes.ok) {
          const roundData = await roundRes.json();

          if (roundData.response && roundData.response.length > 0) {
            const currentRound = roundData.response[0];
            console.log(`✅ [Matches API] Found active round for ${season}: ${currentRound}`);

            // Step 2: Fetch matches for this round
            const fixturesRes = await fetch(
              `${baseUrl}/fixtures?league=${league}&season=${season}&round=${currentRound}`,
              { headers }
            );

            // Check for rate limit on fixtures fetch
            if (fixturesRes.status === 429 || fixturesRes.status === 403) {
              console.error(`🚫 [Matches API] Rate limit hit on fixtures fetch: ${fixturesRes.status}`);
              return res.status(200).json({
                error: 'API_LIMIT_REACHED',
                response: [],
                message: 'API rate limit exceeded. Please try again later.',
                statusCode: fixturesRes.status
              });
            }

            if (fixturesRes.ok) {
              const fixturesData = await fixturesRes.json();

              if (fixturesData.response && fixturesData.response.length > 0) {
                matchesData = fixturesData;
                activeRound = currentRound;
                successfulSeason = season;
                console.log(`✅ [Matches API] Successfully fetched ${fixturesData.response.length} matches`);
                break; // Success! Exit the loop
              }
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️ [Matches API] Season ${season} current round failed:`, error.message);
        // Continue to next season
      }
    }

    // STRATEGY 2: If no current round found, try "next=10" for each season
    if (!matchesData) {
      console.log(`⚠️ [Matches API] No active round found. Trying next=10 fallback...`);

      for (const season of seasonsToTry) {
        try {
          const backupRes = await fetch(
            `${baseUrl}/fixtures?league=${league}&season=${season}&next=10`,
            { headers }
          );

          if (backupRes.ok) {
            const backupData = await backupRes.json();

            if (backupData.response && backupData.response.length > 0) {
              matchesData = backupData;
              successfulSeason = season;
              console.log(`✅ [Matches API] Fallback successful for ${season}: ${backupData.response.length} matches`);
              break;
            }
          }
        } catch (error) {
          console.warn(`⚠️ [Matches API] Season ${season} next=10 failed:`, error.message);
          // Continue to next season
        }
      }
    }

    // STRATEGY 3: If still no data, try without current constraint
    if (!matchesData) {
      console.log(`⚠️ [Matches API] Next=10 failed. Trying without current constraint...`);

      for (const season of seasonsToTry) {
        try {
          // Get any round (not just current)
          const roundRes = await fetch(
            `${baseUrl}/fixtures/rounds?league=${league}&season=${season}`,
            { headers }
          );

          if (roundRes.ok) {
            const roundData = await roundRes.json();

            if (roundData.response && roundData.response.length > 0) {
              // Take the last round (most recent)
              const lastRound = roundData.response[roundData.response.length - 1];
              console.log(`🔄 [Matches API] Trying last available round for ${season}: ${lastRound}`);

              const fixturesRes = await fetch(
                `${baseUrl}/fixtures?league=${league}&season=${season}&round=${lastRound}`,
                { headers }
              );

              if (fixturesRes.ok) {
                const fixturesData = await fixturesRes.json();

                if (fixturesData.response && fixturesData.response.length > 0) {
                  matchesData = fixturesData;
                  activeRound = lastRound;
                  successfulSeason = season;
                  console.log(`✅ [Matches API] Last round successful: ${fixturesData.response.length} matches`);
                  break;
                }
              }
            }
          }
        } catch (error) {
          console.warn(`⚠️ [Matches API] Season ${season} last round failed:`, error.message);
          // Continue to next season
        }
      }
    }

    // FINAL SAFETY NET: Return safe empty state if all strategies failed
    if (!matchesData || !matchesData.response || matchesData.response.length === 0) {
      console.warn(`⚠️ [Matches API] All strategies exhausted. Returning safe empty state.`);
      return res.status(200).json({
        error: 'NO_DATA',
        response: [],
        message: "No matches available at this time",
        seasons_tried: seasonsToTry,
        active_round: null
      });
    }

    // Check for API-level errors even on successful fetch
    if (matchesData.errors && Object.keys(matchesData.errors).length > 0) {
      console.error(`⚠️ [Matches API] API returned errors:`, matchesData.errors);
      // Log but don't fail - we have data
    }

    // SUCCESS: Return the data with metadata
    console.log(`✅ [Matches API] Returning ${matchesData.response.length} matches from season ${successfulSeason}`);
    return res.status(200).json({
      ...matchesData,
      active_round: activeRound,
      season_used: successfulSeason
    });

  } catch (error) {
    // CATASTROPHIC FAILURE: Log and return safe empty state
    console.error(`❌ [Matches API] Catastrophic error:`, error);

    // Never return 500 - always return 200 with empty data
    return res.status(200).json({
      error: 'API_UNAVAILABLE',
      response: [],
      message: "Service temporarily unavailable",
      details: error.message,
      fallback: true
    });
  }
}