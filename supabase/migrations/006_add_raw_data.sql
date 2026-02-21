-- Add raw_data JSONB column to preserve full API-Football fixture structure
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT NULL;

COMMENT ON COLUMN matches.raw_data IS 'Full API-Football fixture object — used by the frontend for nested data like team logos, venue, league info';
