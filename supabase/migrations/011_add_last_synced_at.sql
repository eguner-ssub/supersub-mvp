-- Add last_synced_at column for Watcher cooldown on COMPLETED matches
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NULL;

-- Composite index for the cooldown query (custom_status + last_synced_at)
CREATE INDEX IF NOT EXISTS idx_matches_status_synced ON matches (custom_status, last_synced_at);

COMMENT ON COLUMN matches.last_synced_at IS 'Timestamp of last Watcher sync — used for 2-hour cooldown on COMPLETED matches';
