import { createClient } from '@supabase/supabase-js';
import { INTEL_CONFIG } from '../config/intel.js';
import { generateProse } from '../lib/intel/templates.js';

function toFrontendFormat(prose, extras) {
  const p = prose || {};
  const e = extras || {};
  return {
    greeting: p.summary
      ? `Hi Boss. ${p.summary}`
      : `Hi Boss. I've been studying the opposition. Here's what I've found.`,
    greetingContext: e.greetingContext ?? 'no_lineups',
    supersubWatch: e.supersubWatch ?? { available: false, items: [] },
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
        content: p.scoreboardForecast || 'Prediction unavailable.',
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

// ── Shared supersub helpers ───────────────────────────────────────────────────

/**
 * Build a supersubWatch payload from the bench players in match.lineups.
 * Returns { available: boolean, items: [...] }.
 * topN controls how many items to surface per team.
 */
async function buildSupersubWatchFromBench(supabase, match, topN = 2) {
  const homeId = match.home_team_id;
  const awayId = match.away_team_id;
  const lineups = match.lineups || [];

  const homeBench = lineups.filter(e => e.team_id === homeId && e.type_id === 12);
  const awayBench = lineups.filter(e => e.team_id === awayId && e.type_id === 12);
  const benchPlayerIds = [...homeBench, ...awayBench].map(p => p.player_id).filter(Boolean);

  if (benchPlayerIds.length === 0) return { available: false, items: [] };

  const { data: supersubStats } = await supabase
    .from('player_supersub_stats')
    .select('player_id, team_id, goals_as_sub, minutes_as_sub')
    .in('player_id', benchPlayerIds)
    .gt('goals_as_sub', 0);

  const statsById = Object.fromEntries((supersubStats || []).map(s => [s.player_id, s]));

  const toItems = (bench, side, teamName) => bench
    .map(p => ({ ...p, stats: statsById[p.player_id] }))
    .filter(p => p.stats?.goals_as_sub > 0)
    .sort((a, b) => b.stats.goals_as_sub - a.stats.goals_as_sub)
    .slice(0, topN)
    .map(p => ({
      team: side,
      teamName,
      playerName: p.player_name,
      goalsAsSub: p.stats.goals_as_sub,
      goalsPer90AsSub: p.stats.minutes_as_sub > 0
        ? parseFloat(((p.stats.goals_as_sub / p.stats.minutes_as_sub) * 90).toFixed(1))
        : 0,
    }));

  const items = [
    ...toItems(homeBench, 'home', match.home_team),
    ...toItems(awayBench, 'away', match.away_team),
  ];
  return { available: items.length > 0, items };
}

/**
 * Determine whether confirmed XIs are available from lineups data.
 * Returns 'confirmed_xi' | 'predicted_xi' | 'no_lineups'.
 */
function getGreetingContext(lineups, homeId, awayId) {
  if (!lineups || lineups.length === 0) return 'no_lineups';
  const hasHomeBench = lineups.some(e => e.team_id === homeId && e.type_id === 12);
  const hasAwayBench = lineups.some(e => e.team_id === awayId && e.type_id === 12);
  if (hasHomeBench && hasAwayBench) return 'confirmed_xi';
  return 'predicted_xi';
}

// ── Live insights generator ───────────────────────────────────────────────────
async function buildLiveInsights(supabase, match) {
  const homeId = match.home_team_id;
  const awayId = match.away_team_id;
  const homeTeam = match.home_team;
  const awayTeam = match.away_team;

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

  // Load supersub threats via shared helper (topN=1 for live — one per team is enough)
  const benchWatch = await buildSupersubWatchFromBench(supabase, match, 1);
  const homeItem = benchWatch.items.find(i => i.team === 'home');
  const awayItem = benchWatch.items.find(i => i.team === 'away');
  const homeThreat = homeItem
    ? `${homeItem.teamName}'s ${homeItem.playerName} has ${homeItem.goalsAsSub} goal${homeItem.goalsAsSub > 1 ? 's' : ''} as a substitute this season (${homeItem.goalsPer90AsSub} per 90).`
    : null;
  const awayThreat = awayItem
    ? `${awayItem.teamName}'s ${awayItem.playerName} has ${awayItem.goalsAsSub} goal${awayItem.goalsAsSub > 1 ? 's' : ''} as a substitute this season (${awayItem.goalsPer90AsSub} per 90).`
    : null;

  // Resolve coach IDs — use match columns if set, otherwise look up from coaches table
  let homeCoachId = match.home_coach_id;
  let awayCoachId = match.away_coach_id;
  if (!homeCoachId || !awayCoachId) {
    const { data: coachRows } = await supabase
      .from('coaches')
      .select('id, current_team_id')
      .in('current_team_id', [homeId, awayId]);
    for (const c of coachRows || []) {
      if (!homeCoachId && c.current_team_id === homeId) homeCoachId = c.id;
      if (!awayCoachId && c.current_team_id === awayId) awayCoachId = c.id;
    }
  }

  // Load coach substitution patterns
  const coachIds = [homeCoachId, awayCoachId].filter(Boolean);
  const { data: coachPatterns } = coachIds.length > 0
    ? await supabase
        .from('coach_substitution_patterns')
        .select('coach_id, avg_first_sub_minute, matches_managed')
        .in('coach_id', coachIds)
    : { data: [] };

  const patternByCoach = Object.fromEntries((coachPatterns || []).map(c => [c.coach_id, c]));
  const homePattern = homeCoachId ? patternByCoach[homeCoachId] : null;
  const awayPattern = awayCoachId ? patternByCoach[awayCoachId] : null;

  const buildSubLine = (teamName, subEvents, firstSubMinute, pattern) => {
    const used = subEvents.length;
    if (used === 0) {
      return pattern?.avg_first_sub_minute
        ? `${teamName} yet to make a change — manager typically acts around the ${Math.round(pattern.avg_first_sub_minute)}' mark.`
        : `${teamName} yet to make a change.`;
    }
    const vsAvg = pattern?.avg_first_sub_minute
      ? ` (avg ${Math.round(pattern.avg_first_sub_minute)}' historically)`
      : '';
    return `${teamName} made first sub at ${firstSubMinute}'${vsAvg}. ${used} change${used > 1 ? 's' : ''} used.`;
  };

  const homeLine = buildSubLine(homeTeam, homeSubEvents, homeFirstSubMinute, homePattern);
  const awayLine = buildSubLine(awayTeam, awaySubEvents, awayFirstSubMinute, awayPattern);

  // Contextual greeting based on current match events
  const goalEvents = events.filter(e => e.type_id === 16 || e.type_id === 17);
  let greeting = `Hi Boss. The match is underway.`;
  if (goalEvents.length > 0) {
    const last = goalEvents[goalEvents.length - 1];
    const scorer = last.player_name || 'Someone';
    greeting = `Hi Boss. ${scorer} has found the net. Here's what the bench is telling me.`;
  } else if (subEvents.length > 0) {
    greeting = `Hi Boss. Changes are being made. Here's the supersub picture.`;
  }

  // Build carousel insight cards — each is a standalone item
  const insights = [];

  if (homeThreat) insights.push({ type: 'bench', text: homeThreat });
  if (awayThreat) insights.push({ type: 'bench', text: awayThreat });
  if (!homeThreat && !awayThreat) {
    insights.push({ type: 'bench', text: 'No notable supersub threats on either bench this season.' });
  }
  if (homeLine) insights.push({ type: 'sub', text: homeLine });
  if (awayLine) insights.push({ type: 'sub', text: awayLine });

  // Legacy flat fields for backwards compatibility
  const benchPotential = [homeThreat, awayThreat].filter(Boolean).join(' ') ||
    'No notable supersub threats on either bench this season.';
  const subAnalysis = [homeLine, awayLine].filter(Boolean).join(' ') ||
    'Substitution data unavailable.';

  return { greeting, insights, benchPotential, subAnalysis };
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
      .select('id, home_team, away_team, home_team_id, away_team_id, kickoff_time, league_id, season, lineups')
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
        analysis: toFrontendFormat(fallbackProse, {
          supersubWatch: { available: false, items: [] },
          greetingContext: getGreetingContext(match.lineups, match.home_team_id, match.away_team_id),
        }),
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

    // Re-generate prose at request time so template fixes apply instantly
    // without needing to re-run the sync script on stored records.
    // If formGuide was stored as unavailable (standings not synced at intel-sync time),
    // try fetching fresh standings now so the section can be populated.
    //
    // standings.team_id and standings.season_id are UUIDs (FKs to the local
    // teams/seasons tables); matches stores only Sportmonks integer IDs.
    // Mirror the writer-side logic in sync-standings.js: resolve the current
    // season UUID via leagues.current_season_id, and resolve team UUIDs via
    // teams.sportmonks_id.
    let sectionsToUse = intel.report_sections;
    if (sectionsToUse && !sectionsToUse.formGuide?.available) {
      const { data: league } = await supabase
        .from('leagues')
        .select('current_season_id')
        .eq('sportmonks_id', match.league_id)
        .single();
      const currentSeasonUuid = league?.current_season_id || null;

      const { data: teamRows } = await supabase
        .from('teams')
        .select('id, sportmonks_id')
        .in('sportmonks_id', [match.home_team_id, match.away_team_id]);
      const homeTeamUuid = teamRows?.find(t => t.sportmonks_id === match.home_team_id)?.id || null;
      const awayTeamUuid = teamRows?.find(t => t.sportmonks_id === match.away_team_id)?.id || null;

      console.log('[Intel] Resolved season UUID:', currentSeasonUuid, 'home team UUID:', homeTeamUuid, 'away team UUID:', awayTeamUuid);

      if (currentSeasonUuid && (homeTeamUuid || awayTeamUuid)) {
        const teamUuids = [homeTeamUuid, awayTeamUuid].filter(Boolean);
        const { data: standings } = await supabase
          .from('standings')
          .select('team_id, position, played, points, form')
          .in('team_id', teamUuids)
          .eq('season_id', currentSeasonUuid);
        if (standings?.length) {
          const homeS = homeTeamUuid ? standings.find(s => s.team_id === homeTeamUuid) : null;
          const awayS = awayTeamUuid ? standings.find(s => s.team_id === awayTeamUuid) : null;
          if (homeS || awayS) {
            sectionsToUse = {
              ...sectionsToUse,
              formGuide: {
                source: 'internal',
                available: true,
                data: {
                  home: homeS ? { position: homeS.position, played: homeS.played, points: homeS.points, form: homeS.form } : null,
                  away: awayS ? { position: awayS.position, played: awayS.played, points: awayS.points, form: awayS.form } : null,
                },
                insight: null,
              },
            };
          }
        }
      }
    }

    const freshProse = sectionsToUse
      ? generateProse(sectionsToUse, match.home_team, match.away_team)
      : intel.prose;

    // Build greetingContext and supersubWatch for the pre-match analysis response
    const greetingContext = getGreetingContext(match.lineups, match.home_team_id, match.away_team_id);
    let supersubWatch;
    if (greetingContext === 'confirmed_xi') {
      // Lineups are confirmed — pull live bench data (topN=2 per team)
      supersubWatch = await buildSupersubWatchFromBench(supabase, match, 2);
    } else {
      // Lineups not yet confirmed — use cached top supersubs from match_intel
      const homeTop = intel.home_top_supersubs?.[0];
      const awayTop = intel.away_top_supersubs?.[0];
      const items = [];
      if (homeTop) items.push({
        team: 'home',
        teamName: match.home_team,
        playerName: homeTop.player_name ?? homeTop.name,
        goalsAsSub: homeTop.goals_as_sub ?? homeTop.goalsAsSub,
        goalsPer90AsSub: homeTop.goals_per_90_as_sub ?? homeTop.goalsPer90AsSub ?? 0,
      });
      if (awayTop) items.push({
        team: 'away',
        teamName: match.away_team,
        playerName: awayTop.player_name ?? awayTop.name,
        goalsAsSub: awayTop.goals_as_sub ?? awayTop.goalsAsSub,
        goalsPer90AsSub: awayTop.goals_per_90_as_sub ?? awayTop.goalsPer90AsSub ?? 0,
      });
      supersubWatch = { available: items.length > 0, items };
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
      prose: freshProse,
      generatedAt: intel.generated_at,
      proseMethod: intel.prose_method,
      analysis: toFrontendFormat(freshProse, { supersubWatch, greetingContext }),
    });
  } catch (err) {
    console.error('[api/intel] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
