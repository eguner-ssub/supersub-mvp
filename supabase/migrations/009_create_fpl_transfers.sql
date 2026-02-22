-- =============================================
-- 009: Create fpl_transfers table
-- FPL Market Trends — top player transfers
-- =============================================

CREATE TABLE IF NOT EXISTS fpl_transfers (
  player_id           INT PRIMARY KEY,
  web_name            TEXT NOT NULL,
  team_name           TEXT NOT NULL,
  now_cost            NUMERIC(5,1) NOT NULL,
  transfers_in_event  BIGINT NOT NULL,
  form                NUMERIC(4,1),
  total_points        INT,
  photo_url           TEXT,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Index for common query: order by trending transfers
CREATE INDEX IF NOT EXISTS idx_fpl_transfers_trending
  ON fpl_transfers (transfers_in_event DESC);
