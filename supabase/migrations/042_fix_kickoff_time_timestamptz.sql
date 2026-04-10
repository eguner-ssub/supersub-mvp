-- Migration 042: Cast matches.kickoff_time from TEXT to TIMESTAMPTZ
--
-- The kickoff_time column was added as TEXT (implicitly) and stored bare
-- "YYYY-MM-DD HH:mm:ss" strings from Sportmonks without timezone markers.
-- This caused Postgres to interpret CET/CEST timestamps as UTC, producing
-- 01:00 AM kickoffs for Serie A and La Liga matches.
--
-- PREREQUISITE: Delete corrupt upcoming Serie A (384) and La Liga (564) rows
-- before running this migration. Run the wipe SQL in the Supabase dashboard:
--
--   DELETE FROM matches
--   WHERE league_id IN (564, 384)
--     AND custom_status = 'UPCOMING';
--
-- Bare "YYYY-MM-DD HH:mm:ss" values still in the table (past matches) can be
-- cast safely because Postgres will assume UTC, which is correct for all rows
-- that were synced before this bug was identified (they are already in UTC or
-- match results are frozen anyway).

ALTER TABLE matches
  ALTER COLUMN kickoff_time TYPE TIMESTAMPTZ
  USING kickoff_time::TIMESTAMPTZ;

COMMENT ON COLUMN matches.kickoff_time IS
  'UTC kickoff timestamp. Always stored as TIMESTAMPTZ. '
  'Sourced from Sportmonks starting_at with explicit UTC coercion in sync scripts.';
