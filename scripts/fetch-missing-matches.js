// One-off: fetch specific fixture IDs from SportMonks and upsert into matches table.
// Usage: node scripts/fetch-missing-matches.js
//
// Add fixture IDs to FIXTURE_IDS array as needed.

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getFixtureById } from '../lib/sportmonks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const FIXTURE_IDS = [19433705, 19425168, 19425167, 19425165];

const FINAL_STATUSES = [
  'FT', 'AET', 'FT_PEN', 'POSTPONED', 'CANCELLED',
  'ABANDONED', 'AWARDED', 'WO', 'DELETED', 'SUSPENDED',
];
const LIVE_STATUSES = [
  'INPLAY_1ST_HALF', 'HT', 'INPLAY_2ND_HALF', 'INPLAY_ET',
  'EXTRA_TIME_BREAK', 'INPLAY_ET_SECOND_HALF', 'INPLAY_PENALTIES', 'BREAK',
];

function deriveCustomStatus(status) {
  if (!status || status === 'NS') return 'UPCOMING';
  if (FINAL_STATUSES.includes(status)) return 'COMPLETED';
  if (LIVE_STATUSES.includes(status))  return 'LIVE';
  return 'UPCOMING';
}

function extractParticipants(fixture) {
  let homeTeam = null;
  let awayTeam = null;
  for (const p of fixture.participants || []) {
    if (p.meta?.location === 'home') homeTeam = p;
    if (p.meta?.location === 'away') awayTeam = p;
  }
  return { homeTeam, awayTeam };
}

function extractCurrentScore(fixture) {
  let scoreHome = null;
  let scoreAway = null;
  for (const s of fixture.scores || []) {
    if (s.description === 'CURRENT') {
      if (s.score?.participant === 'home') scoreHome = s.score.goals;
      if (s.score?.participant === 'away') scoreAway = s.score.goals;
    }
  }
  return { scoreHome, scoreAway };
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  const db = createClient(url, key);

  const now = new Date().toISOString();

  for (const fixtureId of FIXTURE_IDS) {
    console.log(`Fetching fixture ${fixtureId}…`);
    try {
      const res = await getFixtureById(fixtureId);
      const f = res.data;

      if (!f) {
        console.warn(`  ✗ No data returned for fixture ${fixtureId}`);
        continue;
      }

      const { homeTeam, awayTeam } = extractParticipants(f);
      const { scoreHome, scoreAway } = extractCurrentScore(f);
      const status = f.state?.developer_name || 'NS';

      if (!homeTeam || !awayTeam) {
        console.warn(`  ✗ Missing participants for fixture ${fixtureId}`);
        continue;
      }

      const row = {
        id:             f.id,
        league_id:      f.league_id ?? null,
        date:           f.starting_at ? f.starting_at.split('T')[0] : null,
        kickoff_time:   f.starting_at ?? null,
        home_team:      homeTeam.name,
        away_team:      awayTeam.name,
        home_logo:      homeTeam.image_path ?? null,
        away_logo:      awayTeam.image_path ?? null,
        home_team_id:   homeTeam.id ?? null,
        away_team_id:   awayTeam.id ?? null,
        status,
        custom_status:  deriveCustomStatus(status),
        home_score:     scoreHome ?? 0,
        away_score:     scoreAway ?? 0,
        events:         f.events?.length    ? f.events     : null,
        lineups:        f.lineups?.length   ? f.lineups    : null,
        statistics:     f.statistics?.length ? f.statistics : null,
        raw_data:       f,
        last_updated:   now,
        last_synced_at: now,
      };

      const { error } = await db.from('matches').upsert(row, { onConflict: 'id' });

      if (error) {
        console.error(`  ✗ Upsert failed for ${fixtureId}: ${error.message}`);
      } else {
        console.log(`  ✓ ${homeTeam.name} vs ${awayTeam.name} (${status}) — home_team_id: ${homeTeam.id}, away_team_id: ${awayTeam.id}`);
      }
    } catch (err) {
      console.error(`  ✗ Error fetching ${fixtureId}: ${err.message}`);
    }
  }

  // Now update team_id on stuck predictions
  console.log('\nUpdating team_id on stuck predictions…');
  const { data, error } = await db
    .from('predictions')
    .select('id, match_id, selection')
    .is('team_id', null)
    .in('match_id', FIXTURE_IDS);

  if (error) {
    console.error('Could not query stuck predictions:', error.message);
    return;
  }

  console.log(`Found ${data.length} predictions with null team_id for these fixtures`);

  for (const pred of data) {
    const { data: matchData, error: matchErr } = await db
      .from('matches')
      .select('home_team_id, away_team_id')
      .eq('id', pred.match_id)
      .single();

    if (matchErr || !matchData) {
      console.warn(`  ✗ Match ${pred.match_id} not found for prediction ${pred.id}`);
      continue;
    }

    const teamId = pred.selection === 'HOME' ? matchData.home_team_id : matchData.away_team_id;

    const { error: predErr } = await db
      .from('predictions')
      .update({ team_id: teamId })
      .eq('id', pred.id);

    if (predErr) {
      console.error(`  ✗ Failed to update prediction ${pred.id}: ${predErr.message}`);
    } else {
      console.log(`  ✓ Prediction ${pred.id} (match ${pred.match_id}, ${pred.selection}) → team_id: ${teamId}`);
    }
  }

  console.log('\n✓ Done.');
}

main().catch((err) => {
  console.error('✗ Fatal:', err.message);
  console.error(err.stack);
  process.exit(1);
});
