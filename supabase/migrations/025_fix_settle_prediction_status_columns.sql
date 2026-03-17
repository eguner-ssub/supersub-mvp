-- Migration 025: Fix settle_prediction to write to the correct status columns
--
-- Bug: The RPC was writing 'WON'/'LOST' to predictions.status.
-- Correct schema (confirmed from live data):
--   predictions.status         → lifecycle: PENDING | LIVE | SETTLED
--   predictions.settled_status → outcome:   WON | LOST
--
-- Fix: status always becomes 'SETTLED', settled_status receives the outcome.

-- ── 1. Add settled_status column if not already present (idempotent) ──────────
ALTER TABLE predictions
    ADD COLUMN IF NOT EXISTS settled_status TEXT DEFAULT NULL;

-- ── 2. Fix dirty data: rows settled by old cron have status='WON'/'LOST' ──────
--    Must run BEFORE the constraint is re-added, otherwise ADD CONSTRAINT fails.
UPDATE predictions
SET status = 'SETTLED'
WHERE status IN ('WON', 'LOST');

-- ── 3. Fix valid_status constraint ────────────────────────────────────────────
--    Old: CHECK (status IN ('PENDING', 'LIVE', 'WON', 'LOST'))
--    New: CHECK (status IN ('PENDING', 'LIVE', 'SETTLED'))
--    WON/LOST no longer belong in status — they go to settled_status.
ALTER TABLE predictions DROP CONSTRAINT IF EXISTS valid_status;
ALTER TABLE predictions
    ADD CONSTRAINT valid_status
    CHECK (status IN ('PENDING', 'LIVE', 'SETTLED'));

-- ── 4. Replace settle_prediction RPC ─────────────────────────────────────────

DROP FUNCTION IF EXISTS settle_prediction(UUID, TEXT);
DROP FUNCTION IF EXISTS settle_prediction(UUID, TEXT, INTEGER);

CREATE FUNCTION settle_prediction(
  p_prediction_id UUID,
  p_new_status    TEXT,     -- outcome: 'WON' or 'LOST'
  p_points        INTEGER DEFAULT 0
)
RETURNS TABLE(success BOOLEAN, new_points INT) AS $$
DECLARE
  v_user_id      UUID;
  v_new_points   INT;
  v_rows_updated INT;
BEGIN
  -- p_new_status is the outcome (WON/LOST), not the lifecycle status
  IF p_new_status NOT IN ('WON', 'LOST') THEN
    RAISE EXCEPTION 'Invalid outcome: % — expected WON or LOST', p_new_status;
  END IF;

  -- Fetch prediction owner
  SELECT user_id
  INTO v_user_id
  FROM predictions
  WHERE id = p_prediction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prediction not found: %', p_prediction_id;
  END IF;

  -- Atomically settle:
  --   status         → 'SETTLED'  (lifecycle column)
  --   settled_status → WON/LOST   (outcome column)
  --   points_awarded → set on WON
  -- The AND status IN ('PENDING','LIVE') guard prevents double-crediting if
  -- two cron instances overlap — second call matches 0 rows and skips.
  UPDATE predictions
  SET status         = 'SETTLED',
      settled_status = p_new_status,
      points_awarded = CASE
                         WHEN p_new_status = 'WON' AND p_points > 0 THEN p_points
                         ELSE points_awarded
                       END,
      updated_at     = NOW()
  WHERE id     = p_prediction_id
    AND status IN ('PENDING', 'LIVE');

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  -- Already settled — return current balance without touching anything
  IF v_rows_updated = 0 THEN
    SELECT points INTO v_new_points FROM profiles WHERE id = v_user_id;
    RETURN QUERY SELECT FALSE, v_new_points;
    RETURN;
  END IF;

  -- Credit points balance for wins
  IF p_new_status = 'WON' AND p_points > 0 THEN
    UPDATE profiles
    SET points = points + p_points
    WHERE id = v_user_id
    RETURNING points INTO v_new_points;
  ELSE
    SELECT points INTO v_new_points FROM profiles WHERE id = v_user_id;
  END IF;

  RETURN QUERY SELECT TRUE, v_new_points;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION settle_prediction IS
  'Atomically settles a prediction: sets status=SETTLED, settled_status=WON/LOST, '
  'and credits p_points to profiles.points on WON. '
  'Idempotent: second call for an already-settled prediction is a no-op (returns success=false).';
