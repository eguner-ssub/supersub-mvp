-- Migration 038: Funnel analytics events table
-- Captures pre-auth and post-auth funnel events for drop-off analysis.
-- No user_id on early funnel events (user is not yet authenticated).
-- RLS: anon AND authenticated users can insert — funnel starts before auth.

CREATE TABLE IF NOT EXISTS analytics_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  TEXT        NOT NULL,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  event       TEXT        NOT NULL,
  properties  JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_event
  ON analytics_events(event, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_session
  ON analytics_events(session_id, created_at DESC);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Pre-auth events fire with the anon key — allow all inserts.
-- No SELECT policy: this data is for internal reporting only.
CREATE POLICY "Anyone can insert analytics events"
  ON analytics_events FOR INSERT WITH CHECK (true);
