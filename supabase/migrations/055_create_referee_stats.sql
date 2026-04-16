-- Per-referee aggregates for a given (season, league). Populated by the
-- batch script scripts/sync-referee-stats.js from matches.raw_data.referees
-- and matches.events. No Sportmonks API calls happen here — historical data
-- is re-aggregated from whatever has already flowed into the matches table.

CREATE TABLE IF NOT EXISTS referee_stats (
  id                  SERIAL      PRIMARY KEY,
  referee_id          INTEGER     NOT NULL,
  referee_name        TEXT        NOT NULL,
  season_id           INTEGER     NOT NULL,
  league_id           INTEGER     NOT NULL,
  matches_officiated  INTEGER     DEFAULT 0,
  total_goals         INTEGER     DEFAULT 0,
  total_yellow_cards  INTEGER     DEFAULT 0,
  total_red_cards     INTEGER     DEFAULT 0,
  total_penalties     INTEGER     DEFAULT 0,
  over_2_5_count      INTEGER     DEFAULT 0,
  recent_fixtures     JSONB       DEFAULT '[]',
  last_synced_at      TIMESTAMPTZ,
  UNIQUE(referee_id, season_id, league_id)
);

CREATE INDEX IF NOT EXISTS referee_stats_referee_idx ON referee_stats(referee_id);
