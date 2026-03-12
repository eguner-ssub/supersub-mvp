-- Migration: Update predictions schema for SportMonks integration
-- Preserves historical API-Football team_id data while adding SportMonks-native columns

-- 1. Rename existing integer team_id to preserve historical API-Football references
ALTER TABLE predictions
  RENAME COLUMN team_id TO api_football_team_id;

COMMENT ON COLUMN predictions.api_football_team_id IS 'Legacy API-Football integer team ID — preserved for historical predictions, no longer written to';

-- 2. Add new team_id as UUID referencing the teams table
ALTER TABLE predictions
  ADD COLUMN team_id UUID REFERENCES teams(id) DEFAULT NULL;

COMMENT ON COLUMN predictions.team_id IS 'UUID reference to teams table — used for all new predictions going forward';

-- 3. Add player_id for goalscorer and player-level supersub predictions
ALTER TABLE predictions
  ADD COLUMN player_id INTEGER DEFAULT NULL;

COMMENT ON COLUMN predictions.player_id IS 'SportMonks player ID for goalscorer and player-level supersub predictions';

-- 4. Add player_name for display purposes
ALTER TABLE predictions
  ADD COLUMN player_name TEXT DEFAULT NULL;

COMMENT ON COLUMN predictions.player_name IS 'Display name for player-level predictions (denormalized for fast reads)';

-- 5. Add odds_snapshot JSONB for full odds at time of placement
--    Existing odds FLOAT column is kept for backwards compatibility
ALTER TABLE predictions
  ADD COLUMN odds_snapshot JSONB DEFAULT NULL;

COMMENT ON COLUMN predictions.odds_snapshot IS 'Full odds snapshot at placement time (e.g. {home, draw, away, goals_over, goals_under, supersub_yes})';

-- 6. Add points_awarded for settlement scoring separate from coin rewards
ALTER TABLE predictions
  ADD COLUMN points_awarded INTEGER DEFAULT NULL;

COMMENT ON COLUMN predictions.points_awarded IS 'Final points awarded on settlement — separate from the coin-based reward system';

-- Indexes for common query patterns
CREATE INDEX idx_predictions_team_id ON predictions(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX idx_predictions_player_id ON predictions(player_id) WHERE player_id IS NOT NULL;
