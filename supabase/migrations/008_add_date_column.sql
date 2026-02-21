-- Add date column for easy date-based queries from the frontend
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS date TEXT DEFAULT NULL;

-- Index for date-based lookups (Match Hub date picker)
CREATE INDEX IF NOT EXISTS idx_matches_date ON matches (date);
