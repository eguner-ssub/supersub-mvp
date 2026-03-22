import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/league?tab=<tab>&league_id=<sportmonks_league_id>
 *
 * Tabs:
 *   standings — league table for current season
 *   fixtures  — all season fixtures grouped by round (includes round list)
 *   scorers   — top scorers for current season
 *   bench     — team bench watch stats (top 20 by total bench goals)
 *
 * league_id is a Sportmonks integer (EPL=8, Championship=9, etc.)
 */

// ── Lazy Supabase client ───────────────────────────────────────────────────
let _client = null;

function getSupabaseClient() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  _client = createClient(url, key);
  return _client;
}

// ── Helper: resolve current season for a league ───────────────────────────
async function getCurrentSeason(supabase, leagueId) {
  // leagueId is Sportmonks integer
  const { data: league, error: leagueErr } = await supabase
    .from('leagues')
    .select('id, current_season_id')
    .eq('sportmonks_id', leagueId)
    .single();

  if (leagueErr || !league) return null;

  if (!league.current_season_id) {
    // Fallback: find any is_current season for this league
    const { data: season } = await supabase
      .from('seasons')
      .select('id, sportmonks_id')
      .eq('league_id', league.id)
      .eq('is_current', true)
      .single();
    return season || null;
  }

  const { data: season } = await supabase
    .from('seasons')
    .select('id, sportmonks_id')
    .eq('id', league.current_season_id)
    .single();

  return season || null;
}

// ── Standings ─────────────────────────────────────────────────────────────
async function getStandings(supabase, leagueId) {
  const season = await getCurrentSeason(supabase, leagueId);
  if (!season) return [];

  const { data, error } = await supabase
    .from('standings')
    .select('position, played, won, drawn, lost, goals_for, goals_against, points, form, teams(name, logo_url, sportmonks_id)')
    .eq('season_id', season.id)
    .order('position', { ascending: true });

  if (error) throw new Error(`Standings query failed: ${error.message}`);
  return (data || []).map(row => ({
    position: row.position,
    team:     row.teams?.name || 'Unknown',
    logo:     row.teams?.logo_url || null,
    played:   row.played,
    won:      row.won,
    drawn:    row.drawn,
    lost:     row.lost,
    gf:       row.goals_for,
    ga:       row.goals_against,
    gd:       (row.goals_for || 0) - (row.goals_against || 0),
    points:   row.points,
    form:     row.form || null,
  }));
}

// ── Fixtures ──────────────────────────────────────────────────────────────
async function getFixtures(supabase, leagueId) {
  const { data, error } = await supabase
    .from('matches')
    .select('id, home_team, away_team, home_logo, away_logo, home_score, away_score, kickoff_time, status, round, round_name')
    .eq('league_id', leagueId)
    .order('kickoff_time', { ascending: true });

  if (error) throw new Error(`Fixtures query failed: ${error.message}`);

  const matches = data || [];

  // Build ordered list of unique round labels
  const roundOrder = [];
  const seen = new Set();
  for (const m of matches) {
    const label = m.round_name || `Round ${m.round}` || 'Unknown';
    if (!seen.has(label)) {
      seen.add(label);
      roundOrder.push(label);
    }
  }

  // Detect current round: last round with a played match (or first round with upcoming)
  const now = new Date().toISOString();
  const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'FT_PEN', 'FINISHED', 'AWARDED'];

  let currentRound = roundOrder[0] || null;

  // Last round that has at least one completed match
  for (const label of roundOrder) {
    const roundMatches = matches.filter(m => (m.round_name || `Round ${m.round}`) === label);
    const hasFinished = roundMatches.some(m => FINISHED_STATUSES.includes(m.status?.toUpperCase()));
    if (hasFinished) currentRound = label;
  }

  // If next round is upcoming, advance to it
  const currentIdx = roundOrder.indexOf(currentRound);
  if (currentIdx >= 0 && currentIdx + 1 < roundOrder.length) {
    const nextLabel = roundOrder[currentIdx + 1];
    const nextRoundMatches = matches.filter(m => (m.round_name || `Round ${m.round}`) === nextLabel);
    const hasUpcoming = nextRoundMatches.some(m => m.kickoff_time > now);
    const allFuture = nextRoundMatches.every(m => m.kickoff_time > now);
    if (hasUpcoming && allFuture) currentRound = nextLabel;
  }

  // Normalise matches for the frontend
  const normalised = matches.map(m => ({
    id:          m.id,
    homeTeam:    m.home_team,
    awayTeam:    m.away_team,
    homeLogo:    m.home_logo,
    awayLogo:    m.away_logo,
    homeScore:   m.home_score,
    awayScore:   m.away_score,
    kickoffTime: m.kickoff_time,
    status:      m.status,
    round:       m.round_name || `Round ${m.round}` || 'Unknown',
  }));

  return { rounds: roundOrder, currentRound, matches: normalised };
}

