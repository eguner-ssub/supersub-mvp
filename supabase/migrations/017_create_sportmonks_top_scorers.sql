-- Sportmonks migration: top_scorers table

CREATE TABLE IF NOT EXISTS top_scorers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sportmonks_id INTEGER NOT NULL, -- Sportmonks player ID
  player_name TEXT NOT NULL,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  penalties INTEGER DEFAULT 0,
  minutes_played INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sportmonks_id, season_id)
);

-- Index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_top_scorers_season_goals ON top_scorers(season_id, goals DESC);
