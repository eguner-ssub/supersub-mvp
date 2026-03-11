// Seed Sportmonks reference cache (states + types) into the reference_cache table.
// Can be run as a standalone script or imported as a function for Edge Function cold starts.
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getTypes } from '../lib/sportmonks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// ── Hardcoded Sportmonks states ───────────────────────────────────────────────
// The /v3/football/states endpoint returns a subscription error on our plan,
// so we hardcode the verified state data instead of fetching dynamically.

const HARDCODED_STATES = [
  { id: 1, state: 'NS', developer_name: 'NS' },
  { id: 2, state: 'INPLAY_1ST_HALF', developer_name: 'INPLAY_1ST_HALF' },
  { id: 3, state: 'HT', developer_name: 'HT' },
  { id: 4, state: 'BREAK', developer_name: 'BREAK' },
  { id: 5, state: 'FT', developer_name: 'FT' },
  { id: 6, state: 'INPLAY_ET', developer_name: 'INPLAY_ET' },
  { id: 7, state: 'AET', developer_name: 'AET' },
  { id: 8, state: 'FT_PEN', developer_name: 'FT_PEN' },
  { id: 9, state: 'INPLAY_PENALTIES', developer_name: 'INPLAY_PENALTIES' },
  { id: 10, state: 'POSTPONED', developer_name: 'POSTPONED' },
  { id: 11, state: 'SUSPENDED', developer_name: 'SUSPENDED' },
  { id: 12, state: 'CANCELLED', developer_name: 'CANCELLED' },
  { id: 13, state: 'TBA', developer_name: 'TBA' },
  { id: 14, state: 'WO', developer_name: 'WO' },
  { id: 15, state: 'ABANDONED', developer_name: 'ABANDONED' },
  { id: 16, state: 'DELAYED', developer_name: 'DELAYED' },
  { id: 17, state: 'AWARDED', developer_name: 'AWARDED' },
  { id: 18, state: 'INTERRUPTED', developer_name: 'INTERRUPTED' },
  { id: 19, state: 'AWAITING_UPDATES', developer_name: 'AWAITING_UPDATES' },
  { id: 20, state: 'DELETED', developer_name: 'DELETED' },
  { id: 21, state: 'EXTRA_TIME_BREAK', developer_name: 'EXTRA_TIME_BREAK' },
  { id: 22, state: 'INPLAY_2ND_HALF', developer_name: 'INPLAY_2ND_HALF' },
  { id: 23, state: 'INPLAY_ET_2ND_HALF', developer_name: 'INPLAY_ET_SECOND_HALF' },
  { id: 25, state: 'PEN_BREAK', developer_name: 'PEN_BREAK' },
  { id: 26, state: 'PENDING', developer_name: 'PENDING' },
];

// ── Sportmonks developer_name mappings ───────────────────────────────────────
// These are the exact developer_name values from the hardcoded states above.

const TERMINAL_STATE_NAMES = [
  'FT',           // Full Time (id: 5)
  'AET',          // After Extra Time (id: 7)
  'FT_PEN',       // After Penalties (id: 8)
  'POSTPONED',    // Postponed (id: 10)
  'SUSPENDED',    // Suspended (id: 11)
  'CANCELLED',    // Cancelled (id: 12)
  'ABANDONED',    // Abandoned (id: 15)
  'AWARDED',      // Awarded (id: 17)
  'WO',           // Walk Over (id: 14)
  'DELETED',      // Deleted (id: 20)
];

const IN_PLAY_STATE_NAMES = [
  'INPLAY_1ST_HALF',        // 1st Half (id: 2)
  'HT',                     // Half Time (id: 3)
  'INPLAY_2ND_HALF',        // 2nd Half (id: 22)
  'INPLAY_ET',              // Extra Time 1st Half (id: 6)
  'EXTRA_TIME_BREAK',       // Extra Time Break (id: 21)
  'INPLAY_ET_SECOND_HALF',  // Extra Time 2nd Half (id: 23)
  'INPLAY_PENALTIES',       // Penalties (id: 9)
  'BREAK',                  // Break (id: 4)
];

// ── Supabase client ─────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      `Missing env vars – SUPABASE_URL: ${url ? '✓' : '✗'}, SUPABASE_SERVICE_ROLE_KEY: ${key ? '✓' : '✗'}`
    );
  }
  return createClient(url, key);
}

// ── Core seed function (callable from Edge Functions) ───────────────────────

/**
 * Upserts hardcoded Sportmonks states and fetched types into reference_cache,
 * and returns the resolved terminal/in-play state ID arrays.
 *
 * @param {object} [options]
 * @param {import('@supabase/supabase-js').SupabaseClient} [options.supabase] - Pass an existing client (Edge Function usage)
 * @returns {Promise<{ terminalStateIds: number[], inPlayStateIds: number[], statesCount: number, typesCount: number }>}
 */
