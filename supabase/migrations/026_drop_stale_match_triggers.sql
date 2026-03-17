-- Migration 026: Drop stale API-Football era match-update triggers
--
-- Three triggers on the matches table fired on every UPDATE and attempted
-- to sync predictions.status using old API-Football status codes (1H, 2H,
-- FT, PST, CANC, ABD). They are broken for two reasons:
--
--   1. SportMonks uses different status codes (INPLAY_1ST_HALF, FT_PEN, etc.)
--      so the LIVE/SETTLED transitions silently matched nothing.
--   2. handle_match_sync_automation and handle_match_update_automation tried
--      to set predictions.status = 'CANCELLED', violating the valid_status
--      constraint added in migration 025 ('PENDING', 'LIVE', 'SETTLED').
--
-- The associated functions perform_automated_payouts() and
-- settle_all_predictions() no longer exist in the schema and would crash
-- on any FT match update anyway.
--
-- Settlement is handled correctly by the cron job (api/settle.js).
-- These triggers are fully redundant and must be removed.

-- ── Drop triggers ─────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_match_status_update              ON matches;
DROP TRIGGER IF EXISTS on_match_update_sync                ON matches;
DROP TRIGGER IF EXISTS tr_sync_predictions_on_match_update ON matches;

-- ── Drop orphaned trigger functions ──────────────────────────────────────────
DROP FUNCTION IF EXISTS handle_match_update_automation();
DROP FUNCTION IF EXISTS handle_match_sync_automation();
DROP FUNCTION IF EXISTS update_prediction_status_from_match();
