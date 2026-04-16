import { createClient } from '@supabase/supabase-js';
import { calculateResult, isFinished, isLive, isVoid } from '../../scripts/settle.js';
import { refreshLeaderboards } from '../../lib/leaderboard/refresh.js';
import { syncMatchIntel } from '../../scripts/sync-match-intel.js';
import { syncNewsIntel } from '../../scripts/sync-news-intel.js';
import { backfillUpcomingMatches } from '../../scripts/backfill-matches-full.js';

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Job: settle ──────────────────────────────────────────────────────────────
async function runSettle(supabase) {
  const result = { settled: 0, transitioned: 0, voided: 0, errors: [] };

  const { data: activeBets, error: betsErr } = await supabase
    .from('predictions')
    .select('*')
    .in('status', ['PENDING', 'LIVE']);

  if (betsErr) throw new Error(betsErr.message);

  if (!activeBets?.length) {
    return { ...result, message: 'No active bets' };
  }

  const matchIds = [...new Set(activeBets.map(b => b.match_id))];
  const { data: matches, error: matchErr } = await supabase
    .from('matches')
    .select('id, status, home_score, away_score, events')
    .in('id', matchIds);

  if (matchErr) throw new Error(matchErr.message);

  const matchMap = new Map((matches || []).map(m => [m.id, m]));

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
      const events = Array.isArray(match.events) ? match.events : [];
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

  return result;
}

// ── Job: sync-coaches ────────────────────────────────────────────────────────
async function runSyncCoaches(supabase) {
  const token = process.env.SPORTMONKS_API_TOKEN;
  if (!token) throw new Error('SPORTMONKS_API_TOKEN env var not configured');

  const { data: existingCoaches } = await supabase
    .from('coaches')
    .select('id, current_team_id');
  const existingMap = new Map((existingCoaches || []).map((c) => [c.id, c.current_team_id]));

  const allCoaches = [];
  let page = 1;

  while (true) {
    const url = new URL('https://api.sportmonks.com/v3/football/coaches/latest');
    url.searchParams.set('api_token', token);
    url.searchParams.set('include', 'teams');
    url.searchParams.set('page', String(page));

    const apiRes = await fetch(url.toString());
    if (!apiRes.ok) throw new Error(`Sportmonks ${apiRes.status} on /coaches/latest page ${page}`);
    const json = await apiRes.json();
    allCoaches.push(...(json.data || []));

    if (!json.pagination?.has_more) break;
    page++;
    await sleep(500);
  }

  if (allCoaches.length === 0) {
    return { ok: true, updated: 0, managerChanges: 0 };
  }

  const rows = [];
  const managerChanges = [];

  for (const coach of allCoaches) {
    const teams = coach.teams || [];
    const activeTeam =
      teams.find((t) => t.pivot?.active === true) ||
      teams.find((t) => t.active === true) ||
      teams[teams.length - 1] ||
      null;

    const newTeamId = activeTeam?.id ?? null;
    const oldTeamId = existingMap.get(coach.id);

    if (oldTeamId !== undefined && oldTeamId !== newTeamId) {
      managerChanges.push(`${coach.display_name || coach.name}: team ${oldTeamId} → ${newTeamId}`);
    }

    rows.push({
      id: coach.id,
      name: coach.name || coach.display_name || `Coach ${coach.id}`,
      common_name: coach.common_name ?? null,
      firstname: coach.firstname ?? null,
      lastname: coach.lastname ?? null,
      image_path: coach.image_path ?? null,
      nationality_id: coach.nationality_id ?? null,
      current_team_id: newTeamId,
      last_updated: new Date().toISOString(),
    });
  }

  const { error } = await supabase.from('coaches').upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`Coaches upsert failed: ${error.message}`);

  if (managerChanges.length > 0) {
    console.log('[sync-coaches] Manager changes:', managerChanges.join(', '));
  }

  return { ok: true, updated: rows.length, managerChanges: managerChanges.length };
}

// ── Job: refresh-leaderboards ────────────────────────────────────────────────
async function runRefreshLeaderboards(supabase) {
  const totalEntries = await refreshLeaderboards(supabase);
  return { ok: true, entries_written: totalEntries };
}

// ── Job: sync-match-intel ────────────────────────────────────────────────────
async function runSyncMatchIntel(supabase) {
  const refreshed = await syncMatchIntel(supabase);
  return { ok: true, refreshed };
}

// ── Job: sync-news-intel ─────────────────────────────────────────────────────
async function runSyncNewsIntel() {
  return await syncNewsIntel();
}

// ── Job: backfill-upcoming ───────────────────────────────────────────────────
// Keeps matches.lineup_confirmed / lineups / events / statistics fresh for
// fixtures in the next few days. LINEUP_CONFIRMED flips ~1h pre-kickoff, so an
// hourly run catches flips within ~30 min on average. Narrow date window keeps
// runtime under the serverless budget: 5 leagues × 1 request each, throttled
// at ~1 req/sec.
async function runBackfillUpcoming(supabase) {
  const daysAheadRaw = Number.parseInt(process.env.BACKFILL_UPCOMING_DAYS_AHEAD ?? '', 10);
  const daysAhead = Number.isFinite(daysAheadRaw) && daysAheadRaw > 0 ? daysAheadRaw : 3;
  return await backfillUpcomingMatches(supabase, { daysAhead });
}

// ── Job registry ─────────────────────────────────────────────────────────────
const JOBS = {
  'settle':               runSettle,
  'sync-coaches':         runSyncCoaches,
  'refresh-leaderboards': runRefreshLeaderboards,
  'sync-match-intel':     runSyncMatchIntel,
  'sync-news-intel':      runSyncNewsIntel,
  'backfill-upcoming':    runBackfillUpcoming,
};

/**
 * GET|POST /api/cron?job=<name>
 *
 * Unified cron endpoint. Dispatches to the correct job by ?job= param.
 * Protected by CRON_SECRET bearer token.
 *
 * GET is accepted so Vercel's native cron (vercel.json `crons[]`) can hit this
 * endpoint — Vercel always sends GET with an Authorization: Bearer header.
 * POST is kept for external triggers (cron-job.org, manual curl).
 *
 * Valid jobs: settle, sync-coaches, refresh-leaderboards, sync-match-intel,
 * sync-news-intel, backfill-upcoming
 */
export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'CRON_SECRET env var not configured' });
  }
  if (req.headers['authorization'] !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const jobName = req.query.job;
  const jobFn = JOBS[jobName];

  if (!jobFn) {
    return res.status(400).json({
      error: `Unknown job: ${jobName}`,
      validJobs: Object.keys(JOBS),
    });
  }

  try {
    const supabase = getSupabaseClient();
    const result = await jobFn(supabase);

    return res.status(200).json({
      job: jobName,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[cron/${jobName}] Fatal error:`, err.message);
    return res.status(500).json({ job: jobName, error: err.message });
  }
}
