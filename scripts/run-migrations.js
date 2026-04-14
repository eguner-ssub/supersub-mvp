// Bootstrap a Supabase project by running all migrations in order.
// Reads DATABASE_URL from the environment (PostgreSQL connection URI).
// After each migration, records it in supabase_migrations.schema_migrations
// so subsequent `supabase db push` calls recognise it as already applied.
//
// Usage:
//   DATABASE_URL=postgresql://postgres.xxxx:password@... node scripts/run-migrations.js

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ── Config ───────────────────────────────────────────────────────────────────

const DATABASE_URL    = process.env.DATABASE_URL;
const MIGRATIONS_DIR  = path.resolve(__dirname, '../supabase/migrations');

if (!DATABASE_URL) {
  console.error('✗ Missing DATABASE_URL — set it before running this script.');
  console.error('  Example:');
  console.error('  DATABASE_URL=postgresql://postgres.xxxx:password@aws-0-eu-west-2.pooler.supabase.com:5432/postgres node scripts/run-migrations.js');
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Read and sort migration files numerically by their leading number. */
function getMigrationFiles() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort(); // zero-padded names sort correctly lexicographically
  return files.map(f => ({ filename: f, version: f.replace(/\.sql$/, ''), filepath: path.join(MIGRATIONS_DIR, f) }));
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const migrations = getMigrationFiles();
  console.log(`Found ${migrations.length} migration files in supabase/migrations/\n`);

  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log('Connected to database.\n');
  } catch (err) {
    console.error('✗ Failed to connect:', err.message);
    process.exit(1);
  }

  // Ensure the supabase_migrations tracking schema/table exist.
  // On a fresh Supabase project the CLI hasn't created these yet.
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS supabase_migrations;
    CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
      version TEXT PRIMARY KEY,
      inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  let applied = 0;
  let skipped = 0;

  for (const { filename, version, filepath } of migrations) {
    // Skip if already recorded in the migrations tracking table.
    const { rows } = await client.query(
      'SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = $1',
      [version]
    );
    if (rows.length > 0) {
      console.log(`  — ${filename} (already applied)`);
      skipped++;
      continue;
    }

    const sql = fs.readFileSync(filepath, 'utf8');

    try {
      await client.query(sql);

      // Record in supabase_migrations.schema_migrations so `supabase db push`
      // treats this migration as already applied.
      await client.query(
        `INSERT INTO supabase_migrations.schema_migrations (version)
         VALUES ($1)
         ON CONFLICT DO NOTHING`,
        [version]
      );

      console.log(`  ✓ ${filename}`);
      applied++;
    } catch (err) {
      console.error(`  ✗ ${filename}: ${err.message}`);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log(`\n✓ Done. ${applied} applied, ${skipped} already applied (${migrations.length} total).`);
}

main();
