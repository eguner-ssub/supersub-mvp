-- Migration 027: Player squad and stats cache tables
-- Supports EPL now; adding more leagues later requires only a config change in sync-squads.js.

-- ── teams: add last_played_at ────────────────────────────────────────────────
-- Populated by sync-squads.js from the SportMonks /teams/seasons/{seasonId} response.
-- Used to skip re-syncing a team's squad when nothing has changed since the last run.
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS last_played_at TIMESTAMPTZ;

-- ── player_squad_cache ───────────────────────────────────────────────────────
-- One row per player. Reflects the player's current team and league assignment.
-- Uses SportMonks integer IDs throughout (not internal UUIDs) — this is a cache table.
CREATE TABLE IF NOT EXISTS player_squad_cache (
  player_id     INTEGER PRIMARY KEY,          -- SportMonks player ID
  player_name   TEXT    NOT NULL,
  team_id       INTEGER NOT NULL,             -- SportMonks team ID
  team_name     TEXT    NOT NULL,
  league_id     INTEGER NOT NULL,             -- SportMonks league ID (8=EPL, 9=Championship, …)
  season_id     INTEGER NOT NULL,             -- SportMonks season ID
  position_id   INTEGER,
  jersey_number INTEGER,
  image_path    TEXT,
  last_updated  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_squad_cache_team_id     ON player_squad_cache(team_id);
CREATE INDEX IF NOT EXISTS idx_squad_cache_league_id   ON player_squad_cache(league_id);
CREATE INDEX IF NOT EXISTS idx_squad_cache_player_name ON player_squad_cache(player_name);

-- ── player_stats_cache ───────────────────────────────────────────────────────
-- One row per player. Stores season-level stats (goals, assists, minutes, appearances).
-- raw_stats JSONB holds the full type-code→value map for forward compatibility.
CREATE TABLE IF NOT EXISTS player_stats_cache (
  player_id      INTEGER PRIMARY KEY,         -- SportMonks player ID (FK to player_squad_cache)
  season_id      INTEGER NOT NULL,            -- SportMonks season ID
  goals          INTEGER DEFAULT 0,
  assists        INTEGER DEFAULT 0,
  minutes_played INTEGER DEFAULT 0,
  appearances    INTEGER DEFAULT 0,
  raw_stats      JSONB,                       -- keyed by type.code, e.g. {"goals": 12, "assists": 4}
  last_updated   TIMESTAMPTZ DEFAULT now()
);
