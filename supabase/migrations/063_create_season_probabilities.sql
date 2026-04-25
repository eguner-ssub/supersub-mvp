-- Season-end title / top-4 / relegation probabilities per team.
-- Populated by scripts/run-season-simulations.js — runs 10k Monte Carlo
-- simulations of all remaining fixtures (sampling outcomes from
-- match_simulations) on top of current standings.
--
-- For Championship (league_id 9), 'relegation' = bottom-3 finish even
-- though only 2 are auto-relegated (one playoff). Same metric semantics
-- across all leagues for consistency.

CREATE TABLE IF NOT EXISTS season_probabilities (
  league_id               INTEGER       NOT NULL,
  season_id               INTEGER       NOT NULL,
  team_id                 INTEGER       NOT NULL,
  team_name               TEXT          NOT NULL,
  team_logo               TEXT,
  current_position        INTEGER,
  current_points          INTEGER,
  expected_final_points   DECIMAL(5,2)  NOT NULL,
  title_probability       DECIMAL(5,4)  NOT NULL,
  top_4_probability       DECIMAL(5,4)  NOT NULL,
  relegation_probability  DECIMAL(5,4)  NOT NULL,
  computed_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (league_id, season_id, team_id)
);
