// Restore matches table from CSV backup.
// Usage: node scripts/restore-matches.js /path/to/matches_rows.csv
// Defaults to: ~/Downloads/matches_rows (9).csv

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const CSV_PATH =
  process.argv[2] ||
  path.join(os.homedir(), 'Downloads', 'matches_rows (9).csv');

const BATCH_SIZE = 20; // keep batches small — rows are large (JSONB)

// ── Supabase ─────────────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      `Missing env vars — SUPABASE_URL: ${url ? '✓' : '✗'}, SUPABASE_SERVICE_ROLE_KEY: ${key ? '✓' : '✗'}`
    );
  }
  return createClient(url, key);
}

// ── CSV parser ────────────────────────────────────────────────────────────────
// Handles: quoted fields, embedded commas, escaped quotes (""), embedded newlines.

function parseCSV(raw) {
  const rows = [];
  let fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < raw.length && raw[i + 1] === '"') {
          // Escaped quote → literal "
          current += '"';
          i++;
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        current += ch; // includes embedded newlines
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.length === 0 ? null : current);
        current = '';
      } else if (ch === '\n' || ch === '\r') {
        // End of row — skip bare \r
        if (ch === '\r' && i + 1 < raw.length && raw[i + 1] === '\n') {
          i++;
        }
        if (fields.length > 0 || current.length > 0) {
          fields.push(current.length === 0 ? null : current);
          rows.push(fields);
          fields = [];
          current = '';
        }
      } else {
        current += ch;
      }
    }
  }

  // Last row if file doesn't end with newline
  if (fields.length > 0 || current.length > 0) {
    fields.push(current.length === 0 ? null : current);
    rows.push(fields);
  }

  return rows;
}

// ── Value coercions ──────────────────────────────────────────────────────────

function toInt(v) {
  if (v === null || v === '') return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

function toFloat(v) {
  if (v === null || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function toJson(v) {
  if (v === null || v === '' || v === 'null') return null;
  try {
    return JSON.parse(v);
  } catch {
    return null; // malformed JSON → null rather than crashing
  }
}

function toText(v) {
  return v === null || v === '' ? null : v;
}

function toTimestamp(v) {
  return v === null || v === '' ? null : v;
}

function deriveCustomStatus(status) {
  if (!status) return 'UPCOMING';
  const s = status.toUpperCase();
  if (s === 'FT' || s === 'AET' || s === 'PEN' || s.startsWith('FT') || s === 'FINISHED') return 'COMPLETED';
  if (s.startsWith('INPLAY') || s === 'HT' || s === 'LIVE') return 'LIVE';
  if (s === 'NS') return 'UPCOMING';
  return 'COMPLETED'; // fallback for any unknown finished state
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`✗ CSV file not found: ${CSV_PATH}`);
    process.exit(1);
  }

  console.log(`Reading ${CSV_PATH} …`);
  const raw = fs.readFileSync(CSV_PATH, 'utf8');

  console.log('Parsing CSV …');
  const allRows = parseCSV(raw);

  if (allRows.length < 2) {
    console.error('✗ CSV appears empty or could not be parsed');
    process.exit(1);
  }

  // First row is headers
  const headers = allRows[0];
  console.log(`Headers (${headers.length}): ${headers.join(', ')}`);

  const dataRows = allRows.slice(1);
  console.log(`Data rows: ${dataRows.length}`);

  // Map header name → column index
  const col = (name) => headers.indexOf(name);

  const db = getSupabase();

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  // Process in batches
  for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
    const batch = dataRows.slice(i, i + BATCH_SIZE);

    const rows = batch
      .filter((r) => r.length >= headers.length - 2) // allow a couple of missing trailing nulls
      .map((r) => ({
        id:                 toInt(r[col('id')]),
        home_team:          toText(r[col('home_team')]),
        away_team:          toText(r[col('away_team')]),
        status:             toText(r[col('status')]),
        home_score:         toInt(r[col('home_score')]),
        away_score:         toInt(r[col('away_score')]),
        kickoff_time:       toTimestamp(r[col('kickoff_time')]),
        last_updated:       toTimestamp(r[col('last_updated')]),
        league_id:          toInt(r[col('league_id')]),
        events:             toJson(r[col('events')]),
        lineups:            toJson(r[col('lineups')]),
        finished_at:        toTimestamp(r[col('finished_at')]),
        statistics:         toJson(r[col('statistics')]),
        home_logo:          toText(r[col('home_logo')]),
        away_logo:          toText(r[col('away_logo')]),
        league_name:        toText(r[col('league_name')]),
        league_logo:        toText(r[col('league_logo')]),
        date:               toText(r[col('date')]),
        raw_data:           toJson(r[col('raw_data')]),
        updated_at:         toTimestamp(r[col('updated_at')]),
        odds:               toJson(r[col('odds')]),
        season:             toText(r[col('season')]),
        last_synced_at:     toTimestamp(r[col('last_synced_at')]),
        started_at:         toTimestamp(r[col('started_at')]),
        pre_live_synced_at: toTimestamp(r[col('pre_live_synced_at')]),
        custom_status:      deriveCustomStatus(r[col('status')]),
      }))
      .filter((r) => r.id !== null); // skip rows with no id

    if (rows.length === 0) continue;

    const { error } = await db
      .from('matches')
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      console.error(`  ✗ Batch ${i}–${i + batch.length}: ${error.message}`);
      errors += rows.length;
    } else {
      inserted += rows.length;
      process.stdout.write(`  ✓ ${inserted}/${dataRows.length} rows restored\r`);
    }
  }

  console.log(`\n\nDone.`);
  console.log(`  Inserted/updated : ${inserted}`);
  console.log(`  Skipped (no id)  : ${skipped}`);
  console.log(`  Errors           : ${errors}`);
}

main().catch((err) => {
  console.error('✗ Fatal:', err.message);
  process.exit(1);
});
