-- Cache of Sportmonks head-to-head responses, keyed to the fixture that
-- triggered the fetch. Populated by scripts/sync-match-intel.js once per
-- upcoming match; 72h TTL enforced in application code, not here.
--
-- fixture_id is the UNIQUE upserted key; team1_id / team2_id are stored so
-- cached rows can be reused for any future meeting of the same pairing.
-- data holds the full response body as returned by Sportmonks.

CREATE TABLE IF NOT EXISTS h2h_cache (
  id         SERIAL      PRIMARY KEY,
  team1_id   INTEGER     NOT NULL,
  team2_id   INTEGER     NOT NULL,
  fixture_id INTEGER     NOT NULL,
  data       JSONB       NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(fixture_id)
);

CREATE INDEX IF NOT EXISTS h2h_cache_fixture_idx ON h2h_cache(fixture_id);
CREATE INDEX IF NOT EXISTS h2h_cache_teams_idx   ON h2h_cache(team1_id, team2_id);