export async function seedReferenceCache({ supabase } = {}) {
  const db = supabase || getSupabase();

  // ── States are hardcoded (the /states endpoint is blocked on our plan) ──
  const states = HARDCODED_STATES;

  // ── Fetch types from Sportmonks ─────────────────────────────────────────
  const typesRes = await getTypes();

  if (!typesRes || !typesRes.data) {
    throw new Error(`getTypes() returned no data: ${JSON.stringify(typesRes)}`);
  }

  const types = typesRes.data;

  // ── Build upsert rows ──────────────────────────────────────────────────
  const now = new Date().toISOString();
  const rows = [];

  for (const state of states) {
    rows.push({
      key: `state:${state.id}`,
      value: state,
      cached_at: now,
    });
  }

  for (const type of types) {
    rows.push({
      key: `type:${type.id}`,
      value: type,
      cached_at: now,
    });
  }

  // ── Upsert into reference_cache ────────────────────────────────────────
  if (rows.length > 0) {
    const { error } = await db
      .from('reference_cache')
      .upsert(rows, { onConflict: 'key' });

    if (error) throw new Error(`reference_cache upsert failed: ${error.message}`);
  }

  // ── Derive named constant arrays from fetched states ───────────────────
  const stateByName = new Map(states.map((s) => [s.developer_name, s.id]));

  const terminalStateIds = TERMINAL_STATE_NAMES
    .map((name) => stateByName.get(name))
    .filter((id) => id != null);

  const inPlayStateIds = IN_PLAY_STATE_NAMES
    .map((name) => stateByName.get(name))
    .filter((id) => id != null);

  // Warn if any expected state names didn't resolve — helps catch future API changes
  const missingTerminal = TERMINAL_STATE_NAMES.filter((n) => !stateByName.has(n));
  const missingInPlay = IN_PLAY_STATE_NAMES.filter((n) => !stateByName.has(n));
  if (missingTerminal.length > 0) console.warn(`⚠ Terminal states not found in API response: ${missingTerminal.join(', ')}`);
  if (missingInPlay.length > 0) console.warn(`⚠ In-play states not found in API response: ${missingInPlay.join(', ')}`);

  // ── Also cache the derived arrays for fast lookup ──────────────────────
  const { error: derivedError } = await db.from('reference_cache').upsert([
    { key: 'terminal_state_ids', value: terminalStateIds, cached_at: now },
    { key: 'in_play_state_ids', value: inPlayStateIds, cached_at: now },
  ], { onConflict: 'key' });

  if (derivedError) throw new Error(`derived state cache upsert failed: ${derivedError.message}`);

  return { terminalStateIds, inPlayStateIds, statesCount: states.length, typesCount: types.length };
}

// ── Load cached state IDs (for use without re-fetching from Sportmonks) ──────

/**
 * Reads terminal and in-play state IDs from reference_cache.
 * Returns null if the cache is empty (caller should run seedReferenceCache).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<{ terminalStateIds: number[], inPlayStateIds: number[] } | null>}
 */
export async function loadStateIds(supabase) {
  const { data, error } = await supabase
    .from('reference_cache')
    .select('key, value')
    .in('key', ['terminal_state_ids', 'in_play_state_ids']);

  if (error || !data || data.length < 2) return null;

  const map = Object.fromEntries(data.map((r) => [r.key, r.value]));
  return {
    terminalStateIds: map.terminal_state_ids || [],
    inPlayStateIds: map.in_play_state_ids || [],
  };
}

/**
 * Ensures state IDs are available — loads from cache, seeds if empty.
 * Intended for Edge Function cold starts.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<{ terminalStateIds: number[], inPlayStateIds: number[] }>}
 */
export async function ensureStateIds(supabase) {
  const cached = await loadStateIds(supabase);
  if (cached) return cached;

  const { terminalStateIds, inPlayStateIds } = await seedReferenceCache({ supabase });
  return { terminalStateIds, inPlayStateIds };
}

// ── CLI entry point ─────────────────────────────────────────────────────────

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  seedReferenceCache()
    .then(({ terminalStateIds, inPlayStateIds, statesCount, typesCount }) => {
      console.log(`✓ Cached ${statesCount} states and ${typesCount} types`);
      console.log(`  Terminal state IDs: [${terminalStateIds.join(', ')}]`);
      console.log(`  In-play state IDs:  [${inPlayStateIds.join(', ')}]`);
    })
    .catch((err) => {
      console.error('✗ Seed failed:', err.message);
      process.exit(1);
    });
}