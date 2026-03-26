-- Migration 036: Add 'share' to affiliate_events event_type CHECK constraint
--
-- The original CHECK constraint (migration 034) only allows 'impression' and 'click'.
-- ShareCardButton needs to insert 'share' events for tracking.

ALTER TABLE affiliate_events
  DROP CONSTRAINT IF EXISTS affiliate_events_event_type_check;

ALTER TABLE affiliate_events
  ADD CONSTRAINT affiliate_events_event_type_check
  CHECK (event_type IN ('impression', 'click', 'share'));
