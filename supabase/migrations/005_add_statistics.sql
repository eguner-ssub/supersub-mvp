-- Add statistics column to the matches table for real-time tactical stats
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS statistics JSONB DEFAULT NULL;

COMMENT ON COLUMN matches.statistics IS 'Transformed {home, away} statistics from API-Football, synced during LIVE and POST-MATCH phases';
