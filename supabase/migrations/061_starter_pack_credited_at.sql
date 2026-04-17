-- 061_starter_pack_credited_at.sql
-- Adds an idempotency marker so the one-time "Starter Pack" reveal cannot
-- double-credit cards if the user refreshes mid-flow, and backfills the 12
-- starter cards (3 of each type) for users who completed onboarding before
-- the crediting logic shipped.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Schema: add the idempotency marker column
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS starter_pack_credited_at TIMESTAMPTZ;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Backfill: users who finished onboarding but never received the pack
--
-- Any user with onboarding_complete = true and no starter_pack_credited_at
-- stamp reached the "GET TO WORK" button before the crediting logic existed.
-- Grant them 3 of each of the four starter card types. Idempotent via the
-- WHERE clause + ON CONFLICT — safe to re-run.
-- ───────────────────────────────────────────────────────────────────────────

INSERT INTO inventory (user_id, card_id, count)
SELECT
  p.id,
  card_id,
  3
FROM profiles p
CROSS JOIN (
  VALUES ('c_match_result'), ('c_total_goals'), ('c_player_score'), ('c_supersub')
) AS starter(card_id)
WHERE p.onboarding_complete = true
  AND p.starter_pack_credited_at IS NULL
ON CONFLICT (user_id, card_id) DO UPDATE
  SET count = inventory.count + EXCLUDED.count;

-- Stamp the marker on every user we just backfilled so subsequent runs are no-ops.
UPDATE profiles
  SET starter_pack_credited_at = NOW()
WHERE onboarding_complete = true
  AND starter_pack_credited_at IS NULL;
