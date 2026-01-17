-- Migration: Create Predictions Table and Settlement System
-- This enables the betting lifecycle: PENDING -> LIVE -> SETTLED (WON/LOST)

-- Create predictions table
CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Create indexes for performance
CREATE INDEX idx_predictions_user_status ON predictions(user_id, status);
CREATE INDEX idx_predictions_status ON predictions(status);
CREATE INDEX idx_predictions_created_at ON predictions(created_at DESC);

-- Enable Row Level Security
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own predictions
CREATE POLICY "Users can view own predictions"
  ON predictions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own predictions
CREATE POLICY "Users can insert own predictions"
  ON predictions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own predictions
CREATE POLICY "Users can update own predictions"
  ON predictions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Settlement RPC Function
-- This function atomically updates prediction status and awards coins for wins
CREATE OR REPLACE FUNCTION settle_prediction(
  p_prediction_id UUID,
  p_new_status TEXT
)
RETURNS TABLE(success BOOLEAN, new_coins INT) AS $$
DECLARE
  v_user_id UUID;
  v_potential_reward INT;
  v_new_coins INT;
BEGIN
  -- Validate status
  IF p_new_status NOT IN ('PENDING', 'LIVE', 'WON', 'LOST') THEN
    RAISE EXCEPTION 'Invalid status: %', p_new_status;
  END IF;

  -- Get prediction details
  SELECT user_id, potential_reward 
  INTO v_user_id, v_potential_reward
  FROM predictions 
  WHERE id = p_prediction_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prediction not found: %', p_prediction_id;
  END IF;
  
  -- Update prediction status
  UPDATE predictions 
  SET status = p_new_status, 
      updated_at = NOW()
  WHERE id = p_prediction_id;
  
  -- If WON, increment coins atomically
  IF p_new_status = 'WON' THEN
    UPDATE profiles 
    SET coins = coins + v_potential_reward
    WHERE id = v_user_id
    RETURNING coins INTO v_new_coins;
    
    RETURN QUERY SELECT TRUE, v_new_coins;
  ELSE
    -- For LOST or other statuses, just return success
    SELECT coins INTO v_new_coins FROM profiles WHERE id = v_user_id;
    RETURN QUERY SELECT TRUE, v_new_coins;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION settle_prediction(UUID, TEXT) TO authenticated;

-- Enable Realtime for predictions table (for live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE predictions;

-- Add comment for documentation
COMMENT ON TABLE predictions IS 'Stores user betting predictions with lifecycle management (PENDING -> LIVE -> WON/LOST)';
COMMENT ON FUNCTION settle_prediction IS 'Atomically settles a prediction and awards coins for wins';
