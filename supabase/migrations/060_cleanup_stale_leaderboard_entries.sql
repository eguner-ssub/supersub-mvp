-- Migration 060: RPC function to clean up stale leaderboard entries
--
-- Called at the start of every leaderboard refresh run to remove:
--   1. Entries for test accounts (is_test_user = true)
--   2. Orphaned entries whose user_id no longer exists in profiles
--
-- Note: profiles has no email column (email lives in auth.users), so there
-- is no "users without email" filter here — the is_test_user flag covers
-- all test account patterns.

CREATE OR REPLACE FUNCTION cleanup_stale_leaderboard_entries()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Remove entries for flagged test accounts
  DELETE FROM leaderboard_entries
  WHERE user_id IN (
    SELECT id FROM profiles WHERE is_test_user = true
  );

  -- Remove orphaned entries (user deleted their account)
  DELETE FROM leaderboard_entries
  WHERE user_id NOT IN (
    SELECT id FROM profiles
  );
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_stale_leaderboard_entries() TO authenticated, service_role;
