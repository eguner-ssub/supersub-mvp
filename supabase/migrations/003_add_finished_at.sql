-- Add finished_at column to track when matches transition to finished state
-- This enables the 15-minute cutoff for event fetching optimization

ALTER TABLE matches
ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

-- Add index for efficient querying on finished_at
CREATE INDEX IF NOT EXISTS idx_matches_finished_at ON matches(finished_at) WHERE finished_at IS NOT NULL;

-- Add index for kickoff_time to optimize time window queries
CREATE INDEX IF NOT EXISTS idx_matches_kickoff_time ON matches(kickoff_time);

-- Add comment
COMMENT ON COLUMN matches.finished_at IS 'Timestamp when match transitioned to finished state (FT/AET/PEN) - used for event fetching optimization';
