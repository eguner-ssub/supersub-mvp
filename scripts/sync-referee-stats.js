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

// ── Env + lazy Supabase ──────────────────────────────────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
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
  console.log(`${PREFIX} Loading core/types...`);
  const typeMap = await loadTypeMap();
  const isYellow = makeMatcher(typeMap, 'YELLOWCARD');
  const isRed    = makeMatcher(typeMap, 'REDCARD');
  const isPen    = makeMatcher(typeMap, 'PENALTY');
  console.log(`${PREFIX}   YELLOWCARD=${typeMap.get('YELLOWCARD')}  REDCARD=${typeMap.get('REDCARD')}  PENALTY=${typeMap.get('PENALTY')}  REFEREE=${typeMap.get('REFEREE')}`);

  console.log(`${PREFIX} Fetching completed matches...`);
  const { data: matches, error } = await supabase
    .from('matches')
    .select('id, league_id, home_score, away_score, events, raw_data, kickoff_time, date, home_team, away_team')
    .in('status', ['FT', 'AET', 'FT_PEN'])
    .not('raw_data', 'is', null);

  if (error) throw error;
  console.log(`${PREFIX}   loaded ${matches?.length ?? 0} completed matches with raw_data`);

  // Aggregate into buckets keyed by (referee_id, season_id, league_id).
  const buckets = new Map(); // key → row-in-progress

  let skippedNoRef = 0;
  let skippedNoSeason = 0;

  for (const m of (matches || [])) {
    const referees = Array.isArray(m.raw_data?.referees) ? m.raw_data.referees : [];
    const head = referees.find(r => r?.type?.developer_name === 'REFEREE');
    if (!head) { skippedNoRef++; continue; }

    const refId   = head.id ?? head.referee_id;
    const refName = head.fullname || head.name || head.common_name || `Referee ${refId}`;
    if (!refId) { skippedNoRef++; continue; }

    const seasonSmId = await resolveSeasonSmId(supabase, m.league_id);
    if (!seasonSmId) { skippedNoSeason++; continue; }

    const key = `${refId}|${seasonSmId}|${m.league_id}`;
    let row = buckets.get(key);
    if (!row) {
      row = {
        referee_id: refId,
        referee_name: refName,
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

  // Finalise rows: last-5 recent_fixtures + last_synced_at
  const nowIso = new Date().toISOString();
  const rows = [...buckets.values()].map(r => {
    const sorted = r._fixtures
      .sort((a, b) => new Date(b.kickoff_time).getTime() - new Date(a.kickoff_time).getTime())
      .slice(0, 5)
      .map(({ kickoff_time, ...rest }) => rest);
    const { _fixtures, ...clean } = r;
    return { ...clean, recent_fixtures: sorted, last_synced_at: nowIso };
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
