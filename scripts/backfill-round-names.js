#!/usr/bin/env node
// scripts/backfill-round-names.js
// Fetches round names from Sportmonks and populates matches.round_name.
// matches.round stores the Sportmonks round_id as a string; this script maps
// those IDs to human-readable names (e.g. "Gameweek 28").
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
  // Use explicit FK name to avoid ambiguity — seasons.league_id → leagues.id
  // (leagues also has current_season_id → seasons, which would create two join paths)
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
    const leagueId = season.leagues.sportmonks_id;
    const seasonId = season.sportmonks_id;
    const leagueName = season.leagues.name;

    console.log(`${PREFIX} Fetching rounds for ${leagueName} (season ${seasonId})…`);

    try {
      const resp = await request(`/rounds/seasons/${seasonId}`, { per_page: 200 });
      const rounds = resp.data || [];
      console.log(`${PREFIX}   ${rounds.length} rounds returned`);

      if (rounds.length === 0) {
        await sleep(RATE_LIMIT_MS);
        continue;
      }

      totalRounds += rounds.length;

      // Update matches in batches — match on league_id + round (string of round_id)
      for (const round of rounds) {
        const roundIdStr = String(round.id);
        const roundName = round.name;

        const { count, error } = await supabase
          .from('matches')
          .update({ round_name: roundName }, { count: 'exact' })
          .eq('league_id', leagueId)
          .eq('round', roundIdStr);

        if (error) {
          console.warn(`${PREFIX}   ✗ Update failed for round ${roundName}: ${error.message}`);
        } else if (count > 0) {
          totalUpdated += count;
        }
      }

      console.log(`${PREFIX}   ✓ ${leagueName} rounds processed`);
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
