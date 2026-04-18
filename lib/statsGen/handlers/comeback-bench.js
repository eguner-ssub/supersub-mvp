// GET /api/stats-gen/comeback-bench
//   ?fixture_id=X                  → single-match analysis
//   ?league_id=X&gameweek=Y        → gameweek-scoped aggregation
//   ?league_id=X&scope=season      → full current-season aggregation
// Matches where bench players turned around a losing position.
// Reconstructs score timeline from goal events to detect comebacks.

import { requireStatsGenToken, getSupabase } from '../auth.js';
import { resolveLeagueContext } from '../resolveSeason.js';

const TERMINAL = ['FT', 'AET', 'FT_PEN'];

function analyseComeback(match) {
  const events = Array.isArray(match.events) ? match.events : [];
  if (!events.length) return null;

  const homeId = match.home_team_id;
  const awayId = match.away_team_id;

  // Sort goals chronologically
  const goals = events
    .filter(e => e.type_id === 14 || e.type_id === 97 || e.type === 'Goal')
    .map(e => ({
      minute: e.minute ?? e.time?.elapsed ?? 0,
      scorerId: Number(e.player_id ?? e.player?.id),
      scorerName: e.player_name || e.player?.name,
      teamId: e.participant_id ?? e.team?.id,
    }))
    .filter(g => g.minute <= 120)
    .sort((a, b) => a.minute - b.minute);

  // Build sub map (all teams)
  const subsOn = new Map();
  for (const e of events) {
    if (e.type_id !== 18 && e.type !== 'subst') continue;
    const incoming = e.player_id; // Sportmonks v3: player_id = incoming player
    if (incoming == null) continue;
    subsOn.set(Number(incoming), {
      minute: e.minute ?? e.time?.elapsed ?? 0,
      teamId: e.participant_id ?? e.team?.id,
    });
  }

  // Walk through goals, track score, detect comeback contributions by subs
  let homeGoals = 0, awayGoals = 0;
  const comebackSubs = [];
  let comebackMinute = null;
  let scoreAtConcession = null;

  for (const g of goals) {
    const prevH = homeGoals, prevA = awayGoals;
    if (g.teamId === homeId) homeGoals++;
    else if (g.teamId === awayId) awayGoals++;

    // Check if scorer is a sub
    const sub = subsOn.get(g.scorerId);
    if (!sub || g.minute < sub.minute) continue;

    const scorerTeam = g.teamId;
    const wasLosing = scorerTeam === homeId ? prevH < prevA : prevA < prevH;
    const nowLevel  = homeGoals === awayGoals;
    const nowAhead  = scorerTeam === homeId ? homeGoals > awayGoals : awayGoals > homeGoals;

    if (wasLosing && (nowLevel || nowAhead)) {
      if (!scoreAtConcession) scoreAtConcession = `${prevH}-${prevA}`;
      if (!comebackMinute) comebackMinute = g.minute;
      comebackSubs.push({
        player_name: g.scorerName || `Player ${g.scorerId}`,
        entry_minute: sub.minute,
        goals_scored: 1,
        assists: 0,
      });
    }
  }

  if (comebackSubs.length === 0) return null;

  // Aggregate goals per sub player
  const byPlayer = new Map();
  for (const s of comebackSubs) {
    const key = s.player_name;
    const agg = byPlayer.get(key) || { ...s, goals_scored: 0 };
    agg.goals_scored += s.goals_scored;
    byPlayer.set(key, agg);
  }

  return {
    match_id: match.id,
    match_title: `${match.home_team} vs ${match.away_team}`,
    match_date: match.date || match.kickoff_time?.split?.('T')?.[0],
    home_team_badge_url: match.home_logo,
    away_team_badge_url: match.away_logo,
    score_at_concession: scoreAtConcession,
    final_score: `${match.home_score}-${match.away_score}`,
    comeback_minute: comebackMinute,
    key_sub_players: [...byPlayer.values()],
    total_sub_contribution: [...byPlayer.values()].reduce((s, p) => s + p.goals_scored, 0),
    league_name: match.league_name,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const fixtureId = req.query.fixture_id ? parseInt(req.query.fixture_id, 10) : null;
  const leagueId  = req.query.league_id  ? parseInt(req.query.league_id, 10)  : null;
  const gameweek  = req.query.gameweek?.trim() || null;
  const scope     = req.query.scope?.trim() || null;

  if (!fixtureId && !leagueId) return res.status(400).json({ error: 'fixture_id or league_id required' });

  try {
    const supabase = getSupabase();

    let matches;
    let leagueName = null;

    if (fixtureId) {
      const { data, error } = await supabase
        .from('matches')
        .select('id, home_team, away_team, home_team_id, away_team_id, home_score, away_score, home_logo, away_logo, events, date, kickoff_time, league_name, league_id')
        .eq('id', fixtureId)
        .in('status', TERMINAL);
      if (error) throw error;
      matches = data || [];
      if (matches[0]?.league_id) {
        const ctx = await resolveLeagueContext(supabase, matches[0].league_id);
        leagueName = ctx.league_name;
      }
    } else {
      const ctx = await resolveLeagueContext(supabase, leagueId);
      leagueName = ctx.league_name;

      let query = supabase
        .from('matches')
        .select('id, home_team, away_team, home_team_id, away_team_id, home_score, away_score, home_logo, away_logo, events, date, kickoff_time, league_name, league_id')
        .eq('league_id', leagueId)
        .in('status', TERMINAL);
      // scope=season: aggregate across the current season — skip gameweek
      // filter (even if one slipped through) and widen the result cap so a
      // full league season fits (EPL = 380 matches).
      if (scope !== 'season' && gameweek) {
        query = query.ilike('round_name', `%${gameweek}%`);
      }
      const rowLimit = scope === 'season' ? 500 : 100;
      const { data, error } = await query.order('kickoff_time', { ascending: false }).limit(rowLimit);
      if (error) throw error;
      matches = data || [];
    }

    const comebacks = matches
      .map(m => ({ ...m, league_name: leagueName }))
      .map(analyseComeback)
      .filter(Boolean);

    return res.status(200).json({ matches: comebacks });
  } catch (err) {
    console.error('[stats-gen/comeback-bench]', err);
    return res.status(500).json({ error: err.message });
  }
}
