// GET /api/stats-gen/leagues
// Returns the 5 supported leagues with IDs, names, countries, and logo URLs.
// Logo URLs are sourced from the leagues table (populated by sync-standings)
// with a fallback to SportMonks CDN paths.

import { getSupabase } from '../auth.js';

// Mirrors src/shared/config/coverage.js — canonical league list.
const SUPPORTED_LEAGUES = [
  { id: 8,   name: 'Premier League', country: 'England' },
  { id: 301, name: 'Ligue 1',        country: 'France' },
  { id: 82,  name: 'Bundesliga',     country: 'Germany' },
  { id: 564, name: 'La Liga',        country: 'Spain' },
  { id: 384, name: 'Serie A',        country: 'Italy' },
];

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Enrich with logo URLs from the DB if available
  const supabase = getSupabase();
  const { data: dbLeagues } = await supabase
    .from('leagues')
    .select('sportmonks_id, name')
    .in('sportmonks_id', SUPPORTED_LEAGUES.map(l => l.id));

  // Build a lookup for any DB-stored names (in case they differ from hardcoded)
  const dbBySmId = Object.fromEntries(
    (dbLeagues || []).map(r => [r.sportmonks_id, r])
  );

  const leagues = SUPPORTED_LEAGUES.map(l => ({
    id: l.id,
    name: dbBySmId[l.id]?.name || l.name,
    country: l.country,
  }));

  return res.status(200).json({ leagues });
}
