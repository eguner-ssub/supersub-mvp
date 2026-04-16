-- Extend standings with home/away breakdown, populated by sync-standings.js
-- from Sportmonks detail type_ids 135-146 + 185-186. The overall aggregates
-- (played, won, drawn, lost, goals_for, goals_against, points) remain the
-- canonical row-level stats; these new columns power features like the
-- "Fortress" endpoint that rank teams by their home record alone.
--
-- Detail type_id mapping, from /v3/core/types:
--   135 home-matches-played     141 away-matches-played
--   136 home-won                 142 away-won
--   137 home-draw                143 away-draw
--   138 home-lost                144 away-lost
--   139 home-scored              145 away-scored
--   140 home-conceded            146 away-conceded
--   185 home-points              186 away-points

ALTER TABLE standings
  ADD COLUMN IF NOT EXISTS home_matches_played INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS home_won             INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS home_drawn           INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS home_lost            INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS home_goals_for       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS home_goals_against   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS home_points          INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS away_matches_played  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS away_won             INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS away_drawn           INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS away_lost            INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS away_goals_for       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS away_goals_against   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS away_points          INTEGER DEFAULT 0;
