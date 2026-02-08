import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Matches from these specific league IDs will be processed
// Updated to include Serie A (135) and Liga Portugal (94)
const SUPPORTED_LEAGUE_IDS = [39, 40, 71, 78, 135, 94];

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const API_KEY = Deno.env.get('SPORTS_API_KEY')?.trim()
  
  // Define the sync window: Yesterday and Today
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const datesToSync = [
    yesterday.toISOString().split('T')[0],
    today.toISOString().split('T')[0]
  ];

  let totalSynced = 0;

  for (const date of datesToSync) {
    try {
      console.log(`Fetching fixtures for: ${date}`);
      
      const response = await fetch(`https://v3.football.api-sports.io/fixtures?date=${date}`, {
        headers: { 
          'x-apisports-key': API_KEY || '',
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();

      if (!result.response || result.response.length === 0) {
        console.log(`No matches found for ${date}`);
        continue;
      }

      // Filter matches by the supported league IDs defined above
      const filteredMatches = result.response.filter((item: any) => 
        SUPPORTED_LEAGUE_IDS.includes(item.league.id)
      );

      if (filteredMatches.length === 0) {
        console.log(`No supported league matches found for ${date}`);
        continue;
      }

      const updates = filteredMatches.map((item: any) => ({
        id: item.fixture.id,
        league_id: item.league.id,
        home_team: item.teams.home.name,
        away_team: item.teams.away.name,
        status: item.fixture.status.short,
        home_score: item.goals.home ?? 0,
        away_score: item.goals.away ?? 0,
        kickoff_time: item.fixture.date,
        last_updated: new Date().toISOString()
      }));

      // Upsert the data to update existing records or insert new ones
      const { error } = await supabase
        .from('matches')
        .upsert(updates, { onConflict: 'id' });

      if (error) {
        console.error(`Database error for ${date}:`, error.message);
      } else {
        totalSynced += updates.length;
      }

    } catch (err) {
      console.error(`Failed to process ${date}:`, err);
    }
  }

  return new Response(JSON.stringify({ 
    success: true,
    message: `Sync complete. Processed ${totalSynced} matches across ${datesToSync.length} days.` 
  }), { 
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
})