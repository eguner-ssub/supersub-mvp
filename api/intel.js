import { createClient } from '@supabase/supabase-js';
import { INTEL_CONFIG } from '../config/intel.js';

// ── Lazy Supabase client ──────────────────────────────────────────────────────
let _client = null;

function getSupabaseClient() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error(`Missing env vars – SUPABASE_URL: ${url ? '✓' : '✗'}, SUPABASE_SERVICE_ROLE_KEY: ${key ? '✓' : '✗'}`);
  _client = createClient(url, key);
  return _client;
}

const { LINEUPS_PHASE_MINUTES } = INTEL_CONFIG;

/**
 * GET /api/intel?match_id=<id>
 *
 * Returns pre-match intel report for a fixture.
 * Returns lineups_phase message if within 60 min of kickoff.
 * Returns fallback if no intel generated yet.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const matchId = parseInt(req.query.match_id);
  if (!matchId || isNaN(matchId)) {
    return res.status(400).json({ error: 'Missing or invalid match_id query param' });
  }

  try {
    const supabase = getSupabaseClient();

    // Load match
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('id, home_team, away_team, home_team_id, away_team_id, kickoff_time, league_id')
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Check timing — if within LINEUPS_PHASE_MINUTES of kickoff, intel is hidden
    const kickoff = new Date(match.kickoff_time);
    const now = new Date();
    const minutesToKickoff = (kickoff - now) / (1000 * 60);

    if (minutesToKickoff <= LINEUPS_PHASE_MINUTES && minutesToKickoff > 0) {
      return res.json({
        available: false,
        reason: 'lineups_phase',
        message: 'Pre-match intel is no longer available. Check the Lineups tab.',
        match: {
          id: match.id,
          homeTeam: match.home_team,
          awayTeam: match.away_team,
          kickoffTime: match.kickoff_time,
        },
      });
    }

    // Load intel
    const { data: intel, error: intelError } = await supabase
      .from('match_intel')
      .select('*')
      .eq('match_id', matchId)
      .single();

    if (intelError || !intel) {
      // No intel generated yet — return fallback
      return res.json({
        available: true,
        sportmonksAvailable: false,
        sections: {},
        prose: {
          summary: 'Detailed predictions unavailable for this match. Check back closer to kickoff for lineup-based analysis.',
        },
        proseMethod: 'fallback',
        match: {
          id: match.id,
          homeTeam: match.home_team,
          awayTeam: match.away_team,
          homeTeamId: match.home_team_id,
          awayTeamId: match.away_team_id,
          kickoffTime: match.kickoff_time,
        },
      });
    }

    // Return full intel
    return res.json({
      available: true,
      match: {
        id: match.id,
        homeTeam: match.home_team,
        awayTeam: match.away_team,
        homeTeamId: match.home_team_id,
        awayTeamId: match.away_team_id,
        kickoffTime: match.kickoff_time,
      },
      sportmonksAvailable: intel.sportmonks_available,
      sections: intel.report_sections,
      prose: intel.prose,
      generatedAt: intel.generated_at,
      proseMethod: intel.prose_method,
    });
  } catch (err) {
    console.error('[api/intel] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
