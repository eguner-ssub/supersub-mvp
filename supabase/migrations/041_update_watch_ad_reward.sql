-- Migration 041: Replace watch_ad_reward with daily-cap + energy drink grant
-- Requires: 040_economy_primitives (ads_watched_today, last_ad_date, energy_drinks columns)

CREATE OR REPLACE FUNCTION watch_ad_reward(p_user_id UUID)
RETURNS TABLE(new_energy_drinks INT) AS $$
DECLARE
  v_ads_today  INT;
  v_last_date  DATE;
  v_drinks     INT;
  v_reset_ads  INT;
  v_new_drinks INT;
BEGIN
  -- 1. Fetch current ad tracking fields
  SELECT ads_watched_today, last_ad_date, energy_drinks
  INTO   v_ads_today, v_last_date, v_drinks
  FROM   profiles
  WHERE  id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- 2. Reset daily counter if it's a new day
  IF v_last_date IS DISTINCT FROM CURRENT_DATE THEN
    v_reset_ads := 0;
  ELSE
    v_reset_ads := v_ads_today;
  END IF;

  -- 3. Enforce daily cap (2 ads per day)
  IF v_reset_ads >= 2 THEN
    RAISE EXCEPTION 'daily_cap_reached';
  END IF;

  -- 4. Grant one energy drink (capped at 6), increment counter, mark date
  UPDATE profiles
  SET
    energy_drinks     = LEAST(energy_drinks + 1, 6),
    ads_watched_today = v_reset_ads + 1,
    last_ad_date      = CURRENT_DATE,
    updated_at        = NOW()
  WHERE id = p_user_id
  RETURNING energy_drinks INTO v_new_drinks;

  RETURN QUERY SELECT v_new_drinks;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-grant execute permission (idempotent)
GRANT EXECUTE ON FUNCTION watch_ad_reward(UUID) TO authenticated;

COMMENT ON FUNCTION watch_ad_reward IS
  'Grants 1 energy drink (capped at 6) per ad watch, max 2 ads per calendar day. '
  'Raises daily_cap_reached if the cap is hit.';
