-- Per-league/season coverage metadata for the season simulation.
-- Populated by scripts/run-season-simulations.js once per league at end of run.
--
-- Why a separate table from season_probabilities (which is per-team):
-- coverage is a single fact per (league, season). Putting it on every team
-- row would denormalise it 18-20× per league with no benefit.
--
-- Consumers: lib/statsGen/handlers/title-probabilities.js +
-- relegation-probabilities.js, which join this row into the API response so
-- the FE can render a "Limited Coverage — N of M fixtures sampled" badge.
-- Surfaces the prediction-window limitation honestly: SportMonks intel only
-- covers the next 14 days, so end-of-season fixtures are skipped.

CREATE TABLE IF NOT EXISTS season_simulation_coverage (
  league_id            integer       NOT NULL,
  season_id            integer       NOT NULL,
  remaining_fixtures   integer       NOT NULL,
  sampled_fixtures     integer       NOT NULL,
  skipped_fixtures     integer       NOT NULL,
  coverage_percentage  decimal(5,2)  NOT NULL,
  computed_at          timestamptz   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (league_id, season_id)
);
