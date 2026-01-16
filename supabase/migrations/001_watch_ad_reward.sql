-- Migration: Add watch_ad_reward RPC function
-- This function allows users to refill energy by watching rewarded ads

-- Create the RPC function
CREATE OR REPLACE FUNCTION watch_ad_reward(p_user_id UUID)
RETURNS TABLE(new_energy INT, ads_watched INT) AS $$
DECLARE
  v_max_energy INT;
  v_new_energy INT;
  v_ads_count INT;
BEGIN
  -- Get the user's max_energy
  SELECT max_energy INTO v_max_energy
  FROM profiles
  WHERE id = p_user_id;

  -- If user doesn't exist, raise exception
  IF v_max_energy IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Update the profile: set energy to max_energy and increment ads_watched
  UPDATE profiles
  SET 
    energy = max_energy,
    ads_watched = COALESCE(ads_watched, 0) + 1,
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING energy, COALESCE(ads_watched, 0) INTO v_new_energy, v_ads_count;

  -- Return the new values
  RETURN QUERY SELECT v_new_energy, v_ads_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add ads_watched column to profiles table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'ads_watched'
  ) THEN
    ALTER TABLE profiles ADD COLUMN ads_watched INT DEFAULT 0;
  END IF;
END $$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION watch_ad_reward(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION watch_ad_reward IS 'Refills user energy to max after watching a rewarded ad';
