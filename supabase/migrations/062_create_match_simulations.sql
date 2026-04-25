-- Per-fixture Monte Carlo simulation results.
-- Populated by scripts/run-match-simulations.js + a post-hook in
-- scripts/sync-match-intel.js. Reads inputs from match_intel
-- (Sportmonks W/D/L probabilities), calibrates Poisson lambdas,
-- runs 10k iterations, stores aggregates + top-20 scoreline distribution.

CREATE TABLE IF NOT EXISTS match_simulations (
  fixture_id              INTEGER       PRIMARY KEY,
  home_team_id            INTEGER       NOT NULL,
  away_team_id            INTEGER       NOT NULL,
  league_id               INTEGER       NOT NULL,
  season_id               INTEGER       NOT NULL,
  home_win_probability    DECIMAL(5,4)  NOT NULL,
  draw_probability        DECIMAL(5,4)  NOT NULL,
  away_win_probability    DECIMAL(5,4)  NOT NULL,
  over_2_5_probability    DECIMAL(5,4)  NOT NULL,
  under_2_5_probability   DECIMAL(5,4)  NOT NULL,
  over_3_5_probability    DECIMAL(5,4)  NOT NULL,
  btts_probability        DECIMAL(5,4)  NOT NULL,
  expected_home_goals     DECIMAL(4,2)  NOT NULL,
  expected_away_goals     DECIMAL(4,2)  NOT NULL,
  expected_total_goals    DECIMAL(4,2)  NOT NULL,
  -- top 20 most-frequent scorelines: [{score: "2-1", probability: 0.124, count: 1240}, ...]
  scoreline_distribution  JSONB         NOT NULL,
  -- 'low' | 'moderate' | 'high' — Shannon entropy of (home_win, draw, away_win)
  uncertainty_level       TEXT          NOT NULL,
  simulation_count        INTEGER       DEFAULT 10000,
  inputs_source           TEXT          DEFAULT 'sportmonks_baseline',
  computed_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS match_simulations_league_idx ON match_simulations(league_id, season_id);
CREATE INDEX IF NOT EXISTS match_simulations_computed_idx ON match_simulations(computed_at);
