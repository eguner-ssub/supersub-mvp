import { createClient } from '@supabase/supabase-js';
import { calculateResult, isFinished, isLive, isVoid } from '../scripts/settle.js';

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
          p_points: calcResult.points,
        });

        if (settleErr) {
          result.errors.push(`Settlement error for bet ${bet.id}: ${settleErr.message}`);
          continue;
        }

        result.settled++;
      }
    }

    return res.status(result.errors.length === 0 ? 200 : 207).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
