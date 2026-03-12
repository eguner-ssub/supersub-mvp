-- Sportmonks migration: leagues and seasons tables
-- Part of Sportmonks v3 migration

CREATE TABLE IF NOT EXISTS leagues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sportmonks_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  country TEXT,
  current_season_id UUID, -- FK added after seasons table exists
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sportmonks_id INTEGER UNIQUE NOT NULL,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Now that seasons exists, add the FK from leagues.current_season_id
ALTER TABLE leagues
  ADD CONSTRAINT fk_leagues_current_season
  FOREIGN KEY (current_season_id) REFERENCES seasons(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX idx_seasons_league_id ON seasons(league_id);
CREATE INDEX idx_seasons_is_current ON seasons(is_current) WHERE is_current = TRUE;
