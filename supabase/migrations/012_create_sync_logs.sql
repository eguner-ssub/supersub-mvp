-- Planner Guard: one log row per service per day prevents redundant API calls
CREATE TABLE IF NOT EXISTS sync_logs (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  service TEXT NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enforce one log per service per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_logs_date_service ON sync_logs (date, service);
