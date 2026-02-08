import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // Setup the Supabase Client (REQUIRED TO WRITE TO DB)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const API_KEY = Deno.env.get('SPORTS_API_KEY')?.trim()
  const today = new Date().toISOString().split('T')[0]
  
  console.log(`Syncing matches for date: ${today}`)

  const response = await fetch(`https://v3.football.api-sports.io/fixtures?date=${today}`, {
    headers: { 
      'x-apisports-key': API_KEY || '',
      'Content-Type': 'application/json'
    }
  })
  
  const result = await response.json()

  if (result.errors && Object.keys(result.errors).length > 0) {
    return new Response(JSON.stringify({ error: result.errors }), { status: 500 })
  }

  if (!result.response || result.response.length === 0) {
    return new Response(JSON.stringify({ message: "No matches found for today" }), { status: 200 })
  }

  // Mapping data to match your table columns
  const updates = result.response.map((item: any) => ({
    id: item.fixture.id,
    home_team: item.teams.home.name,
    away_team: item.teams.away.name,
    status: item.fixture.status.short,
    home_score: item.goals.home ?? 0,
    away_score: item.goals.away ?? 0,
    kickoff_time: item.fixture.date,
    last_updated: new Date().toISOString()
  }))

  // THE PART THAT WAS MISSING: Actually saving to the table
  const { error } = await supabase
    .from('matches')
    .upsert(updates, { onConflict: 'id' })

  if (error) {
    console.error("Database Error:", error.message)
    return new Response(JSON.stringify({ db_error: error.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ 
    message: `Successfully synced ${updates.length} matches`,
    success: true 
  }), { status: 200 })
})