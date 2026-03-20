-- 030: Add match_intel table for pre-match scouting reports

CREATE TABLE match_intel (
  match_id              INTEGER PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,

  -- Sportmonks raw data
  sportmonks_raw        JSONB,
  sportmonks_available  BOOLEAN DEFAULT false,
  sportmonks_fetched_at TIMESTAMPTZ,

  -- Our data snapshots (captured at generation time)
  home_bench_stats      JSONB,
  away_bench_stats      JSONB,
  home_coach_patterns   JSONB,
  away_coach_patterns   JSONB,
  home_top_supersubs    JSONB,
  away_top_supersubs    JSONB,

  -- Processed report sections (structured data)
  report_sections       JSONB,

  -- Generated prose
  prose                 JSONB,
  prose_method          TEXT DEFAULT 'template',

  -- Lifecycle
  generated_at          TIMESTAMPTZ DEFAULT NOW(),
  expires_at            TIMESTAMPTZ,

  CONSTRAINT valid_prose_method CHECK (prose_method IN ('template', 'llm'))
);

CREATE INDEX idx_match_intel_expires ON match_intel(expires_at);
CREATE INDEX idx_match_intel_generated ON match_intel(generated_at);
