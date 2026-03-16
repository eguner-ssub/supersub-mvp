-- Migration 021: Adopt Sportmonks fixture IDs as the canonical matches.id
--
-- The TRUNCATE that was here was a one-time dev operation to wipe stale
-- API-Football data before any real user data existed. It is now a no-op
-- so re-running supabase db push never destroys live data.

DO $$ BEGIN NULL; END $$; -- no-op: truncation already applied during initial migration
