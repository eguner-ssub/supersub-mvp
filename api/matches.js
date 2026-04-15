import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ── Inline league IDs to avoid pathing issues in Vercel's function runtime ──
// Mirrors: src/shared/config/coverage.js → SUPPORTED_LEAGUE_IDS
// Sportmonks league IDs: EPL=8, Ligue 1=301, Bundesliga=82, La Liga=564, Serie A=384
const SUPPORTED_LEAGUE_IDS = [8, 301, 82, 564, 384];

// ── Lazy Supabase Client ──────────────────────────────────────────────────────
let _client = null;

function getSupabaseClient() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      `Missing env vars – SUPABASE_URL: ${url ? '✓' : '✗'}, SUPABASE_SERVICE_ROLE_KEY: ${key ? '✓' : '✗'}`
    );
  }
  _client = createClient(url, key);
  return _client;
}

// ── Lineups transform (absorbed from api/lineups.js) ─────────────────────────
// Sportmonks stores lineups as a flat array; MatchLineup.jsx expects per-team objects.
function transformLineups(flatLineups, matchRow) {
  if (!flatLineups || !Array.isArray(flatLineups) || flatLineups.length === 0) return [];

  const teamIds = [];
  for (const entry of flatLineups) {
    if (entry.team_id != null && !teamIds.includes(entry.team_id)) {
      teamIds.push(entry.team_id);
      if (teamIds.length === 2) break;
    }
  }
  if (teamIds.length < 2) return [];

  const [homeId, awayId] = teamIds;

  const buildTeam = (teamId, teamName, teamLogo) => {
    const players  = flatLineups.filter(e => e.team_id === teamId);
    const starters = players.filter(e => e.type_id === 11);
    const subs     = players.filter(e => e.type_id === 12);

    let formation = null;
    if (starters.some(e => e.formation_field)) {
      const rowCounts = {};
      for (const e of starters) {
        if (e.formation_field) {
          const row = parseInt(e.formation_field.split(':')[0], 10) || 1;
          rowCounts[row] = (rowCounts[row] || 0) + 1;
        }
      }
      const outfieldRows = Object.keys(rowCounts)
        .map(Number).filter(r => r > 1).sort((a, b) => a - b).map(r => rowCounts[r]);
      if (outfieldRows.length > 0) formation = outfieldRows.join('-');
    }

    return {
      team: { id: teamId, name: teamName || 'Team', logo: teamLogo || null },
      formation: formation || '4-4-2',
      startXI: starters.map(e => ({
        player: { id: e.player_id || null, name: e.player_name || 'Unknown', number: e.jersey_number || '', pos: null, grid: e.formation_field || null },
      })),
      substitutes: subs.map(e => ({
        player: { id: e.player_id || null, name: e.player_name || 'Unknown', number: e.jersey_number || '' },
      })),
    };
  };

  return [
    buildTeam(homeId, matchRow?.home_team, matchRow?.home_logo),
    buildTeam(awayId, matchRow?.away_team, matchRow?.away_logo),
  ];
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  try {
    const supabase = getSupabaseClient();
    const { id, date: dateParam, fixture, include } = req.query;

    // ── SCENARIO 1: include=lineups  GET /api/matches?fixture=<id>&include=lineups ──
    if (fixture && include === 'lineups') {
      const { data, error } = await supabase
        .from('matches')
        .select('id, home_team, away_team, home_logo, away_logo, lineups')
        .eq('id', Number(fixture))
        .single();
      if (error) return res.status(500).json({ response: [], error: error.message });
      return res.status(200).json({ response: transformLineups(data?.lineups, data) });
    }

    // ── SCENARIO 2: include=events  GET /api/matches?fixture=<id>&include=events ──
    if (fixture && include === 'events') {
      const { data, error } = await supabase
        .from('matches')
        .select('events')
        .eq('id', Number(fixture))
        .single();
      if (error) return res.status(500).json({ response: [], error: error.message });
      return res.status(200).json({ response: data?.events || [] });
    }

    // ── SCENARIO 3: Single match by ID  GET /api/matches?id=<id> ──
    if (id) {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('id', Number(id))
        .single();
      if (error || !data) return res.status(200).json({ response: [], error: error?.message });
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
      return res.status(200).json({ response: [data] });
    }

    // ── SCENARIO 4: Date-based feed  GET /api/matches?date=YYYY-MM-DD ──
    const date = dateParam || new Date().toISOString().split('T')[0];
    console.log(`[Matches API] Querying date=${date}`);

    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('date', date)
      .in('league_id', SUPPORTED_LEAGUE_IDS)
      .order('kickoff_time', { ascending: true });

    if (error) return res.status(200).json({ response: [], error: error.message });

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    return res.status(200).json({ response: data || [], date_queried: date, source: 'supabase' });
  } catch (err) {
    return res.status(500).json({ error: 'API_INIT_FAILED', message: err.message || 'Environment variables missing on server.' });
  }
}