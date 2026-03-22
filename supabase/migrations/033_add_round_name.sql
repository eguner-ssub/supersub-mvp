-- Migration 033: Add round_name column to matches
-- Stores human-readable round names (e.g. "Gameweek 28") from Sportmonks rounds endpoint
-- Previously matches.round stored only the Sportmonks round_id integer as a string

ALTER TABLE matches ADD COLUMN IF NOT EXISTS round_name TEXT;

CREATE INDEX IF NOT EXISTS idx_matches_league_round ON matches(league_id, round_name);
