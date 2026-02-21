-- Add custom_status column for state-based sync sniper logic
-- Valid values: UPCOMING, PRE-LIVE, LIVE, POST-MATCH, COMPLETED

ALTER TABLE matches
ADD COLUMN custom_status TEXT DEFAULT 'UPCOMING';

-- Index for the sniper query that filters out COMPLETED/UPCOMING
CREATE INDEX idx_matches_custom_status ON matches(custom_status);

COMMENT ON COLUMN matches.custom_status IS 'Derived match state used by sync-scores sniper: UPCOMING | PRE-LIVE | LIVE | POST-MATCH | COMPLETED';
