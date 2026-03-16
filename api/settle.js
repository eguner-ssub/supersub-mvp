import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ── Status classifications (mirrored from scripts/settle.js) ─────────────────
const FINAL_STATUSES = ['FT', 'AET', 'FT_PEN'];
const LIVE_STATUSES  = ['INPLAY_1ST_HALF', 'INPLAY_2ND_HALF', 'INPLAY_ET', 'INPLAY_ET_SECOND_HALF', 'INPLAY_PENALTIES', 'HT', 'BREAK', 'EXTRA_TIME_BREAK'];
const VOID_STATUSES  = ['POSTPONED', 'CANCELLED', 'ABANDONED', 'SUSPENDED', 'AWARDED', 'WO'];

const isFinished = (s) => FINAL_STATUSES.includes(s);
const isLive     = (s) => LIVE_STATUSES.includes(s);
const isVoid     = (s) => VOID_STATUSES.includes(s);

const normalizeName = (name) =>
  String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^score_/, '')
    .replace(/[^a-z]/g, '');

function settleSupersub(bet, events) {
  const teamId = bet.team_id;
  if (teamId == null) return { status: 'LOST', points: 0 };

  const subsOnMap = new Map();
  for (const event of events) {
    const isSub            = event.type_id === 18 || event.type === 'subst';
    const isBackedTeam     = event.participant_id === teamId || event.team?.id === teamId;
    const incomingPlayerId = event.player_id || event.assist?.id;
    if (isSub && isBackedTeam && incomingPlayerId != null) {
      subsOnMap.set(incomingPlayerId, event.minute || event.time?.elapsed || 0);
    }
  }

  if (subsOnMap.size === 0) return { status: 'LOST', points: 0 };

  for (const event of events) {
    const isGoal       = event.type_id === 14 || event.type_id === 97 || event.type === 'Goal';
    const isBackedTeam = event.participant_id === teamId || event.team?.id === teamId;
    const time         = event.minute || event.time?.elapsed || 0;
    if (isGoal && isBackedTeam && time <= 120) {
      const scorerId  = event.player_id || event.player?.id;
      const subOnTime = scorerId != null ? subsOnMap.get(scorerId) : undefined;
      if (subOnTime !== undefined && time >= subOnTime) {
        return { status: 'WON', points: 500 };
      }
    }
  }

  return { status: 'LOST', points: 0 };
}

function calculateResult(bet, match, events = []) {
  if (!isFinished(match.status)) return { status: 'PENDING', points: 0 };

  const type       = bet.card_type.toLowerCase();
  const selection  = bet.selection;
  const homeGoals  = match.home_score || 0;
  const awayGoals  = match.away_score || 0;
  const oddsPoints = Math.round((bet.odds || 0) * 100);

  if (type.includes('match_result')) {
    let outcome = 'DRAW';
    if (homeGoals > awayGoals)      outcome = 'HOME_WIN';
    else if (awayGoals > homeGoals) outcome = 'AWAY_WIN';
    const won = selection === outcome;
    return { status: won ? 'WON' : 'LOST', points: won ? oddsPoints : 0 };
  }

  if (type.includes('total_goals')) {
    const won = (selection.includes('OVER')) === (homeGoals + awayGoals > 2.5);
    return { status: won ? 'WON' : 'LOST', points: won ? oddsPoints : 0 };
  }

  if (type.includes('player_score')) {
    const betPlayerName = normalizeName(bet.selection);
    if (!betPlayerName) return { status: 'LOST', points: 0 };
    const didScore = events.some(e => {
      const isGoal     = e.type_id === 14 || e.type_id === 97 || e.type === 'Goal';
      const scorerName = normalizeName(e.player_name || e.player?.name);
      const time       = e.minute || e.time?.elapsed || 0;
      return isGoal && scorerName === betPlayerName && time <= 90;
    });
    return { status: didScore ? 'WON' : 'LOST', points: didScore ? oddsPoints : 0 };
  }

  if (type.includes('supersub')) return settleSupersub(bet, events);

  return { status: 'LOST', points: 0 };
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

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Only allow POST (cron-job.org sends POST by default)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify the shared secret so only cron-job.org can trigger this
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'CRON_SECRET env var not configured' });
  }
  if (req.headers['authorization'] !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const supabase = getSupabaseClient();
    const result   = { settled: 0, transitioned: 0, voided: 0, errors: [] };

    // 1. Fetch all open bets
    const { data: activeBets, error: betsErr } = await supabase
      .from('predictions')
      .select('*')
      .in('status', ['PENDING', 'LIVE']);

    if (betsErr) {
      return res.status(500).json({ error: betsErr.message });
    }

    if (!activeBets?.length) {
      return res.status(200).json({ ...result, message: 'No active bets' });
    }

    // 2. Fetch the relevant matches in one query
    const matchIds = [...new Set(activeBets.map(b => b.match_id))];
    const { data: matches, error: matchErr } = await supabase
      .from('matches')
      .select('id, status, home_score, away_score, events')
      .in('id', matchIds);

    if (matchErr) {
      return res.status(500).json({ error: matchErr.message });
    }

    const matchMap = new Map((matches || []).map(m => [m.id, m]));

    // 3. Process each bet
    for (const bet of activeBets) {
      const match = matchMap.get(bet.match_id);
      if (!match) continue;

      if (isVoid(match.status)) {
        const { error } = await supabase.rpc('settle_prediction', {
          p_prediction_id: bet.id,
          p_new_status: 'LOST',
        });
        if (error) result.errors.push(`Void error for bet ${bet.id}: ${error.message}`);
        else result.voided++;
        continue;
      }

      if (bet.status === 'PENDING' && isLive(match.status)) {
        const { error } = await supabase
          .from('predictions')
          .update({ status: 'LIVE' })
          .eq('id', bet.id);
        if (error) result.errors.push(`LIVE transition error for bet ${bet.id}: ${error.message}`);
        else result.transitioned++;
        continue;
      }

      if (isFinished(match.status)) {
        const events     = Array.isArray(match.events) ? match.events : [];
        const calcResult = calculateResult(bet, match, events);

        const { error: settleErr } = await supabase.rpc('settle_prediction', {
          p_prediction_id: bet.id,
          p_new_status: calcResult.status,
        });

        if (settleErr) {
          result.errors.push(`Settlement error for bet ${bet.id}: ${settleErr.message}`);
          continue;
        }

        if (calcResult.points > 0) {
          await supabase
            .from('predictions')
            .update({ points_awarded: calcResult.points })
            .eq('id', bet.id);
        }

        result.settled++;
      }
    }

    return res.status(result.errors.length === 0 ? 200 : 207).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
