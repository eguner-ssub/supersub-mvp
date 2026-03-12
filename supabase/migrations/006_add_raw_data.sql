-- Add raw_data JSONB column to preserve full fixture structure
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT NULL;

COMMENT ON COLUMN matches.raw_data IS 'Full fixture object — used by the frontend for nested data like team logos, venue, league info';
