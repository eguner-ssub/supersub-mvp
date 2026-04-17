// GET /api/stats-gen/supersub-of-week?league_id=X&gameweek=Y
// Best-performing sub player for the specified gameweek.
// Scoring: goals*2 + assists. Match score before/after the sub's impact.

import { requireStatsGenToken, getSupabase } from '../auth.js';
import { resolveLeagueContext } from '../resolveSeason.js';
import { buildSubsOnMap } from '../subsOnMap.js';

const TERMINAL = ['FT', 'AET', 'FT_PEN'];

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  const leagueId = parseInt(req.query.league_id, 10);
  const gw       = req.query.gameweek?.trim();
  if (!leagueId || !gw) return res.status(400).json({ error: 'league_id and gameweek required' });

  try {
    const supabase = getSupabase();
    const ctx = await resolveLeagueContext(supabase, leagueId);

    const { data: matches, error } = await supabase
      .from('matches')
      .select('id, home_team, away_team, home_team_id, away_team_id, home_score, away_score, lineups, events')
      .eq('league_id', leagueId)
      .ilike('round_name', `%${gw}%`)
      .in('status', TERMINAL);
    if (error) throw error;

    let best = null;

    for (const m of (matches || [])) {
      const events = Array.isArray(m.events) ? m.events : [];
      const lineups = Array.isArray(m.lineups) ? m.lineups : [];
      const nameById = new Map(lineups.map(l => [l.player_id, l.player_name]));
      const subsOn = buildSubsOnMap(events, null);

      const goals = events
        .filter(e => e.type_id === 14 || e.type_id === 97 || e.type === 'Goal')
        .sort((a, b) => (a.minute ?? a.time?.elapsed ?? 0) - (b.minute ?? b.time?.elapsed ?? 0));

      for (const [subPlayerId, entryMinute] of subsOn) {
        let subGoals = 0, subAssists = 0, firstImpactMinute = null;

        const subEvt = events.find(e => (e.type_id === 18 || e.type === 'subst') && (e.player_id === subPlayerId || e.assist?.id === subPlayerId));
        const teamId = subEvt?.participant_id ?? subEvt?.team?.id;

        for (const g of goals) {
          const gMin = g.minute ?? g.time?.elapsed ?? 0;
          if (gMin < entryMinute || gMin > 120) continue;
          const scorerId = Number(g.player_id ?? g.player?.id);
          const assistId = Number(g.assist?.id ?? 0);
          if (scorerId === subPlayerId) { subGoals++; if (firstImpactMinute === null) firstImpactMinute = gMin; }
          if (assistId === subPlayerId) { subAssists++; if (firstImpactMinute === null) firstImpactMinute = gMin; }
        }

        if (subGoals === 0 && subAssists === 0) continue;
        const score = subGoals * 2 + subAssists;

        let hBefore = 0, aBefore = 0;
        if (firstImpactMinute != null) {
          for (const g of goals) {
            const gm = g.minute ?? g.time?.elapsed ?? 0;
            if (gm < firstImpactMinute) {
              if ((g.participant_id ?? g.team?.id) === m.home_team_id) hBefore++;
              else aBefore++;
            }
          }
        }

        const isHome = teamId === m.home_team_id;

        if (!best || score > best._score) {
          best = {
            _score: score,
            _teamSmId: teamId,
            gameweek: gw,
            player_id: subPlayerId,
            player_name: nameById.get(subPlayerId) || `Player ${subPlayerId}`,
            team_name: isHome ? m.home_team : m.away_team,
            team_badge_url: null,
            goals: subGoals,
            assists: subAssists,
            entry_minute: entryMinute,
            match_title: `${m.home_team} vs ${m.away_team}`,
            match_score_before: `${hBefore}-${aBefore}`,
            match_score_after: `${m.home_score ?? 0}-${m.away_score ?? 0}`,
            opponent: isHome ? m.away_team : m.home_team,
          };
        }
      }
    }

    if (best?._teamSmId) {
      const { data: team } = await supabase.from('teams').select('logo_url').eq('sportmonks_id', best._teamSmId).maybeSingle();
      best.team_badge_url = team?.logo_url || null;
      delete best._teamSmId;
      delete best._score;
    }

    return res.status(200).json(best || {
      gameweek: gw,
      player_id: null,
      player_name: null,
      message: 'No sub scored or assisted in this gameweek',
    });
  } catch (err) {
    console.error('[stats-gen/supersub-of-week]', err);
    return res.status(500).json({ error: err.message });
  }
}