// ── Top Scorers ───────────────────────────────────────────────────────────
async function getTopScorers(supabase, leagueId) {
  const season = await getCurrentSeason(supabase, leagueId);
  if (!season) return [];

  const { data, error } = await supabase
    .from('top_scorers')
    .select('sportmonks_id, player_name, goals, assists, minutes_played, teams(name, logo_url)')
    .eq('season_id', season.id)
    .order('goals', { ascending: false })
    .limit(20);

  if (error) throw new Error(`Top scorers query failed: ${error.message}`);

  return (data || []).map((row, i) => ({
    rank:     i + 1,
    name:     row.player_name,
    team:     row.teams?.name || 'Unknown',
    logo:     row.teams?.logo_url || null,
    goals:    row.goals,
    assists:  row.assists,
    minutes:  row.minutes_played,
  }));
}

// ── Bench Watch ───────────────────────────────────────────────────────────
async function getBenchWatch(supabase, leagueId) {
  const season = await getCurrentSeason(supabase, leagueId);
  if (!season) return [];

  // Get all teams that appear in standings for this league/season
  // (standings has team_id UUID; teams has sportmonks_id INTEGER which matches team_bench_stats.team_id)
  const { data: standingRows, error: standErr } = await supabase
    .from('standings')
    .select('teams(sportmonks_id)')
    .eq('season_id', season.id);

  if (standErr) throw new Error(`Standings team lookup failed: ${standErr.message}`);

  const teamSportmonksIds = (standingRows || [])
    .map(r => r.teams?.sportmonks_id)
    .filter(Boolean);

  if (teamSportmonksIds.length === 0) return [];

  // Query team_bench_stats for these teams and current sportmonks season_id
  const { data: benchData, error: benchErr } = await supabase
    .from('team_bench_stats')
    .select('team_id, total_bench_goals, matches_played, matches_with_bench_goal, total_subs_made')
    .eq('season_id', season.sportmonks_id)
    .in('team_id', teamSportmonksIds)
    .order('total_bench_goals', { ascending: false })
    .limit(20);

  if (benchErr) throw new Error(`Bench watch query failed: ${benchErr.message}`);

  if (!benchData?.length) return [];

  // Join team names/logos from teams table
  const { data: teamRows } = await supabase
    .from('teams')
    .select('sportmonks_id, name, logo_url')
    .in('sportmonks_id', teamSportmonksIds);

  const teamById = Object.fromEntries((teamRows || []).map(t => [t.sportmonks_id, t]));

  return benchData.map((row, i) => {
    const team = teamById[row.team_id] || {};
    const bpm = row.matches_played > 0
      ? (row.total_bench_goals / row.matches_played).toFixed(2)
      : '0.00';
    const benchGoalPct = row.matches_played > 0
      ? Math.round((row.matches_with_bench_goal / row.matches_played) * 100)
      : 0;
    return {
      rank:          i + 1,
      team:          team.name || `Team ${row.team_id}`,
      logo:          team.logo_url || null,
      benchGoals:    row.total_bench_goals,
      matchesPlayed: row.matches_played,
      benchGoalsPM:  bpm,
      benchGoalPct,
    };
  });
}

// ── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const leagueId = parseInt(req.query.league_id);
  if (!leagueId || isNaN(leagueId)) {
    return res.status(400).json({ error: 'Missing or invalid league_id' });
  }

  const tab = req.query.tab || 'standings';
  const VALID_TABS = ['standings', 'fixtures', 'scorers', 'bench'];
  if (!VALID_TABS.includes(tab)) {
    return res.status(400).json({ error: `Invalid tab. Must be one of: ${VALID_TABS.join(', ')}` });
  }

  try {
    const supabase = getSupabaseClient();
    let data;

    switch (tab) {
      case 'standings':
        data = await getStandings(supabase, leagueId);
        return res.status(200).json({ tab, leagueId, standings: data });

      case 'fixtures':
        data = await getFixtures(supabase, leagueId);
        return res.status(200).json({ tab, leagueId, ...data });

      case 'scorers':
        data = await getTopScorers(supabase, leagueId);
        return res.status(200).json({ tab, leagueId, scorers: data });

      case 'bench':
        data = await getBenchWatch(supabase, leagueId);
        return res.status(200).json({ tab, leagueId, bench: data });

      default:
        return res.status(400).json({ error: 'Unknown tab' });
    }
  } catch (err) {
    console.error(`[api/league] Error (tab=${tab}, league=${leagueId}):`, err.message);
    return res.status(500).json({ error: err.message });
  }
}
