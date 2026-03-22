-- News Intel: stores parsed RSS articles tagged to EPL teams
CREATE TABLE news_intel (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT        NOT NULL,
  summary      TEXT,
  url          TEXT        UNIQUE NOT NULL,  -- deduplication key
  source       TEXT,                         -- 'BBC', 'Sky Sports', 'The Guardian'
  team_id      UUID        REFERENCES teams(id),
  league_id    INTEGER,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_news_intel_team      ON news_intel(team_id)    WHERE team_id   IS NOT NULL;
CREATE INDEX idx_news_intel_league    ON news_intel(league_id)  WHERE league_id IS NOT NULL;
CREATE INDEX idx_news_intel_published ON news_intel(published_at DESC);
CREATE INDEX idx_news_intel_created   ON news_intel(created_at  DESC);
