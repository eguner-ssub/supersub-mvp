#!/usr/bin/env node
// scripts/backfill-referee-data.js
// Usage:
//   node scripts/backfill-referee-data.js              # all leagues, all pending matches
//   node scripts/backfill-referee-data.js --league 8   # EPL only
//   node scripts/backfill-referee-data.js --limit 50   # cap for smoke testing
//
// One-shot backfill: for every completed match whose raw_data lacks a
// referees array (because it was synced before sync-scores added the
// `referees` include), fetch /v3/football/fixtures/{id}?include=referees,
// merge the referees key into raw_data, and write it back.
//
// Rate-limited to 1 request / 1100 ms — matches the throttle used by
// sync-match-intel.js so we stay well under Sportmonks' per-minute limits.
// Safe to re-run: rows that already have raw_data.referees are skipped.
//
// After this finishes, run `npm run sync:referees` to turn the freshly
// populated raw_data into referee_stats aggregates.

import { createClient } from '@supabase/supabase-js';

const PREFIX = '[backfill-referee-data]';
const RATE_LIMIT_MS = 1100;
const TERMINAL = ['FT', 'AET', 'FT_PEN'];

// ── CLI args ─────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = { league: null, limit: null, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--league' && argv[i + 1]) { out.league = parseInt(argv[++i], 10); }
    else if (a === '--limit' && argv[i + 1]) { out.limit = parseInt(argv[++i], 10); }
    else if (a === '--dry-run') { out.dryRun = true; }
  }
  return out;
}

// ── Env + lazy Supabase ──────────────────────────────────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

// ── Rate limiter (shared state) ──────────────────────────────────────────────
let lastRequestAt = 0;
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function throttle() {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < RATE_LIMIT_MS) await sleep(RATE_LIMIT_MS - elapsed);
  lastRequestAt = Date.now();
}

// ── Sportmonks fetch with retry on 429 ───────────────────────────────────────
async function fetchReferees(fixtureId, token) {
  await throttle();
  const url = `https://api.sportmonks.com/v3/football/fixtures/${fixtureId}?api_token=${token}&include=referees`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('retry-after') || '5', 10);
      console.warn(`${PREFIX}   429 on fixture ${fixtureId}; sleeping ${retryAfter}s`);
      await sleep(retryAfter * 1000);
      continue;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`${res.status} ${res.statusText} — ${body.slice(0, 200)}`);
    }
    const json = await res.json();
    return json.data?.referees ?? [];
  }
  throw new Error('Retried 3x on 429');
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function run(opts) {
  const supabase = getSupabase();
  const token = process.env.SPORTMONKS_API_TOKEN;
  if (!token) throw new Error('Missing SPORTMONKS_API_TOKEN');

  // Select every completed match with raw_data but no referees yet.
  // We can't easily filter "raw_data.referees IS NULL" server-side across
  // all PostgREST versions, so we fetch the IDs + a tiny raw_data shape
  // check and filter in JS. Select is narrow to keep the response small.
  let query = supabase
    .from('matches')
    .select('id, league_id, home_team, away_team, raw_data, kickoff_time')
    .in('status', TERMINAL)
    .not('raw_data', 'is', null)
    .order('kickoff_time', { ascending: false });

  if (opts.league) query = query.eq('league_id', opts.league);

  const { data: rows, error } = await query;
  if (error) throw error;

  const pending = (rows || []).filter(m => {
    const r = m.raw_data;
    return !r || !Array.isArray(r.referees);
  });

  const toProcess = opts.limit ? pending.slice(0, opts.limit) : pending;

  console.log(`${PREFIX} Scan: ${rows?.length ?? 0} completed matches${opts.league ? ` for league ${opts.league}` : ''}, ${pending.length} need backfill${opts.limit ? ` (capped to ${toProcess.length})` : ''}.`);
  if (toProcess.length === 0) { console.log(`${PREFIX} Nothing to do.`); return; }

  const estSec = Math.round((toProcess.length * RATE_LIMIT_MS) / 1000);
  console.log(`${PREFIX} Estimated wall-time: ~${Math.floor(estSec / 60)}m ${estSec % 60}s (at ${RATE_LIMIT_MS}ms/request).`);
  if (opts.dryRun) { console.log(`${PREFIX} Dry run — exiting before any calls.`); return; }

  let succeeded = 0;
  let failed = 0;
  let noReferees = 0;
  const started = Date.now();

  for (let i = 0; i < toProcess.length; i++) {
    const m = toProcess[i];
    const label = `${m.id} ${m.home_team} v ${m.away_team}`;
    try {
      const referees = await fetchReferees(m.id, token);
      const mergedRaw = { ...m.raw_data, referees };
      const { error: upErr } = await supabase
        .from('matches')
        .update({ raw_data: mergedRaw })
        .eq('id', m.id);
      if (upErr) throw upErr;

      if (referees.length === 0) noReferees++;
      succeeded++;
    } catch (err) {
      failed++;
      console.warn(`${PREFIX}   ✗ ${label}: ${err.message}`);
    }

    // Progress every 50 or at the end
    if ((i + 1) % 50 === 0 || i === toProcess.length - 1) {
      const pct = Math.round(((i + 1) / toProcess.length) * 100);
      const elapsedSec = Math.round((Date.now() - started) / 1000);
      console.log(`${PREFIX}   progress: ${i + 1}/${toProcess.length} (${pct}%)  ok=${succeeded}  fail=${failed}  noref=${noReferees}  elapsed=${Math.floor(elapsedSec/60)}m${elapsedSec%60}s`);
    }
  }

  const totalSec = Math.round((Date.now() - started) / 1000);
  console.log(`${PREFIX}`);
  console.log(`${PREFIX} ─── Summary ───────────────────────────────`);
  console.log(`${PREFIX}   Processed         : ${toProcess.length}`);
  console.log(`${PREFIX}   Succeeded         : ${succeeded}`);
  console.log(`${PREFIX}   Failed            : ${failed}`);
  console.log(`${PREFIX}   Merged empty[]    : ${noReferees} (Sportmonks had no referee assigned)`);
  console.log(`${PREFIX}   Wall time         : ${Math.floor(totalSec/60)}m ${totalSec%60}s`);
  console.log(`${PREFIX} ────────────────────────────────────────────`);
  console.log(`${PREFIX} Next step: npm run sync:referees`);
}

// ── CLI entry point ──────────────────────────────────────────────────────────
const isMain = process.argv[1]?.endsWith('backfill-referee-data.js');
if (isMain) {
  const { default: dotenv } = await import('dotenv');
  dotenv.config();
  dotenv.config({ path: '.env.local', override: false });
  run(parseArgs(process.argv)).catch(err => {
    console.error(`${PREFIX} Fatal:`, err);
    process.exit(1);
  });
}

export { run };
