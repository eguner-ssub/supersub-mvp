-- Economy primitives: streak tracking, energy scheduling, training quotas, ad quotas, inventory expiry.
-- Safe to run on a populated table — all ADD COLUMN IF NOT EXISTS with non-null defaults.

-- ── profiles ──────────────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS current_streak              INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_streak_date            DATE                 DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS best_streak                 INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS energy_last_updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS energy_drinks               INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS training_sessions_today     INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_training_date          DATE                 DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ads_watched_today           INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_ad_date                DATE                 DEFAULT NULL;

-- ── inventory ─────────────────────────────────────────────────────────────────

ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL;

-- Index for the expiry cron query (user_id first to support per-user scans).
CREATE INDEX IF NOT EXISTS inventory_user_expires_at_idx
  ON inventory (user_id, expires_at);
