import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const API_KEY = Deno.env.get('SPORTS_API_KEY')
  const today = new Date().toISOString().split('T')[0]
  
  console.log(`DEBUG: Fetching for date: ${today}`)

  const response = await fetch(`https://v3.football.api-sports.io/fixtures?date=${today}`, {
    headers: { 
      'x-apisports-key': API_KEY || '',
      'Content-Type': 'application/json'
    }
  })
  
  const result = await response.json()
  
  // CRITICAL: Log the entire raw response to see hidden errors
  console.log("DEBUG: Raw API Response:", JSON.stringify(result))

  // Check if the API sent an error message (common with free plans)
  if (result.errors && Object.keys(result.errors).length > 0) {
    console.error("API Error detected:", result.errors)
    return new Response(JSON.stringify({ 
      error: "API Provider Error", 
      details: result.errors 
    }), { status: 500 })
  }

  return new Response(JSON.stringify({ 
    message: "Check the logs for the raw output", 
    match_count: result.response?.length || 0 
  }), { status: 200 })
})