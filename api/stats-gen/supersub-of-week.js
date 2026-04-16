// GET /api/stats-gen/supersub-of-week?league_id=X&gameweek=Y
// Best-performing substitute for the selected gameweek. Scoring formula
// per approved plan: goals×3 + (entry ≥ 70' ? 1 : 0). Assists dropped.
//
// gameweek is matched against matches.round_name ILIKE '%<value>%' so callers
// can pass either "28" or "Gameweek 28"; both match.

import { requireStatsGenToken, getSupabase } from '../../lib/statsGen/auth.js';
import { buildSubsOnMap, findSubGoalsAfterEntry } from '../../lib/statsGen/subsOnMap.js';

const TERMINAL = ['FT', 'AET', 'FT_PEN'];
const LATE_SUB_MINUTE = 70;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const leagueId = parseInt(req.query.league_id, 10);
  const gw       = String(req.query.gameweek ?? '').trim();
  if (!leagueId || !gw) return res.status(400).json({ error: 'league_id and gameweek are required' });

  const supabase = getSupabase();

  const { data: matches, error } = await supabase
    .from('matches')
    .select('id, home_team, away_team, home_team_id, away_team_id, home_score, away_score, lineups, events, round_name')
    .eq('league_id', leagueId)
    .ilike('round_name', `%${gw}%`)
    .in('status', TERMINAL);
  if (error) return res.status(500).json({ error: error.message });

  // Resolve player_name / team_name via match row (name cached on lineup entries)
  let best = null;

  for (const m of (matches || [])) {
    const events = Array.isArray(m.events) ? m.events : [];
    const lineups = Array.isArray(m.lineups) ? m.lineups : [];
    const nameById = new Map(lineups.map(l => [l.player_id, l.player_name]));

    const subsOn = buildSubsOnMap(events, null);
    const subGoals = findSubGoalsAfterEntry(events, subsOn);

    // Aggregate by scorer
    const byPlayer = new Map();
    for (const g of subGoals) {
      let agg = byPlayer.get(g.scorerId);
      if (!agg) {
        agg = { scorerId: g.scorerId, entryMinute: g.entryMinute, goals: 0, goalMinutes: [] };
        byPlayer.set(g.scorerId, agg);
      }
      agg.goals += 1;
      agg.goalMinutes.push(g.goalMinute);
    }

    for (const agg of byPlayer.values()) {
      const lateBonus = agg.entryMinute >= LATE_SUB_MINUTE ? 1 : 0;
      const score = agg.goals * 3 + lateBonus;

      // Resolve which team the scorer was on via any event for that player
      const subEvt = events.find(e => (e.type_id === 18 || e.type === 'subst') && (e.player_id === agg.scorerId || e.assist?.id === agg.scorerId));
      const teamId = subEvt?.participant_id ?? subEvt?.team?.id;
      const isHome = teamId === m.home_team_id;
      const teamName = isHome ? m.home_team : m.away_team;

      if (!best || score > best.score) {
        best = {
          score,
          player_id: agg.scorerId,
          player_name: nameById.get(agg.scorerId) || `Player ${agg.scorerId}`,
          team_id: teamId,
          team_name: teamName,
          entry_minute: agg.entryMinute,
          goals: agg.goals,
          minutes_played: 90 - agg.entryMinute,
          match_title: `${m.home_team} vs ${m.away_team}`,
          final_score: `${m.home_score}-${m.away_score}`,
          goal_minutes: agg.goalMinutes.sort((a, b) => a - b),
          fixture_id: m.id,
        };
      }
    }
  }

  return res.status(200).json({
    league_id: leagueId,
    gameweek: gw,
    matches_scanned: matches?.length ?? 0,
    top: best,
  });
}
