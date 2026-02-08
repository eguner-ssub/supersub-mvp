import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // 1. Setup the Supabase Client
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const API_KEY = Deno.env.get('SPORTS_API_KEY')?.trim()
  const today = new Date().toISOString().split('T')[0]
  
  console.log(`Syncing matches for date: ${today}`)

  // 2. Fetch data from API-Football
  const response = await fetch(`https://v3.football.api-sports.io/fixtures?date=${today}`, {
    headers: { 
      'x-apisports-key': API_KEY || '',
      'Content-Type': 'application/json'
    }
  })
  
  const result = await response.json()

  // 3. Handle API Provider Errors
  if (result.errors && Object.keys(result.errors).length > 0) {
    console.error("API Error detected:", result.errors)
    return new Response(JSON.stringify({ error: result.errors }), { status: 500 })
  }

  if (!result.response || result.response.length === 0) {
    return new Response(JSON.stringify({ message: "No matches found for today" }), { status: 200 })
  }

  // 4. Map the API response to your specific database schema
  const updates = result.response.map((item: any) => ({
    id: item.fixture.id,
    home_team: item.teams.home.name,
    away_team: item.teams.away.name,
    status: item.fixture.status.short, // NS, 1H, 2H, FT, etc.
    home_score: item.goals.home ?? 0,
    away_score: item.goals.away ?? 0,
    kickoff_time: item.fixture.date,
  }))

  // 5. The "Writing" Step: Upsert the data into your 'matches' table
  const { error } = await supabase
    .from('matches')
    .upsert(updates, { onConflict: 'id' })

  if (error) {
    console.error("Database Upsert Error:", error.message)
    return new Response(JSON.stringify({ db_error: error.message }), { status: 500 })
  }

  // 6. Return Success
  return new Response(JSON.stringify({ 
    message: `Successfully synced ${updates.length} matches`,
    swansea_check: updates.find(m => m.id === 1386911) ? "Swansea match processed" : "Swansea match not in this batch"
  }), { status: 200 })
})