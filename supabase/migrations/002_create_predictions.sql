-- Migration: Create Predictions Table and Settlement System
-- This enables the betting lifecycle: PENDING -> LIVE -> SETTLED (WON/LOST)
-- All statements are idempotent so re-running this migration never fails.

-- Create predictions table
CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id INT NOT NULL,
  team_name TEXT NOT NULL,
  selection TEXT NOT NULL,
  odds FLOAT NOT NULL,
  stake INT NOT NULL,
  potential_reward INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure status is one of the valid values
  CONSTRAINT valid_status CHECK (status IN ('PENDING', 'LIVE', 'WON', 'LOST'))
);

-- Create indexes for performance (IF NOT EXISTS so re-runs are safe)
CREATE INDEX IF NOT EXISTS idx_predictions_user_status ON predictions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_predictions_status ON predictions(status);
CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON predictions(created_at DESC);

-- Enable Row Level Security
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

-- Policies (wrapped in DO blocks so re-runs are safe)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'predictions' AND policyname = 'Users can view own predictions'
  ) THEN
    CREATE POLICY "Users can view own predictions"
      ON predictions FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'predictions' AND policyname = 'Users can insert own predictions'
  ) THEN
    CREATE POLICY "Users can insert own predictions"
      ON predictions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'predictions' AND policyname = 'Users can update own predictions'
  ) THEN
    CREATE POLICY "Users can update own predictions"
      ON predictions FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Settlement RPC — initial version, superseded by migration 024 which drops
-- this and replaces it with the points-aware version. The body here references
-- the 'coins' column which is also renamed in 024; since plpgsql is not
-- validated at creation time this is safe — 024 always replaces it before
-- this function is ever called in production.
DROP FUNCTION IF EXISTS settle_prediction(UUID, TEXT);
CREATE FUNCTION settle_prediction(
  p_prediction_id UUID,
  p_new_status TEXT
)
RETURNS TABLE(success BOOLEAN, new_coins INT) AS $$
DECLARE
  v_user_id UUID;
  v_potential_reward INT;
  v_new_coins INT;
BEGIN
  IF p_new_status NOT IN ('PENDING', 'LIVE', 'WON', 'LOST') THEN
    RAISE EXCEPTION 'Invalid status: %', p_new_status;
  END IF;

  SELECT user_id, potential_reward
  INTO v_user_id, v_potential_reward
  FROM predictions
  WHERE id = p_prediction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prediction not found: %', p_prediction_id;
  END IF;

  UPDATE predictions
  SET status = p_new_status,
      updated_at = NOW()
  WHERE id = p_prediction_id;

  IF p_new_status = 'WON' THEN
    UPDATE profiles
    SET coins = coins + v_potential_reward
    WHERE id = v_user_id
    RETURNING coins INTO v_new_coins;
    RETURN QUERY SELECT TRUE, v_new_coins;
  ELSE
    SELECT coins INTO v_new_coins FROM profiles WHERE id = v_user_id;
    RETURN QUERY SELECT TRUE, v_new_coins;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION settle_prediction(UUID, TEXT) TO authenticated;

-- Enable Realtime for predictions table (guarded so re-runs are safe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'predictions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE predictions;
  END IF;
END $$;

-- Comments
COMMENT ON TABLE predictions IS 'Stores user betting predictions with lifecycle management (PENDING -> LIVE -> WON/LOST)';
COMMENT ON FUNCTION settle_prediction IS 'Initial settlement function — superseded by migration 024';
