-- Migration 034: Affiliate revenue engine — predictions columns + affiliate_events table
--
-- Adds:
--   predictions.seen_by_user  — tracks whether the user has seen the post-settlement modal
--   predictions.share_token   — opaque UUID for public share URLs (supersub.mobi/share/<token>)
--   affiliate_events          — impression + click tracking for operator reporting

-- ── 1. predictions: seen_by_user and share_token ──────────────────────────────

ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS seen_by_user BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_token  UUID    NOT NULL DEFAULT gen_random_uuid();

-- share_token must be unique — it's the public identifier for share URLs
CREATE UNIQUE INDEX IF NOT EXISTS idx_predictions_share_token
  ON predictions(share_token);

-- Index for the unseen-settlements query in GameContext.loadProfile()
CREATE INDEX IF NOT EXISTS idx_predictions_unseen_settled
  ON predictions(user_id, status, seen_by_user)
  WHERE status = 'SETTLED' AND seen_by_user = false;

COMMENT ON COLUMN predictions.seen_by_user IS
  'False until the user dismisses the WinCelebrationModal for this prediction. '
  'Prevents showing the same settlement modal more than once.';

COMMENT ON COLUMN predictions.share_token IS
  'Opaque UUID used in public share URLs (supersub.mobi/share/<token>). '
  'Never expose the internal UUID primary key in public URLs.';

-- ── 2. affiliate_events — impression and click tracking ───────────────────────
-- RLS: users can INSERT their own rows; no SELECT (internal reporting only).

CREATE TABLE IF NOT EXISTS affiliate_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL CHECK (event_type IN ('impression', 'click')),
  operator    TEXT        NOT NULL,
  card_type   TEXT,
  match_id    INTEGER,
  odds        FLOAT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_events_user
  ON affiliate_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_affiliate_events_reporting
  ON affiliate_events(operator, event_type, created_at DESC);

ALTER TABLE affiliate_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'affiliate_events'
      AND policyname = 'Users can insert own affiliate events'
  ) THEN
    CREATE POLICY "Users can insert own affiliate events"
      ON affiliate_events FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

COMMENT ON TABLE affiliate_events IS
  'Fire-and-forget impression and click events from affiliate CTAs. '
  'Used for operator reporting (CTR, conversion) before/during commercial negotiations.';
