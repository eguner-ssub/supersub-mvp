-- Migration 053: Add is_test_user flag to profiles
--
-- Flags test accounts so they can be excluded from leaderboards and analytics.
-- Test patterns: @erentest.com email, name starting with "test", club_name containing "test".
--
-- Note: profiles has no email column — email lives in auth.users.
-- The backfill JOINs auth.users; the trigger uses SECURITY DEFINER to do the same.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_test_user BOOLEAN NOT NULL DEFAULT false;

-- Partial index: only indexes flagged rows (tiny overhead for real users)
CREATE INDEX IF NOT EXISTS idx_profiles_is_test_user
  ON profiles(is_test_user)
  WHERE is_test_user = true;

-- Backfill: flag existing test accounts
UPDATE profiles p
SET is_test_user = true
FROM auth.users u
WHERE p.id = u.id
  AND p.is_test_user = false
  AND (
    u.email ILIKE '%@erentest.com'
    OR p.name      ILIKE 'test%'
    OR p.club_name ILIKE '%test%'
  );

-- Trigger function: auto-flag new/updated accounts that match test patterns
CREATE OR REPLACE FUNCTION flag_test_user()
RETURNS TRIGGER AS $$
DECLARE
  v_email TEXT;
BEGIN
  -- profiles has no email column; look it up from auth.users
  SELECT email INTO v_email FROM auth.users WHERE id = NEW.id;

  IF (
    v_email    ILIKE '%@erentest.com'
    OR NEW.name      ILIKE 'test%'
    OR NEW.club_name ILIKE '%test%'
  ) THEN
    NEW.is_test_user := true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_flag_test_user ON profiles;
CREATE TRIGGER trigger_flag_test_user
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION flag_test_user();
