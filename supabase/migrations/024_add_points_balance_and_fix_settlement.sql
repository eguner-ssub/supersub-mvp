-- Migration 024: Rename profiles.coins → profiles.points + fix settle_prediction
--
-- Root cause fixed:
--   points_awarded was written to predictions correctly, but the user's balance
--   was never credited. The column was called "coins" but the intended concept
--   is now "points" (odds-based, from calculateResult). This migration:
--     1. Renames profiles.coins → profiles.points (no duplicate column)
--     2. Rewrites settle_prediction to credit points = points + p_points
--        (the calculated value passed in) instead of potential_reward.
--
-- Double-credit guard:
--   The UPDATE on predictions now includes AND status IN ('PENDING', 'LIVE').
--   If a second settlement run arrives for the same bet, ROW_COUNT = 0 and
--   the profile credit is skipped entirely.

-- ── 1. Rename coins → points ──────────────────────────────────────────────────

ALTER TABLE profiles RENAME COLUMN coins TO points;

COMMENT ON COLUMN profiles.points IS 'Accumulated points balance — credited on each WON settlement via settle_prediction RPC';

-- ── 2. Replace settle_prediction ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION settle_prediction(
  p_prediction_id UUID,
  p_new_status    TEXT,
  p_points        INTEGER DEFAULT 0
)
RETURNS TABLE(success BOOLEAN, new_points INT) AS $$
DECLARE
  v_user_id        UUID;
  v_new_points     INT;
  v_rows_updated   INT;
BEGIN
  -- Validate status
  IF p_new_status NOT IN ('PENDING', 'LIVE', 'WON', 'LOST') THEN
    RAISE EXCEPTION 'Invalid status: %', p_new_status;
  END IF;

  -- Fetch prediction — raises if not found
  SELECT user_id
  INTO v_user_id
  FROM predictions
  WHERE id = p_prediction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prediction not found: %', p_prediction_id;
  END IF;

  -- Atomically settle the prediction and record points_awarded.
  -- The AND status IN ('PENDING','LIVE') guard prevents double-crediting if
  -- two cron instances overlap — the second call matches 0 rows and skips.
  UPDATE predictions
  SET status         = p_new_status,
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

  -- Credit points for wins
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
  'Atomically settles a prediction and credits p_points to profiles.points on WON. '
  'Idempotent: a second call for an already-settled prediction is a no-op (returns success=false).';
