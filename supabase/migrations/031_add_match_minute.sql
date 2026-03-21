-- Add match_minute to store the current live minute from Sportmonks periods include
ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_minute SMALLINT;
