-- Add season column for league+season filtering in Watcher multi-single-league mode
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS season INTEGER DEFAULT NULL;

-- Composite index for the Watcher's single-league query
CREATE INDEX IF NOT EXISTS idx_matches_league_season ON matches (league_id, season);

COMMENT ON COLUMN matches.season IS 'League season year, used by Watcher multi-single-league polling mode';
