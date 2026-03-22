#!/usr/bin/env node
// scripts/backfill-round-names.js
// Fetches round names from Sportmonks and populates matches.round_name.
//
// Strategy:
//   1. Fetch round list from Sportmonks for each league's current season
//   2. Read (sportmonks_id, round) pairs from the local `fixtures` table
//      (fixtures.sportmonks_id === matches.id, fixtures.round = round_id string)
//   3. Update matches.round_name WHERE matches.id = fixture.sportmonks_id
//
// Usage: node scripts/backfill-round-names.js

import { createClient } from '@supabase/supabase-js';
import { request } from '../lib/sportmonks.js';

const PREFIX = '[backfill-round-names]';
const RATE_LIMIT_MS = 1200;

// ── Dotenv for standalone CLI runs ─────────────────────────────────────────
const isMain = process.argv[1]?.endsWith('backfill-round-names.js');
if (isMain) {
  const { default: dotenv } = await import('dotenv');
  dotenv.config();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

export async function backfillRoundNames() {
  const supabase = getSupabase();

  // 1. Load current seasons for all tracked leagues
  // Explicit FK name avoids "more than one relationship" ambiguity
  // (seasons.league_id → leagues.id  AND  leagues.current_season_id → seasons.id)
  const { data: seasons, error: seasonsErr } = await supabase
    .from('seasons')
    .select('id, sportmonks_id, leagues!seasons_league_id_fkey(sportmonks_id, name)')
    .eq('is_current', true);

  if (seasonsErr) throw new Error(`Failed to load seasons: ${seasonsErr.message}`);
  if (!seasons?.length) {
    console.log(`${PREFIX} No current seasons found.`);
    return { totalUpdated: 0 };
  }

  console.log(`${PREFIX} Found ${seasons.length} current seasons to process`);

  let totalRounds = 0;
  let totalUpdated = 0;

  for (const season of seasons) {
    const leagueName = season.leagues.name;
    const seasonSmId = season.sportmonks_id;  // Sportmonks integer season ID
    const seasonUuid = season.id;             // Our UUID for the season

    console.log(`${PREFIX} Fetching rounds for ${leagueName} (season ${seasonSmId})…`);

    try {
      // 2. Fetch round names from Sportmonks
      const resp = await request(`/rounds/seasons/${seasonSmId}`, { per_page: 200 });
      const rounds = resp.data || [];
      totalRounds += rounds.length;
      console.log(`${PREFIX}   ${rounds.length} rounds from Sportmonks`);

      if (!rounds.length) {
        await sleep(RATE_LIMIT_MS);
        continue;
      }

      // Build map: Sportmonks round_id (integer) → human-readable name
      const roundMap = new Map(rounds.map(r => [r.id, r.name]));

      // 3. Load fixtures for this season from our local DB
      //    fixtures.round stores the Sportmonks round_id as a string
      //    fixtures.sportmonks_id is the Sportmonks fixture ID = matches.id
      const { data: dbFixtures, error: fErr } = await supabase
        .from('fixtures')
        .select('sportmonks_id, round')
        .eq('season_id', seasonUuid)
        .not('round', 'is', null);

      if (fErr) {
        console.warn(`${PREFIX}   ✗ Could not load fixtures: ${fErr.message}`);
        await sleep(RATE_LIMIT_MS);
        continue;
      }

      console.log(`${PREFIX}   ${dbFixtures?.length || 0} fixtures in local DB`);

      if (!dbFixtures?.length) {
        console.log(`${PREFIX}   ⚠ No fixtures in DB for this season — skipping`);
        await sleep(RATE_LIMIT_MS);
        continue;
      }

      // 4. Update matches.round_name for each fixture
      //    matches.id (integer) === fixtures.sportmonks_id (integer)
      let updated = 0;
      for (const f of dbFixtures) {
        const roundId = parseInt(f.round, 10);
        const roundName = roundMap.get(roundId);
        if (!roundName) continue;

        const { count } = await supabase
          .from('matches')
          .update({ round_name: roundName }, { count: 'exact' })
          .eq('id', f.sportmonks_id);

        updated += count || 0;
      }

      totalUpdated += updated;
      console.log(`${PREFIX}   ✓ ${leagueName}: ${updated} matches updated with round names`);
      await sleep(RATE_LIMIT_MS);

    } catch (err) {
      console.error(`${PREFIX} ✗ Error for ${leagueName}: ${err.message}`);
      await sleep(RATE_LIMIT_MS);
    }
  }

  console.log(`${PREFIX} ─── Summary ────────────────────────────`);
  console.log(`${PREFIX}   Rounds fetched : ${totalRounds}`);
  console.log(`${PREFIX}   Matches updated: ${totalUpdated}`);
  console.log(`${PREFIX} ────────────────────────────────────────`);

  return { totalRounds, totalUpdated };
}

// ── Standalone run ──────────────────────────────────────────────────────────
if (isMain) {
  backfillRoundNames().catch(err => {
    console.error(`${PREFIX} Fatal:`, err);
    process.exit(1);
  });
}
