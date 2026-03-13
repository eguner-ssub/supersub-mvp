-- Migration 022: Schema additions — inventory, predictions columns, matches columns
--
-- Fixes CRITICAL issues identified in schema audit:
--   C1. inventory table had no migration (existed only as manually created table)
--   C2. predictions.card_type and predictions.match_title were missing — GameContext
--       inserts these on every placeBet() call
--   C4. matches.started_at and matches.pre_live_synced_at were missing — sync-scores
--       edge function writes and reads both on every sync cycle

-- ── 1. inventory ─────────────────────────────────────────────────────────────
-- Tracks card ownership per user. GameContext.jsx reads (card_id, count) and
-- upserts on card acquisition/consumption.

CREATE TABLE IF NOT EXISTS inventory (
    user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    card_id   TEXT NOT NULL,
    count     INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
    PRIMARY KEY (user_id, card_id)
);

-- RLS: users can only see and modify their own inventory
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'inventory' AND policyname = 'Users can view own inventory'
  ) THEN
    CREATE POLICY "Users can view own inventory"
      ON inventory FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'inventory' AND policyname = 'Users can insert own inventory'
  ) THEN
    CREATE POLICY "Users can insert own inventory"
      ON inventory FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'inventory' AND policyname = 'Users can update own inventory'
  ) THEN
    CREATE POLICY "Users can update own inventory"
      ON inventory FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 2. predictions — add card_type and match_title ───────────────────────────
-- GameContext.jsx inserts these on every bet placement.

ALTER TABLE predictions
    ADD COLUMN IF NOT EXISTS card_type   TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS match_title TEXT DEFAULT NULL;

-- ── 3. matches — add started_at and pre_live_synced_at ───────────────────────
-- sync-scores/index.ts writes started_at when a match transitions to live and
-- reads it to compute the finish-guard window. pre_live_synced_at tracks when
-- pre-live lineup data was last fetched to avoid redundant syncs.

ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS started_at          TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS pre_live_synced_at  TIMESTAMPTZ DEFAULT NULL;
