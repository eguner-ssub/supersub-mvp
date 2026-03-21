import { createClient } from '@supabase/supabase-js';
import { INTEL_CONFIG } from '../config/intel.js';

function toFrontendFormat(prose) {
  const p = prose || {};
  return {
    greeting: p.summary
      ? `Hi Boss. ${p.summary}`
      : `Hi Boss. I've been studying the opposition. Here's what I've found.`,
    sections: [
      {
        title: 'Form Guide',
        content: p.formGuide || 'Form data unavailable for this match.',
      },
      {
        title: 'Key Matchup',
        content: [p.commandOfPitch, p.managerTendencies].filter(Boolean).join(' ') || 'Match prediction data unavailable.',
      },
      {
        title: 'Goals Market',
        content: [p.totalGoalOutlook, p.defensiveDiscipline, p.attackingFirepower].filter(Boolean).join(' ') || 'Goals market data unavailable.',
      },
      {
        title: 'Prediction',
        content: [p.scoreboardForecast, p.benchWatch].filter(Boolean).join(' ') || 'Prediction unavailable.',
      },
    ],
  };
}

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

// ── Live insights generator ───────────────────────────────────────────────────
async function buildLiveInsights(supabase, match) {
  const homeId = match.home_team_id;
  const awayId = match.away_team_id;
  const homeTeam = match.home_team;
  const awayTeam = match.away_team;

  // Extract bench players (type_id=12) from stored lineups
  const lineups = match.lineups || [];
  const homeBench = lineups.filter(e => e.team_id === homeId && e.type_id === 12);
  const awayBench = lineups.filter(e => e.team_id === awayId && e.type_id === 12);

  // Extract substitution events (type_id=18) to count subs used and when first was made
  const events = match.events || [];
  const subEvents = events.filter(e => e.type_id === 18);
  const homeSubEvents = subEvents.filter(e => e.participant_id === homeId || e.team_id === homeId);
  const awaySubEvents = subEvents.filter(e => e.participant_id === awayId || e.team_id === awayId);
  const homeFirstSubMinute = homeSubEvents.length > 0
    ? Math.min(...homeSubEvents.map(e => e.minute || e.result || 999))
    : null;
  const awayFirstSubMinute = awaySubEvents.length > 0
    ? Math.min(...awaySubEvents.map(e => e.minute || e.result || 999))
    : null;

  // Load supersub stats for bench players
  const benchPlayerIds = [...homeBench, ...awayBench].map(p => p.player_id).filter(Boolean);
  const { data: supersubStats } = benchPlayerIds.length > 0
    ? await supabase
        .from('player_supersub_stats')
        .select('player_id, team_id, goals_as_sub, minutes_as_sub')
        .in('player_id', benchPlayerIds)
        .gt('goals_as_sub', 0)
    : { data: [] };

  const statsById = Object.fromEntries((supersubStats || []).map(s => [s.player_id, s]));

  // Find most dangerous bench player per team
  const findDangerousBench = (bench, teamName) => {
    const threats = bench
      .map(p => ({ ...p, stats: statsById[p.player_id] }))
      .filter(p => p.stats?.goals_as_sub > 0)
      .sort((a, b) => b.stats.goals_as_sub - a.stats.goals_as_sub);

    if (!threats.length) return null;
    const top = threats[0];
    const per90 = top.stats.minutes_as_sub > 0
      ? ((top.stats.goals_as_sub / top.stats.minutes_as_sub) * 90).toFixed(1)
      : '?';
    return `${teamName}'s ${top.player_name} has ${top.stats.goals_as_sub} goal${top.stats.goals_as_sub > 1 ? 's' : ''} as a substitute this season (${per90} per 90).`;
  };

  const homeThreat = findDangerousBench(homeBench, homeTeam);
  const awayThreat = findDangerousBench(awayBench, awayTeam);
  const benchPotential = [homeThreat, awayThreat].filter(Boolean).join(' ') ||
    'No notable supersub threats on either bench this season.';

  // Load coach patterns for sub timing analysis
  const coachIds = [match.home_coach_id, match.away_coach_id].filter(Boolean);
  const { data: coachPatterns } = coachIds.length > 0
    ? await supabase
        .from('coach_substitution_patterns')
        .select('coach_id, avg_first_sub_minute, matches_managed')
        .in('coach_id', coachIds)
    : { data: [] };

  const patternByCoach = Object.fromEntries((coachPatterns || []).map(c => [c.coach_id, c]));
  const homePattern = match.home_coach_id ? patternByCoach[match.home_coach_id] : null;
  const awayPattern = match.away_coach_id ? patternByCoach[match.away_coach_id] : null;

  const buildSubLine = (teamName, subEvents, firstSubMinute, pattern) => {
    const used = subEvents.length;
    if (used === 0 && pattern?.avg_first_sub_minute) {
      return `${teamName} yet to make a change — manager typically acts around the ${Math.round(pattern.avg_first_sub_minute)}' mark.`;
    }
    if (used > 0 && firstSubMinute !== null) {
      const vsAvg = pattern?.avg_first_sub_minute
        ? ` (avg ${Math.round(pattern.avg_first_sub_minute)}' historically)`
        : '';
      return `${teamName} made first sub at ${firstSubMinute}'${vsAvg}. ${used} change${used > 1 ? 's' : ''} used.`;
    }
    return null;
  };

  const homeLine = buildSubLine(homeTeam, homeSubEvents, homeFirstSubMinute, homePattern);
  const awayLine = buildSubLine(awayTeam, awaySubEvents, awayFirstSubMinute, awayPattern);
  const subAnalysis = [homeLine, awayLine].filter(Boolean).join(' ') ||
    'Substitution data unavailable.';

  // Contextual greeting based on current score events
  const goalEvents = events.filter(e => e.type_id === 16 || e.type_id === 17); // goal / own goal
  let greeting = `Hi Boss. The match is underway.`;
  if (goalEvents.length > 0) {
    const last = goalEvents[goalEvents.length - 1];
    const scorer = last.player_name || 'Someone';
    greeting = `Hi Boss. ${scorer} has found the net. Here's what the bench is telling me.`;
  } else if (subEvents.length > 0) {
    greeting = `Hi Boss. Changes are being made. Here's the supersub picture.`;
  }

  return { greeting, benchPotential, subAnalysis };
}

