-- Migration: Update predictions schema for SportMonks integration

-- 1. team_id remains INTEGER — SportMonks integer team ID, no change needed
COMMENT ON COLUMN predictions.team_id IS 'SportMonks integer team ID for Supersub settlement logic';

-- 2. Add player_id for goalscorer and player-level supersub predictions
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS player_id INTEGER DEFAULT NULL;
COMMENT ON COLUMN predictions.player_id IS 'SportMonks player ID for goalscorer and player-level supersub predictions';

-- 3. Add player_name for display purposes
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS player_name TEXT DEFAULT NULL;
COMMENT ON COLUMN predictions.player_name IS 'Display name for player-level predictions (denormalized for fast reads)';

-- 4. Add odds_snapshot JSONB for full odds at time of placement
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS odds_snapshot JSONB DEFAULT NULL;
COMMENT ON COLUMN predictions.odds_snapshot IS 'Full odds snapshot at placement time (e.g. {home, draw, away, goals_over, goals_under, supersub_yes})';

-- 5. Add points_awarded for settlement scoring
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS points_awarded INTEGER DEFAULT NULL;
COMMENT ON COLUMN predictions.points_awarded IS 'Final points awarded on settlement';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_predictions_team_id   ON predictions(team_id);
CREATE INDEX IF NOT EXISTS idx_predictions_player_id ON predictions(player_id) WHERE player_id IS NOT NULL;
