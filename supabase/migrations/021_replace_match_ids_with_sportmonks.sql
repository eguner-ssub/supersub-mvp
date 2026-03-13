-- Migration 021: Adopt Sportmonks fixture IDs as the canonical matches.id
--
-- The sync-scores edge function already upserts matches using Sportmonks
-- fixture IDs (id: fixture.id in buildPayload). The matches.id column type
-- (INTEGER) is unchanged — Sportmonks IDs are also integers.
--
-- We truncate stale API-Football data so the system re-seeds cleanly.
-- Safe: pre-launch, no user data worth preserving.
--
-- predictions.match_id has a FK reference to matches.id, so both tables
-- must be named in a single TRUNCATE statement for Postgres to accept it.

-- 1 & 2. Wipe predictions and matches together (FK requires a single statement)
TRUNCATE TABLE predictions, matches;

-- 3. Wipe the ID bridge map — no longer needed once matches stores SM IDs natively
TRUNCATE TABLE sportmonks_id_map;
