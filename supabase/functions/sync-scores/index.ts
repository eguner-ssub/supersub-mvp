import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const API_KEY = Deno.env.get('SPORTS_API_KEY')
  
  // Fetch all matches for TODAY's date so we have a full schedule
  const today = new Date().toISOString().split('T')[0]
  console.log(`Fetching matches for date: ${today}`)

  const response = await fetch(`https://v3.football.api-sports.io/fixtures?date=${today}`, {
    headers: { 
      'x-apisports-key': API_KEY || '',
      'Content-Type': 'application/json'
    }
  })
  
  const result = await response.json()

  if (!result.response || result.response.length === 0) {
    console.log("API returned nothing. Check your API key or plan limits.")
    return new Response(JSON.stringify({ message: "No matches found for today" }), { status: 200 })
  }

  // Improved mapping: We must include team names to make the table useful
  const updates = result.response.map((item: any) => ({
    id: item.fixture.id,
    home_team: item.teams.home.name,
    away_team: item.teams.away.name,
    status: item.fixture.status.short, // NS, 1H, 2H, FT, etc.
    home_score: item.goals.home ?? 0,
    away_score: item.goals.away ?? 0,
    kickoff_time: item.fixture.date,
    last_updated: new Date().toISOString()
  }))

  const { error } = await supabase
    .from('matches')
    .upsert(updates, { onConflict: 'id' })

  if (error) {
    console.error("Database Error:", error.message)
    return new Response(JSON.stringify(error), { status: 500 })
  }

  return new Response(JSON.stringify({ message: `Success: Synced ${updates.length} matches` }), { status: 200 })
})