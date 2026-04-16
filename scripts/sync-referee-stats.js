#!/usr/bin/env node
// scripts/sync-referee-stats.js
// Usage: node scripts/sync-referee-stats.js
// Cron:  weekly (manual / operator-triggered).
//
// Aggregates per-referee stats from whatever has already flowed into the
// matches table — it does NOT make new Sportmonks fixture calls for
// historical data. The one network call it does make is a single paginated
// fetch of /v3/core/types so we can map the card/penalty event type_ids
// without hard-coding them (Sportmonks has renumbered these in the past).
//
// A referee row appears in matches.raw_data.referees only when the pre-live
// /fixtures/{id} call includes `referees` — that's handled by sync-scores.
// Historical rows without the include stay empty and get skipped here.

import { createClient } from '@supabase/supabase-js';
import { resolveSeasonSmId } from '../lib/statsGen/resolveSeason.js';

const PREFIX = '[sync-referee-stats]';
const RATE_LIMIT_MS = 1100;

// ── Env + lazy Supabase ──────────────────────────────────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

// ── Referee name resolver (one Sportmonks call per unique referee) ──────────
// The `referees` include on fixtures returns a flattened pivot row
//   { id: <pivot id>, type_id, fixture_id, referee_id }
// with NO name. Names live on /v3/football/referees/{id} — we only hit it
// once per unique referee_id, rate-limited, with a fallback to "Referee {id}".
let lastReqAt = 0;
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function throttle() {
  const gap = Date.now() - lastReqAt;
  if (gap < RATE_LIMIT_MS) await sleep(RATE_LIMIT_MS - gap);
  lastReqAt = Date.now();
}
async function fetchRefereeName(id, token) {
  await throttle();
  try {
    const res = await fetch(`https://api.sportmonks.com/v3/football/referees/${id}?api_token=${token}`);
    if (!res.ok) return `Referee ${id}`;
    const j = await res.json();
    const r = j.data || {};
    return r.fullname || r.common_name || r.name || `Referee ${id}`;
  } catch {
    return `Referee ${id}`;
  }
}

// ── Core-types lookup ────────────────────────────────────────────────────────
// Builds { developer_name → type_id } for every type Sportmonks ships.
// Paginated — Sportmonks returns 250/page by default.
async function loadTypeMap() {
  const token = process.env.SPORTMONKS_API_TOKEN;
  if (!token) throw new Error('Missing SPORTMONKS_API_TOKEN');

  const map = new Map();
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`https://api.sportmonks.com/v3/core/types?api_token=${token}&per_page=500&page=${page}`);
    if (!res.ok) throw new Error(`core/types page ${page}: ${res.status}`);
    const json = await res.json();
    for (const t of (json.data || [])) {
      if (t.developer_name) map.set(t.developer_name, t.id);
    }
    if (!json.pagination?.has_more) break;
  }
  return map;
}

