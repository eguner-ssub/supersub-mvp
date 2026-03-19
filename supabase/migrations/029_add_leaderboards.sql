-- Migration 029: Leaderboard system
-- Adds country tracking on profiles, settled_at + league_id on predictions,
-- leaderboard tables, user_league_points, and updates settle_prediction RPC.

-- ── 1. Add country columns to profiles ──────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS country_code TEXT,
  ADD COLUMN IF NOT EXISTS country_source TEXT DEFAULT 'inferred';

-- Add constraint in DO block for idempotency
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_country_source'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT valid_country_source
      CHECK (country_source IN ('inferred', 'manual'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_country
  ON profiles(country_code) WHERE country_code IS NOT NULL;

-- ── 2. Add columns to predictions ───────────────────────────────────────────
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS league_id INTEGER,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

-- Backfill league_id from matches
UPDATE predictions p
SET league_id = m.league_id
FROM matches m
WHERE p.match_id = m.id
  AND p.league_id IS NULL;

-- Backfill matches.season from league_id (never populated by any script)
UPDATE matches SET season = 25583 WHERE league_id = 8   AND season IS NULL;
UPDATE matches SET season = 25648 WHERE league_id = 9   AND season IS NULL;
UPDATE matches SET season = 25646 WHERE league_id = 82  AND season IS NULL;
UPDATE matches SET season = 25659 WHERE league_id = 564 AND season IS NULL;
UPDATE matches SET season = 25533 WHERE league_id = 384 AND season IS NULL;

-- Backfill settled_at from updated_at for already-settled predictions
UPDATE predictions
SET settled_at = updated_at
WHERE status = 'SETTLED'
  AND settled_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_predictions_league
  ON predictions(league_id);
CREATE INDEX IF NOT EXISTS idx_predictions_settled_at
  ON predictions(settled_at) WHERE settled_at IS NOT NULL;

-- ── 3. Create leaderboards table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leaderboards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL CHECK (type IN ('global', 'country', 'league')),
  scope_key   TEXT,
  name        TEXT NOT NULL,
  icon_url    TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(type, scope_key)
);

-- Seed initial leaderboards (skip if already present)
INSERT INTO leaderboards (type, scope_key, name) VALUES
  ('global', NULL,  'Global'),
  ('league', '8',   'Premier League'),
  ('league', '9',   'Championship'),
  ('league', '82',  'Bundesliga'),
  ('league', '564', 'La Liga'),
  ('league', '384', 'Serie A')
ON CONFLICT (type, scope_key) DO NOTHING;

-- ── 4. Create leaderboard_entries table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  leaderboard_id  UUID REFERENCES leaderboards(id) ON DELETE CASCADE,
  period_type     TEXT NOT NULL CHECK (period_type IN ('all_time', 'season', 'weekly', 'monthly')),
  period_key      TEXT NOT NULL,
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE,
  points          INTEGER NOT NULL,
  rank            INTEGER NOT NULL,
  bet_count       INTEGER DEFAULT 0,
  win_count       INTEGER DEFAULT 0,
  total_entries   INTEGER NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (leaderboard_id, period_type, period_key, user_id)
);

CREATE INDEX IF NOT EXISTS idx_le_user
  ON leaderboard_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_le_rank
  ON leaderboard_entries(leaderboard_id, period_type, period_key, rank);

-- ── 5. Create user_league_points table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_league_points (
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  league_id   INTEGER NOT NULL,
  season_id   INTEGER NOT NULL,
  points      INTEGER DEFAULT 0,
  bet_count   INTEGER DEFAULT 0,
  win_count   INTEGER DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, league_id, season_id)
);

CREATE INDEX IF NOT EXISTS idx_ulp_league_points
  ON user_league_points(league_id, season_id, points DESC);

-- ── 6. Update settle_prediction RPC ─────────────────────────────────────────
-- Now also sets settled_at and upserts user_league_points.
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
  v_league_id    INT;
  v_season_id    INT;
BEGIN
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

  -- Atomically settle the prediction
  UPDATE predictions
  SET status         = 'SETTLED',
      settled_status = p_new_status,
      settled_at     = NOW(),
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

  -- Upsert league points (look up league/season from the match)
  SELECT m.league_id, m.season
  INTO v_league_id, v_season_id
  FROM predictions pr
  JOIN matches m ON m.id = pr.match_id
  WHERE pr.id = p_prediction_id;

  IF v_league_id IS NOT NULL AND v_season_id IS NOT NULL THEN
    INSERT INTO user_league_points (user_id, league_id, season_id, points, bet_count, win_count)
    VALUES (
      v_user_id,
      v_league_id,
      v_season_id,
      CASE WHEN p_new_status = 'WON' THEN p_points ELSE 0 END,
      1,
      CASE WHEN p_new_status = 'WON' THEN 1 ELSE 0 END
    )
    ON CONFLICT (user_id, league_id, season_id) DO UPDATE SET
      points    = user_league_points.points + CASE WHEN p_new_status = 'WON' THEN p_points ELSE 0 END,
      bet_count = user_league_points.bet_count + 1,
      win_count = user_league_points.win_count + CASE WHEN p_new_status = 'WON' THEN 1 ELSE 0 END,
      updated_at = NOW();
  END IF;

  RETURN QUERY SELECT TRUE, v_new_points;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION settle_prediction IS
  'Atomically settles a prediction: sets status=SETTLED, settled_status=WON/LOST, settled_at=NOW(), '
  'credits p_points to profiles.points on WON, and upserts user_league_points for league leaderboards. '
  'Idempotent: second call for an already-settled prediction is a no-op (returns success=false).';

-- ── 7. RLS policies ─────────────────────────────────────────────────────────
ALTER TABLE leaderboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_league_points ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'leaderboards' AND policyname = 'Anyone can view leaderboards'
  ) THEN
    CREATE POLICY "Anyone can view leaderboards"
      ON leaderboards FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'leaderboard_entries' AND policyname = 'Anyone can view leaderboard entries'
  ) THEN
    CREATE POLICY "Anyone can view leaderboard entries"
      ON leaderboard_entries FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_league_points' AND policyname = 'Users can view own league points'
  ) THEN
    CREATE POLICY "Users can view own league points"
      ON user_league_points FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
