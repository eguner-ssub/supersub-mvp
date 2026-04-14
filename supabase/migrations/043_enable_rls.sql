-- Migration 043: Enable Row Level Security on all tables
--
-- The app accesses the database exclusively through server-side Vercel
-- functions using the service_role key. The service role bypasses RLS
-- automatically — no explicit policies are needed for it.
--
-- Goal: ensure zero anon/public access to any table.
-- Statements are idempotent — enabling RLS on a table that already has it
-- enabled is a no-op in PostgreSQL (no error, no effect).

-- ── Core app tables ───────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS profiles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS matches                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS predictions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory                 ENABLE ROW LEVEL SECURITY;

-- ── SportMonks reference tables ───────────────────────────────────────────────
ALTER TABLE IF EXISTS leagues                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS seasons                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS teams                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fixtures                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS standings                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS top_scorers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS team_season_stats         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sportmonks_id_map         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reference_cache           ENABLE ROW LEVEL SECURITY;

-- ── Player / coaching analytics tables ───────────────────────────────────────
ALTER TABLE IF EXISTS player_squad_cache        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS player_stats_cache        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS player_supersub_stats     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS coaches                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS coach_substitution_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS team_bench_stats          ENABLE ROW LEVEL SECURITY;

-- ── Intel / content tables ────────────────────────────────────────────────────
ALTER TABLE IF EXISTS match_intel               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS news_intel                ENABLE ROW LEVEL SECURITY;

-- ── Leaderboard tables ────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS leaderboards              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS leaderboard_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_league_points        ENABLE ROW LEVEL SECURITY;

-- ── Operational / logging tables ─────────────────────────────────────────────
ALTER TABLE IF EXISTS sync_logs                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fpl_transfers             ENABLE ROW LEVEL SECURITY;

-- ── Analytics / affiliate tables ─────────────────────────────────────────────
ALTER TABLE IF EXISTS analytics_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS affiliate_events          ENABLE ROW LEVEL SECURITY;
