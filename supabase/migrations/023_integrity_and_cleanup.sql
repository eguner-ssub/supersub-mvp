-- Migration 023: Integrity improvements + dead schema cleanup
--
-- Fixes MEDIUM issues identified in schema audit:
--   H3. predictions.match_id had no FK constraint to matches.id
--   L1. No index on predictions.match_id (used in Realtime join)
--   M7. sportmonks_id_map is truncated and vestigial — drop it
--   M2. team_season_stats is completely dead (nothing reads or writes it) — drop it
--   M6. predictions.api_football_team_id is an API-Football leftover — drop it

-- ── 1. Index on predictions.match_id ─────────────────────────────────────────
-- usePredictions.js joins predictions to matches via match:matches!match_id.
-- Without an index this is a sequential scan for every realtime subscription.

CREATE INDEX IF NOT EXISTS idx_predictions_match_id
    ON predictions (match_id);

-- ── 2. Foreign key: predictions.match_id → matches.id ────────────────────────
-- Enforces referential integrity at the DB level. DEFERRABLE INITIALLY DEFERRED
-- allows bulk operations (e.g. truncate + re-seed) within a single transaction
-- without violating the constraint mid-flight.
-- Safe to add: predictions was truncated in migration 021 (no orphaned rows).

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_predictions_match'
  ) THEN
    ALTER TABLE predictions
      ADD CONSTRAINT fk_predictions_match
      FOREIGN KEY (match_id) REFERENCES matches(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

-- ── 3. Drop predictions.api_football_team_id ─────────────────────────────────
-- Added in migration 020 as a renamed legacy column. No current code reads or
-- writes it. Confusing name; removing reduces schema noise.

ALTER TABLE predictions
    DROP COLUMN IF EXISTS api_football_team_id;

-- ── 4. Drop team_season_stats ─────────────────────────────────────────────────
-- Created in migration 018. No script writes to it; no code reads from it.
-- Completely orphaned table.

DROP TABLE IF EXISTS team_season_stats;

-- ── 5. Drop sportmonks_id_map ─────────────────────────────────────────────────
-- Created in migration 019 as an API-Football ↔ Sportmonks ID bridge.
-- Truncated in migration 021. api/odds/sportmonks.js no longer uses it after
-- matches.id was migrated to Sportmonks fixture IDs natively.

DROP TABLE IF EXISTS sportmonks_id_map;