/**
 * GET /api/intel?match_id=<id>            — pre-match analysis
 * GET /api/intel?match_id=<id>&phase=live — live bench/sub insights
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const matchId = parseInt(req.query.match_id);
  if (!matchId || isNaN(matchId)) {
    return res.status(400).json({ error: 'Missing or invalid match_id query param' });
  }

  const phase = req.query.phase || 'pre';

  try {
    const supabase = getSupabaseClient();

    // ── LIVE phase ────────────────────────────────────────────────────────────
    if (phase === 'live') {
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .select('id, home_team, away_team, home_team_id, away_team_id, home_coach_id, away_coach_id, lineups, events')
        .eq('id', matchId)
        .single();

      if (matchError || !match) {
        return res.status(404).json({ error: 'Match not found' });
      }

      const insights = await buildLiveInsights(supabase, match);
      return res.json({ available: true, ...insights });
    }

    // ── PRE phase (default) ───────────────────────────────────────────────────
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
      const fallbackProse = {
        summary: 'Detailed predictions unavailable for this match. Check back closer to kickoff for lineup-based analysis.',
      };
      return res.json({
        available: true,
        sportmonksAvailable: false,
        sections: {},
        prose: fallbackProse,
        proseMethod: 'fallback',
        analysis: toFrontendFormat(fallbackProse),
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
      analysis: toFrontendFormat(intel.prose),
    });
  } catch (err) {
    console.error('[api/intel] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