// ── Event classifiers ────────────────────────────────────────────────────────
// Events in matches.events are Sportmonks v3 shape: typically carry a
// numeric type_id. We also tolerate the legacy/nested { type: { developer_name } }
// shape in case any historical rows stored it that way.
function makeMatcher(typeMap, developerName) {
  const targetId = typeMap.get(developerName) ?? null;
  return (event) => {
    if (!event) return false;
    if (targetId != null && event.type_id === targetId) return true;
    if (event.type?.developer_name === developerName) return true;
    return false;
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  const supabase = getSupabase();
  const token = process.env.SPORTMONKS_API_TOKEN;
  if (!token) throw new Error('Missing SPORTMONKS_API_TOKEN');

  console.log(`${PREFIX} Loading core/types...`);
  const typeMap = await loadTypeMap();
  const isYellow = makeMatcher(typeMap, 'YELLOWCARD');
  const isRed    = makeMatcher(typeMap, 'REDCARD');
  const isPen    = makeMatcher(typeMap, 'PENALTY');
  const refTypeId = typeMap.get('REFEREE');
  console.log(`${PREFIX}   YELLOWCARD=${typeMap.get('YELLOWCARD')}  REDCARD=${typeMap.get('REDCARD')}  PENALTY=${typeMap.get('PENALTY')}  REFEREE=${refTypeId}`);

  console.log(`${PREFIX} Fetching completed matches...`);
  const { data: matches, error } = await supabase
    .from('matches')
    .select('id, league_id, home_score, away_score, events, raw_data, kickoff_time, date, home_team, away_team')
    .in('status', ['FT', 'AET', 'FT_PEN'])
    .not('raw_data', 'is', null);

  if (error) throw error;
  console.log(`${PREFIX}   loaded ${matches?.length ?? 0} completed matches with raw_data`);

  // Aggregate into buckets keyed by (referee_id, season_id, league_id).
  // Sportmonks `referees` include is a pivot: each row has fixture_id +
  // referee_id + type_id (6 = head referee). No name on the pivot row —
  // resolved later in one pass via /v3/football/referees/{id}.
  const buckets = new Map(); // key → row-in-progress

  let skippedNoRef = 0;
  let skippedNoSeason = 0;

  for (const m of (matches || [])) {
    const referees = Array.isArray(m.raw_data?.referees) ? m.raw_data.referees : [];
    const head = referees.find(r => r?.type_id === refTypeId);
    if (!head?.referee_id) { skippedNoRef++; continue; }

    const refId = head.referee_id;

    const seasonSmId = await resolveSeasonSmId(supabase, m.league_id);
    if (!seasonSmId) { skippedNoSeason++; continue; }

    const key = `${refId}|${seasonSmId}|${m.league_id}`;
    let row = buckets.get(key);
    if (!row) {
      row = {
        referee_id: refId,
        referee_name: null, // filled in one pass after aggregation
        season_id: seasonSmId,
        league_id: m.league_id,
        matches_officiated: 0,
        total_goals: 0,
        total_yellow_cards: 0,
        total_red_cards: 0,
        total_penalties: 0,
        over_2_5_count: 0,
        _fixtures: [], // collected, later sliced to last 5
      };
      buckets.set(key, row);
    }

    const events = Array.isArray(m.events) ? m.events : [];
    const yellows = events.filter(isYellow).length;
    const reds    = events.filter(isRed).length;
    const pens    = events.filter(isPen).length;
    const goals   = (m.home_score ?? 0) + (m.away_score ?? 0);

    row.matches_officiated += 1;
    row.total_goals        += goals;
    row.total_yellow_cards += yellows;
    row.total_red_cards    += reds;
    row.total_penalties    += pens;
    if (goals > 2.5) row.over_2_5_count += 1;

    row._fixtures.push({
      fixture_id: m.id,
      date: m.date || m.kickoff_time,
      home: m.home_team,
      away: m.away_team,
      score: `${m.home_score ?? 0}-${m.away_score ?? 0}`,
      kickoff_time: m.kickoff_time,
    });
  }

  console.log(`${PREFIX}   aggregated ${buckets.size} (referee, season, league) rows`);
  if (skippedNoRef)    console.log(`${PREFIX}   skipped ${skippedNoRef} matches without a referee in raw_data`);
  if (skippedNoSeason) console.log(`${PREFIX}   skipped ${skippedNoSeason} matches with unresolved season`);

  // Resolve referee names — one call per unique referee_id across all buckets.
  // Sportmonks pivot rows don't carry names; /v3/football/referees/{id} does.
  // Rate-limited to 1 req / 1100 ms to stay clear of the per-minute cap.
  const uniqueRefIds = [...new Set([...buckets.values()].map(b => b.referee_id))];
  console.log(`${PREFIX} Resolving ${uniqueRefIds.length} unique referee name(s) ~${Math.ceil(uniqueRefIds.length * RATE_LIMIT_MS / 1000)}s ...`);
  const nameById = new Map();
  for (let i = 0; i < uniqueRefIds.length; i++) {
    const rid = uniqueRefIds[i];
    nameById.set(rid, await fetchRefereeName(rid, token));
    if ((i + 1) % 20 === 0 || i === uniqueRefIds.length - 1) {
      console.log(`${PREFIX}   names: ${i + 1}/${uniqueRefIds.length}`);
    }
  }

  // Finalise rows: last-5 recent_fixtures + name + last_synced_at
  const nowIso = new Date().toISOString();
  const rows = [...buckets.values()].map(r => {
    const sorted = r._fixtures
      .sort((a, b) => new Date(b.kickoff_time).getTime() - new Date(a.kickoff_time).getTime())
      .slice(0, 5)
      .map(({ kickoff_time, ...rest }) => rest);
    const { _fixtures, ...clean } = r;
    return {
      ...clean,
      referee_name: nameById.get(r.referee_id) || `Referee ${r.referee_id}`,
      recent_fixtures: sorted,
      last_synced_at: nowIso,
    };
  });

  if (rows.length === 0) {
    console.log(`${PREFIX} Nothing to upsert.`);
    return;
  }

  // Upsert in batches to stay under PostgREST size limits
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error: upErr } = await supabase
      .from('referee_stats')
      .upsert(batch, { onConflict: 'referee_id,season_id,league_id' });
    if (upErr) throw new Error(`Upsert failed at batch ${i}: ${upErr.message}`);
  }
  console.log(`${PREFIX} Upserted ${rows.length} rows. Done.`);
}

// ── CLI entry point ──────────────────────────────────────────────────────────
const isMain = process.argv[1]?.endsWith('sync-referee-stats.js');
if (isMain) {
  const { default: dotenv } = await import('dotenv');
  dotenv.config();
  dotenv.config({ path: '.env.local', override: false });
  run().catch(err => {
    console.error(`${PREFIX} Fatal:`, err);
    process.exit(1);
  });
}

export { run };
