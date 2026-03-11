// Seed Sportmonks reference cache (states + types) into the reference_cache table.
// Can be run as a standalone script or imported as a function for Edge Function cold starts.
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getStates, getTypes } from '../lib/sportmonks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// ── Sportmonks state name → developer_name mappings ─────────────────────────
// These are the Sportmonks state developer_names we care about.
// The IDs are resolved at runtime from the /states endpoint and cached.

const TERMINAL_STATE_NAMES = ['FT', 'AET', 'FT_PEN', 'POSTP', 'CANC', 'ABAN', 'SUSP'];
const IN_PLAY_STATE_NAMES = ['1H', 'HT', '2H', 'ET', 'BT', 'PEN_LIVE'];

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
 * Fetches Sportmonks states and types, upserts them into reference_cache,
 * and returns the resolved terminal/in-play state ID arrays.
 *
 * @param {object} [options]
 * @param {import('@supabase/supabase-js').SupabaseClient} [options.supabase] - Pass an existing client (Edge Function usage)
 * @returns {Promise<{ terminalStateIds: number[], inPlayStateIds: number[], statesCount: number, typesCount: number }>}
 */
export async function seedReferenceCache({ supabase } = {}) {
  const db = supabase || getSupabase();

  // ── Fetch from Sportmonks ───────────────────────────────────────────────
  const [statesRes, typesRes] = await Promise.all([getStates(), getTypes()]);

  const states = statesRes.data || [];
  const types = typesRes.data || [];

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

  // ── Also cache the derived arrays for fast lookup ──────────────────────
  await db.from('reference_cache').upsert([
    { key: 'terminal_state_ids', value: terminalStateIds, cached_at: now },
    { key: 'in_play_state_ids', value: inPlayStateIds, cached_at: now },
  ], { onConflict: 'key' });

  return { terminalStateIds, inPlayStateIds, statesCount: states.length, typesCount: types.length };
}

// ── Load cached state IDs (for use without re-fetching from Sportmonks) ──

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
