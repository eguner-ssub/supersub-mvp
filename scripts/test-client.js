// Temporary test script — calls each Sportmonks API method and logs response shapes.
// Usage: node scripts/test-client.js
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  getFixturesByDate,
  getFixturesByDateRange,
  getFixtureById,
  getLiveScores,
  getPreLiveScores,
  getStandings,
  getTopScorers,
  getTeamStats,
  getLeagues,
  getTypes,
} from '../lib/sportmonks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function summarise(label, res) {
  const data = res.data;
  const pagination = res.pagination;
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${label}`);
  console.log('═'.repeat(60));
  console.log(`  data type : ${Array.isArray(data) ? 'array' : typeof data}`);
  console.log(`  data count: ${Array.isArray(data) ? data.length : 'N/A'}`);
  if (pagination) console.log(`  pagination: has_more=${pagination.has_more}, per_page=${pagination.per_page}, current_page=${pagination.current_page}`);
  if (Array.isArray(data) && data.length > 0) {
    console.log(`  first keys: ${Object.keys(data[0]).join(', ')}`);
  } else if (data && typeof data === 'object' && !Array.isArray(data)) {
    console.log(`  keys: ${Object.keys(data).join(', ')}`);
  }
  return res;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // ── 1. getLeagues ───────────────────────────────────────────────────────
  const leaguesRes = summarise('getLeagues()', await getLeagues());
  const epl = leaguesRes.data?.find((l) => l.id === 8);
  if (epl) {
    console.log(`  EPL: ${epl.name}, currentseason keys: ${Object.keys(epl.currentseason || {}).join(', ')}`);
    console.log(`  EPL season: ${epl.currentseason?.name}, id=${epl.currentseason?.id}`);
  }
  await sleep(1200);

  // ── 2. getTypes ─────────────────────────────────────────────────────────
  const typesRes = summarise('getTypes()', await getTypes());
  if (typesRes.data?.length > 0) {
    console.log(`  sample type: ${JSON.stringify(typesRes.data[0])}`);
  }
  await sleep(1200);

  // ── 3. getFixturesByDate (today) ────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];
  const byDateRes = summarise(`getFixturesByDate('${today}')`, await getFixturesByDate(today));
  await sleep(1200);

  // ── 4. getFixturesByDateRange (last 7 days, EPL) ────────────────────────
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const rangeRes = summarise(`getFixturesByDateRange('${weekAgo}', '${today}', 8)`, await getFixturesByDateRange(weekAgo, today, 8));
  await sleep(1200);

  // ── 5. getFixtureById — find a completed fixture from Supabase ──────────
  let fixtureSmId = null;
  const { data: dbFixture } = await db
    .from('fixtures')
    .select('sportmonks_id, status')
    .eq('status', 'FT')
    .limit(1)
    .single();

  if (dbFixture) {
    fixtureSmId = dbFixture.sportmonks_id;
    console.log(`\n  Using completed fixture from DB: sportmonks_id=${fixtureSmId} (status=${dbFixture.status})`);
  } else {
    // Fallback: use a fixture from the date range response
    const completed = (rangeRes.data || byDateRes.data || []).find(
      (f) => f.state?.developer_name === 'FT'
    );
    if (completed) {
      fixtureSmId = completed.id;
      console.log(`\n  Using completed fixture from API: id=${fixtureSmId}`);
    }
  }

  if (fixtureSmId) {
    await sleep(1200);
    const detailRes = summarise(`getFixtureById(${fixtureSmId})`, await getFixtureById(fixtureSmId));
    const f = detailRes.data;

    if (f) {
      console.log(`\n  ── FIXTURE DETAIL ANALYSIS ──`);
      console.log(`  fixture id  : ${f.id}`);
      console.log(`  starting_at : ${f.starting_at}`);
      console.log(`  state       : ${JSON.stringify(f.state)}`);
      console.log(`  state.developer_name: ${f.state?.developer_name}`);

      // Participants: home vs away
      console.log(`\n  participants (${(f.participants || []).length}):`);
      for (const p of f.participants || []) {
        console.log(`    id=${p.id} name=${p.name} meta=${JSON.stringify(p.meta)}`);
      }

      // Scores
      console.log(`\n  scores (${(f.scores || []).length}):`);
      for (const s of f.scores || []) {
        console.log(`    description=${s.description} score=${JSON.stringify(s.score)} participant_id=${s.score?.participant_id}`);
      }

      // Events (first 5)
      const events = f.events || [];
      console.log(`\n  events count: ${events.length} (showing first 5):`);
      for (const e of events.slice(0, 5)) {
        console.log(`    type_id=${e.type_id} minute=${e.minute} participant_id=${e.participant_id} player_name=${e.player_name || 'N/A'} result=${e.result || ''}`);
      }

      // Lineups (summary)
      const lineups = f.lineups || [];
      console.log(`\n  lineups count: ${lineups.length}`);
      if (lineups.length > 0) {
        console.log(`    first lineup keys: ${Object.keys(lineups[0]).join(', ')}`);
      }
    }
  } else {
    console.log('\n  ⚠ No completed fixture found — skipping getFixtureById');
  }
  await sleep(1200);

  // ── 6. getLiveScores ────────────────────────────────────────────────────
  try {
    summarise('getLiveScores()', await getLiveScores());
  } catch (err) {
    console.log(`\n  getLiveScores() error: ${err.message} (expected if no games live)`);
  }
  await sleep(1200);

  // ── 7. getPreLiveScores ────────────────────────────────────────────────
  try {
    summarise('getPreLiveScores()', await getPreLiveScores());
  } catch (err) {
    console.log(`\n  getPreLiveScores() error: ${err.message}`);
  }
  await sleep(1200);

  // ── 8. getStandings (EPL current season) ────────────────────────────────
  const eplSeasonId = epl?.currentseason?.id;
  if (eplSeasonId) {
    const standRes = summarise(`getStandings(${eplSeasonId})`, await getStandings(eplSeasonId));
    if (standRes.data?.[0]) {
      const first = standRes.data[0];
      console.log(`  first standing keys: ${Object.keys(first).join(', ')}`);
      console.log(`  position=${first.position} participant_id=${first.participant_id} points=${first.points}`);
      console.log(`  participant: ${JSON.stringify(first.participant)}`);
      console.log(`  details (${(first.details || []).length}): ${JSON.stringify((first.details || []).slice(0, 3))}`);
    }
  }
  await sleep(1200);

  // ── 9. getTopScorers (EPL, page 1) ─────────────────────────────────────
  if (eplSeasonId) {
    const tsRes = summarise(`getTopScorers(${eplSeasonId}, 1)`, await getTopScorers(eplSeasonId, 1));
    if (tsRes.data?.[0]) {
      const first = tsRes.data[0];
      console.log(`  first scorer keys: ${Object.keys(first).join(', ')}`);
      console.log(`  player_id=${first.player_id} total=${first.total} participant_id=${first.participant_id}`);
      console.log(`  player: ${JSON.stringify(first.player)}`);
    }
  }
  await sleep(1200);

  // ── 10. getTeamStats (Arsenal, EPL season) ──────────────────────────────
  if (eplSeasonId) {
    const arsenalSmId = 19; // Arsenal's Sportmonks ID
    const tsRes = summarise(`getTeamStats(${arsenalSmId}, ${eplSeasonId})`, await getTeamStats(arsenalSmId, eplSeasonId));
    const team = tsRes.data;
    if (team) {
      console.log(`  team name: ${team.name}`);
      const stats = team.statistics || [];
      console.log(`  statistics count: ${stats.length}`);
      if (stats.length > 0) {
        console.log(`  first stat keys: ${Object.keys(stats[0]).join(', ')}`);
        console.log(`  first 3 stats: ${JSON.stringify(stats.slice(0, 3))}`);
      }
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log('  ✓ All tests complete');
  console.log('═'.repeat(60));
}

run().catch((err) => {
  console.error('✗ Test failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
