-- Migration 028: Bench analytics — coaches, supersub stats, team bench stats, coach patterns

-- 1. coaches table
CREATE TABLE coaches (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL,
  common_name     TEXT,
  firstname       TEXT,
  lastname        TEXT,
  image_path      TEXT,
  date_of_birth   DATE,
  nationality_id  INTEGER,
  country_name    TEXT,
  current_team_id INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  last_updated    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_coaches_current_team ON coaches(current_team_id);
CREATE INDEX idx_coaches_last_updated ON coaches(last_updated);

-- 2. coach columns on matches
ALTER TABLE matches
  ADD COLUMN home_coach_id INTEGER REFERENCES coaches(id),
  ADD COLUMN away_coach_id INTEGER REFERENCES coaches(id);

-- 3. player_supersub_stats
CREATE TABLE player_supersub_stats (
  player_id              INTEGER NOT NULL,
  season_id              INTEGER NOT NULL,
  team_id                INTEGER NOT NULL,
  goals_as_sub           INTEGER DEFAULT 0,
  assists_as_sub         INTEGER DEFAULT 0,
  apps_as_sub            INTEGER DEFAULT 0,
  minutes_as_sub         INTEGER DEFAULT 0,
  goals_as_starter       INTEGER DEFAULT 0,
  assists_as_starter     INTEGER DEFAULT 0,
  apps_as_starter        INTEGER DEFAULT 0,
  minutes_as_starter     INTEGER DEFAULT 0,
  avg_sub_on_minute      DECIMAL(4,1),
  earliest_sub_on        INTEGER,
  latest_sub_on          INTEGER,
  avg_minutes_to_goal    DECIMAL(4,1),
  fastest_goal_after_sub INTEGER,
  last_updated           TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (player_id, season_id)
);
CREATE INDEX idx_player_supersub_team  ON player_supersub_stats(team_id, season_id);
CREATE INDEX idx_player_supersub_goals ON player_supersub_stats(goals_as_sub DESC);

-- 4. player_supersub_efficiency view
CREATE VIEW player_supersub_efficiency AS
SELECT
  pss.*,
  psc.player_name,
  psc.position_id,
  psc.image_path,
  psc.team_name,
  CASE WHEN pss.minutes_as_sub > 0
       THEN ROUND((pss.goals_as_sub::DECIMAL / pss.minutes_as_sub) * 90, 2)
       ELSE 0 END AS goals_per_90_as_sub,
  CASE WHEN pss.minutes_as_sub > 0
       THEN ROUND((pss.assists_as_sub::DECIMAL / pss.minutes_as_sub) * 90, 2)
       ELSE 0 END AS assists_per_90_as_sub,
  CASE WHEN pss.minutes_as_starter > 0
       THEN ROUND((pss.goals_as_starter::DECIMAL / pss.minutes_as_starter) * 90, 2)
       ELSE 0 END AS goals_per_90_as_starter,
  CASE WHEN pss.minutes_as_sub > 0 AND pss.minutes_as_starter > 0
       THEN ROUND(
         ((pss.goals_as_sub::DECIMAL / pss.minutes_as_sub) -
          (pss.goals_as_starter::DECIMAL / pss.minutes_as_starter)) * 90, 2)
       ELSE NULL END AS supersub_advantage
FROM player_supersub_stats pss
LEFT JOIN player_squad_cache psc ON pss.player_id = psc.player_id
  AND pss.season_id = psc.season_id;

-- 5. team_bench_stats
CREATE TABLE team_bench_stats (
  team_id                   INTEGER NOT NULL,
  season_id                 INTEGER NOT NULL,
  total_bench_goals         INTEGER DEFAULT 0,
  total_bench_assists       INTEGER DEFAULT 0,
  matches_played            INTEGER DEFAULT 0,
  matches_with_bench_goal   INTEGER DEFAULT 0,
  matches_with_bench_assist INTEGER DEFAULT 0,
  total_subs_made           INTEGER DEFAULT 0,
  avg_first_sub_minute      DECIMAL(4,1),
  avg_second_sub_minute     DECIMAL(4,1),
  avg_third_sub_minute      DECIMAL(4,1),
  subs_before_60            INTEGER DEFAULT 0,
  subs_60_to_75             INTEGER DEFAULT 0,
  subs_after_75             INTEGER DEFAULT 0,
  subs_off_gk               INTEGER DEFAULT 0,
  subs_off_def              INTEGER DEFAULT 0,
  subs_off_mid              INTEGER DEFAULT 0,
  subs_off_fwd              INTEGER DEFAULT 0,
  subs_on_gk                INTEGER DEFAULT 0,
  subs_on_def               INTEGER DEFAULT 0,
  subs_on_mid               INTEGER DEFAULT 0,
  subs_on_fwd               INTEGER DEFAULT 0,
  subs_while_winning        INTEGER DEFAULT 0,
  subs_while_drawing        INTEGER DEFAULT 0,
  subs_while_losing         INTEGER DEFAULT 0,
  wins_total                INTEGER DEFAULT 0,
  wins_with_bench_goal      INTEGER DEFAULT 0,
  last_updated              TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (team_id, season_id)
);
CREATE INDEX idx_team_bench_season ON team_bench_stats(season_id);

-- 6. team_bench_potential view
CREATE VIEW team_bench_potential AS
SELECT
  tbs.*,
  CASE WHEN tbs.matches_played > 0
       THEN ROUND(tbs.total_subs_made::DECIMAL / tbs.matches_played, 1)
       ELSE 0 END AS avg_subs_per_match,
  CASE WHEN tbs.matches_played > 0
       THEN ROUND(tbs.total_bench_goals::DECIMAL / tbs.matches_played, 2)
       ELSE 0 END AS bench_goals_per_match,
  CASE WHEN tbs.matches_played > 0
       THEN ROUND(tbs.matches_with_bench_goal::DECIMAL / tbs.matches_played * 100, 1)
       ELSE 0 END AS bench_goal_pct,
  CASE WHEN tbs.total_subs_made > 0
       THEN ROUND(tbs.total_bench_goals::DECIMAL / tbs.total_subs_made * 100, 1)
       ELSE 0 END AS goal_per_sub_pct
FROM team_bench_stats tbs;

-- 7. coach_substitution_patterns
CREATE TABLE coach_substitution_patterns (
  coach_id                  INTEGER NOT NULL REFERENCES coaches(id),
  season_id                 INTEGER NOT NULL,
  team_id                   INTEGER NOT NULL,
  matches_managed           INTEGER DEFAULT 0,
  total_subs_made           INTEGER DEFAULT 0,
  avg_first_sub_minute      DECIMAL(4,1),
  avg_second_sub_minute     DECIMAL(4,1),
  avg_third_sub_minute      DECIMAL(4,1),
  earliest_first_sub        INTEGER,
  subs_before_60            INTEGER DEFAULT 0,
  subs_60_to_75             INTEGER DEFAULT 0,
  subs_after_75             INTEGER DEFAULT 0,
  halftime_subs             INTEGER DEFAULT 0,
  early_subs                INTEGER DEFAULT 0,
  reactive_subs_losing      INTEGER DEFAULT 0,
  protective_subs_winning   INTEGER DEFAULT 0,
  subs_off_gk               INTEGER DEFAULT 0,
  subs_off_def              INTEGER DEFAULT 0,
  subs_off_mid              INTEGER DEFAULT 0,
  subs_off_fwd              INTEGER DEFAULT 0,
  subs_on_gk                INTEGER DEFAULT 0,
  subs_on_def               INTEGER DEFAULT 0,
  subs_on_mid               INTEGER DEFAULT 0,
  subs_on_fwd               INTEGER DEFAULT 0,
  bench_goals               INTEGER DEFAULT 0,
  bench_assists             INTEGER DEFAULT 0,
  matches_with_bench_goal   INTEGER DEFAULT 0,
  wins_total                INTEGER DEFAULT 0,
  wins_with_early_sub       INTEGER DEFAULT 0,
  wins_with_bench_goal      INTEGER DEFAULT 0,
  last_updated              TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (coach_id, season_id)
);
CREATE INDEX idx_coach_patterns_team ON coach_substitution_patterns(team_id, season_id);

-- 8. coach_substitution_style view
CREATE VIEW coach_substitution_style AS
SELECT
  csp.*,
  c.name          AS coach_name,
  c.common_name,
  c.image_path    AS coach_image,
  CASE
    WHEN csp.avg_first_sub_minute < 55 THEN 'early'
    WHEN csp.avg_first_sub_minute > 70 THEN 'late'
    ELSE 'standard'
  END AS sub_timing_style,
  CASE WHEN csp.matches_managed > 0
       THEN ROUND(csp.total_subs_made::DECIMAL / csp.matches_managed, 1)
       ELSE 0 END AS avg_subs_per_match,
  CASE WHEN csp.matches_managed > 0
       THEN ROUND(csp.matches_with_bench_goal::DECIMAL / csp.matches_managed * 100, 1)
       ELSE 0 END AS bench_goal_pct,
  CASE WHEN csp.total_subs_made > 0
       THEN ROUND(
         (csp.subs_before_60::DECIMAL / csp.total_subs_made * 100) +
         (csp.halftime_subs::DECIMAL / csp.total_subs_made * 50), 1)
       ELSE 0 END AS sub_aggression_score
FROM coach_substitution_patterns csp
LEFT JOIN coaches c ON csp.coach_id = c.id;
