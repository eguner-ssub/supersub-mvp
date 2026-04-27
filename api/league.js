import { createClient } from '@supabase/supabase-js';
import { syncStandingsForLeague } from '../scripts/sync-standings.js';

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
 *
 * Standings freshness: serve-stale-and-refresh-in-background.
 *
 *   1. SELECT current standings (always — single DB round-trip).
 *   2. If zero rows → cold cache, fall back to BLOCKING sync (then re-query).
 *      First user pays the 5-15s; everyone after is fast.
 *   3. If rows exist + age > STANDINGS_TTL_HOURS → respond with stale data
 *      immediately, then fire-and-forget a POST to /api/cron?job=refresh-
 *      standings&league_id=X. Vercel routes that to a fresh function
 *      invocation that runs the sync; the next user request lands fresh.
 *   4. If rows exist + age <= TTL → respond, no trigger.
 *
 * Trigger failures are logged and swallowed — the next user-driven request
 * will see still-stale data and re-fire the trigger, so the system is
 * self-healing without being block-and-error-prone.
 */

const STANDINGS_TTL_HOURS = 3;
const STANDINGS_TTL_MS = STANDINGS_TTL_HOURS * 60 * 60 * 1000;

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

// ── Lazy refresh helper (scorers tab only) ───────────────────────────────
// Block-and-refresh check used by getTopScorers. Standings has migrated to a
// serve-stale-and-refresh-in-background pattern (see getStandings below);
// scorers retains the original behaviour because the user-reported latency
// regression was scoped to the standings tab. If/when the same UX issue
// surfaces on the Top Scorers tab, switch this to triggerBackgroundRefresh.
async function ensureStandingsFresh(supabase, leagueId, season) {
  if (!season) return;
  const { data: latest } = await supabase
    .from('standings')
    .select('updated_at')
    .eq('season_id', season.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const ageMs = latest?.updated_at
    ? Date.now() - new Date(latest.updated_at).getTime()
    : Infinity;
  if (ageMs <= STANDINGS_TTL_MS) return;

  try {
    const t0 = Date.now();
    const { standings, topScorers } = await syncStandingsForLeague(supabase, leagueId);
    console.log(`[api/league] Lazy refresh league=${leagueId} ageHours=${(ageMs / 3600000).toFixed(1)} → ${standings} standings + ${topScorers} scorers in ${Date.now() - t0}ms`);
  } catch (err) {
    console.error(`[api/league] Lazy refresh failed for league=${leagueId}: ${err.message} — serving stale data`);
  }
}

// ── Standings ─────────────────────────────────────────────────────────────
// Single-query read; freshness derived from the rows themselves so we don't
// pay a second round-trip just to check updated_at. Cold cache is the only
// blocking path; stale-but-populated data is served immediately and the
// caller fires a background refresh.
//
// Returns { rows, needsRefresh }:
//   - rows         → mapped standings array for the response
//   - needsRefresh → caller should trigger the background sync
async function getStandings(supabase, leagueId) {
  const season = await getCurrentSeason(supabase, leagueId);
  if (!season) return { rows: [], needsRefresh: false };

  const standingsQuery = () => supabase
    .from('standings')
    .select('position, played, won, drawn, lost, goals_for, goals_against, points, form, updated_at, teams(name, logo_url, sportmonks_id)')
    .eq('season_id', season.id)
    .order('position', { ascending: true });

  let { data: raw, error } = await standingsQuery();
  if (error) throw new Error(`Standings query failed: ${error.message}`);

  // Cold cache: nothing to serve. Block on the sync, then re-query.
  // First user eats the 5-15s; everyone after gets the serve-stale path.
  if (!raw || raw.length === 0) {
    try {
      const t0 = Date.now();
      const { standings, topScorers } = await syncStandingsForLeague(supabase, leagueId);
      console.log(`[api/league] Cold-start sync league=${leagueId} → ${standings} standings + ${topScorers} scorers in ${Date.now() - t0}ms`);
    } catch (err) {
      console.error(`[api/league] Cold-start sync failed for league=${leagueId}: ${err.message}`);
      return { rows: [], needsRefresh: false };
    }
    ({ data: raw, error } = await standingsQuery());
    if (error) throw new Error(`Standings query failed: ${error.message}`);
  }

  // Freshness check on the data we already have. All rows share an
  // updated_at from the same sync pass, but use max() defensively in case
  // partial writes ever leave mixed timestamps.
  const latestUpdate = (raw || []).reduce((max, r) => {
    if (!r.updated_at) return max;
    const t = new Date(r.updated_at).getTime();
    return t > max ? t : max;
  }, 0);
  const ageMs = latestUpdate ? Date.now() - latestUpdate : Infinity;
  const needsRefresh = ageMs > STANDINGS_TTL_MS;

  const rows = (raw || []).map(row => ({
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

  return { rows, needsRefresh };
}

// ── Background refresh trigger ────────────────────────────────────────────
// Fire a POST to /api/cron?job=refresh-standings&league_id=X — Vercel routes
// that to a fresh function invocation (api/cron has maxDuration=60s, plenty
// of headroom for the 5-15s sync). We DON'T await the response; if the
// trigger fetch fails, the next user request will detect stale data and
// re-fire it.
//
// keepalive: true asks the runtime to flush the request even if this
// function terminates immediately after the call. In Node 18+ undici this
// is honoured for outbound fetches; on Vercel it's the closest we can get
// to a guaranteed dispatch without awaiting.
async function triggerBackgroundRefresh(leagueId) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn(`[api/league] CRON_SECRET not configured — background refresh for league=${leagueId} skipped`);
    return;
  }

  const host = process.env.VERCEL_URL || 'localhost:3000';
  const proto = process.env.VERCEL_URL ? 'https' : 'http';
  const url = `${proto}://${host}/api/cron?job=refresh-standings&league_id=${leagueId}`;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${secret}` },
      keepalive: true,
    });
  } catch (err) {
    console.error(`[api/league] Trigger fetch failed for league=${leagueId}: ${err.message}`);
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────
async function getFixtures(supabase, leagueId) {
  const { data, error } = await supabase
    .from('matches')
    .select('id, home_team, away_team, home_logo, away_logo, home_score, away_score, kickoff_time, status, round_name')
    .eq('league_id', leagueId)
    .order('kickoff_time', { ascending: true });

  if (error) throw new Error(`Fixtures query failed: ${error.message}`);

  const matches = data || [];

  // Build ordered list of unique round labels
  const roundOrder = [];
  const seen = new Set();
  for (const m of matches) {
    const label = m.round_name || 'Unknown';
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
    round:       m.round_name || 'Unknown',
  }));

  return { rounds: roundOrder, currentRound, matches: normalised };
}

// ── Top Scorers ───────────────────────────────────────────────────────────
async function getTopScorers(supabase, leagueId) {
  const season = await getCurrentSeason(supabase, leagueId);
  if (!season) return [];

  // Same TTL check as standings — top_scorers + standings are written together
  // by syncStandingsForLeague, so if standings are stale, scorers are too.
  await ensureStandingsFresh(supabase, leagueId, season);

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
      case 'standings': {
        const { rows, needsRefresh } = await getStandings(supabase, leagueId);
        // Send the response BEFORE firing the trigger — user latency is the
        // SLA we're protecting here. The trigger is fire-and-forget; a
        // failure just means the next user request detects stale data and
        // re-fires it.
        res.status(200).json({ tab, leagueId, standings: rows });
        if (needsRefresh) {
          triggerBackgroundRefresh(leagueId);
        }
        return;
      }

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
