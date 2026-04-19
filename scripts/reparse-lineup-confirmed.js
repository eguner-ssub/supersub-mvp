#!/usr/bin/env node
// scripts/reparse-lineup-confirmed.js
// Usage: node scripts/reparse-lineup-confirmed.js
//
// One-off fix for matches whose raw_data.metadata already contains the
// Sportmonks LINEUP_CONFIRMED entry (type_id=572) but whose
// matches.lineup_confirmed column was never populated because the old
// parser matched on developer_name (which isn't present on the flat
// `include=metadata` shape Sportmonks returns).
//
// Re-parses stored raw_data.metadata with the corrected predicate
// (type_id===572 as primary, developer_name as fallback) and updates
// matches.lineup_confirmed accordingly. Zero Sportmonks API calls —
// pure SQL reads + targeted UPDATEs. Safe to re-run; it's idempotent.

import { createClient } from '@supabase/supabase-js';

const PREFIX = '[reparse-lineup-confirmed]';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

// Same predicate as the sync parsers. Matches type_id=572 primarily
// (works on flat `include=metadata` response), falls back to
// developer_name (works on nested `include=metadata.type` response).
function findLineupConfirmedEntry(metadata) {
  if (!Array.isArray(metadata)) return null;
  return metadata.find(m =>
    m?.type_id === 572 ||
    (m?.type?.developer_name ?? m?.developer_name) === 'LINEUP_CONFIRMED'
  ) || null;
}

async function run() {
  const supabase = getSupabase();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  console.log(`${PREFIX} Scanning upcoming matches in window ${now.toISOString().slice(0,10)} → ${windowEnd.toISOString().slice(0,10)}`);

  // PostgREST default row cap is 1000 — paginate defensively even though
  // the 14-day window fits comfortably under that today.
  const rows = [];
  const BATCH = 1000;
  for (let offset = 0; ; offset += BATCH) {
    const { data, error } = await supabase
      .from('matches')
      .select('id, home_team, away_team, kickoff_time, lineup_confirmed, raw_data')
      .gte('kickoff_time', now.toISOString())
      .lte('kickoff_time', windowEnd.toISOString())
      .order('kickoff_time', { ascending: true })
      .range(offset, offset + BATCH - 1);
    if (error) throw new Error(`select failed: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < BATCH) break;
  }

  console.log(`${PREFIX} Loaded ${rows.length} upcoming matches.`);

  let hasMetadata = 0;
  let noMetadata = 0;
  let flippedToTrue = 0;
  let flippedToFalse = 0;
  let unchanged = 0;
  let noEntry = 0;
  const failures = [];

  for (const m of rows) {
    const metadata = m.raw_data?.metadata;
    if (!Array.isArray(metadata)) {
      noMetadata++;
      continue;
    }
    hasMetadata++;

    const entry = findLineupConfirmedEntry(metadata);
    if (!entry) {
      noEntry++;
      continue;
    }

    const parsedValue = entry?.values?.confirmed;
    if (typeof parsedValue !== 'boolean') {
      noEntry++;
      continue;
    }

    const current = !!m.lineup_confirmed;
    if (current === parsedValue) {
      unchanged++;
      continue;
    }

    const { error } = await supabase
      .from('matches')
      .update({ lineup_confirmed: parsedValue })
      .eq('id', m.id);

    if (error) {
      failures.push({ id: m.id, team: `${m.home_team} v ${m.away_team}`, error: error.message });
      continue;
    }

    if (parsedValue) flippedToTrue++; else flippedToFalse++;
    console.log(`${PREFIX}   ${m.id}  ${m.home_team} v ${m.away_team}: ${current} → ${parsedValue}`);
  }

  console.log(`${PREFIX}`);
  console.log(`${PREFIX} ─── Summary ───────────────────────────────`);
  console.log(`${PREFIX}   Upcoming matches scanned   : ${rows.length}`);
  console.log(`${PREFIX}   With raw_data.metadata     : ${hasMetadata}`);
  console.log(`${PREFIX}   Without raw_data.metadata  : ${noMetadata}  (need full backfill)`);
  console.log(`${PREFIX}   No LINEUP_CONFIRMED entry  : ${noEntry}  (metadata present but no type_id=572 entry)`);
  console.log(`${PREFIX}   Flipped false → true       : ${flippedToTrue}`);
  console.log(`${PREFIX}   Flipped true → false       : ${flippedToFalse}`);
  console.log(`${PREFIX}   Unchanged (already correct): ${unchanged}`);
  console.log(`${PREFIX}   Failures                   : ${failures.length}`);
  console.log(`${PREFIX} ────────────────────────────────────────────`);

  if (failures.length > 0) {
    console.log(`${PREFIX} Failures detail:`);
    for (const f of failures) console.log(`${PREFIX}   ${f.id} ${f.team}: ${f.error}`);
    process.exit(1);
  }
}

const isMain = process.argv[1]?.endsWith('reparse-lineup-confirmed.js');
if (isMain) {
  const { default: dotenv } = await import('dotenv');
  dotenv.config();
  dotenv.config({ path: '.env.local', override: false });
  run().catch(err => {
    console.error(`${PREFIX} Fatal:`, err);
    process.exit(1);
  });
}

export { run, findLineupConfirmedEntry };
