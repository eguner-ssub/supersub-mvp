-- Migration 000b: Create matches table
--
-- matches was created manually on production before the migration chain began.
-- This file bootstraps it for new environments so that migration 003 onward
-- can ALTER TABLE matches without error.
--
-- Schema reconstructed from:
--   • migrations 003–042 — every ADD COLUMN / ALTER COLUMN reveals what was
--     NOT in the original table; everything else was
--   • backfill-sportmonks.js — writes id, league_id, home/away team fields,
--     home_score, away_score, kickoff_time, last_updated, home_team_id, away_team_id
--   • api/matches.js — reads events, lineups from matches (never added by any migration)
--   • migration 002 — predictions.match_id INT references matches(id) so id is INTEGER
--   • migration 042 — casts kickoff_time TEXT → TIMESTAMPTZ, so original type is TEXT

CREATE TABLE IF NOT EXISTS matches (
    id              INTEGER     PRIMARY KEY,         -- Sportmonks fixture ID
    league_id       INTEGER,
    home_team       TEXT,
    away_team       TEXT,
    home_team_id    INTEGER,                         -- Sportmonks team ID
    away_team_id    INTEGER,                         -- Sportmonks team ID
    home_score      INTEGER     NOT NULL DEFAULT 0,
    away_score      INTEGER     NOT NULL DEFAULT 0,
    status          TEXT,
    kickoff_time    TEXT,                            -- cast to TIMESTAMPTZ in migration 042
    events          JSONB       DEFAULT NULL,
    lineups         JSONB       DEFAULT NULL,
    odds            JSONB       DEFAULT NULL,
    last_updated    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_league_id ON matches (league_id);
