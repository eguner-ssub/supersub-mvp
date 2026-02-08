import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Copy your supported IDs here
const SUPPORTED_LEAGUE_IDS = [39, 40, 71, 78]; 

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const API_KEY = Deno.env.get('SPORTS_API_KEY')?.trim()
  const today = new Date().toISOString().split('T')[0]
  
  const response = await fetch(`https://v3.football.api-sports.io/fixtures?date=${today}`, {
    headers: { 
      'x-apisports-key': API_KEY || '',
      'Content-Type': 'application/json'
    }
  })
  
  const result = await response.json()

  if (!result.response || result.response.length === 0) {
    return new Response(JSON.stringify({ message: "No matches found" }), { status: 200 })
  }

  // SANITIZATION LOGIC: Filter out any match NOT in your coverage
  const filteredMatches = result.response.filter((item: any) => 
    SUPPORTED_LEAGUE_IDS.includes(item.league.id)
  )

  if (filteredMatches.length === 0) {
    return new Response(JSON.stringify({ message: "No matches from covered leagues today" }), { status: 200 })
  }

  const updates = filteredMatches.map((item: any) => ({
    id: item.fixture.id,
    league_id: item.league.id, // Now storing the league ID
    home_team: item.teams.home.name,
    away_team: item.teams.away.name,
    status: item.fixture.status.short,
    home_score: item.goals.home ?? 0,
    away_score: item.goals.away ?? 0,
    kickoff_time: item.fixture.date,
    last_updated: new Date().toISOString()
  }))

  const { error } = await supabase
    .from('matches')
    .upsert(updates, { onConflict: 'id' })

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  return new Response(JSON.stringify({ 
    message: `Sanitized Sync: Saved ${updates.length} matches from supported leagues.` 
  }), { status: 200 })
})