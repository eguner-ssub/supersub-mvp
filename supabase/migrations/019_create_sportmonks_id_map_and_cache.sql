-- Sportmonks migration: ID bridge map and reference cache
-- sportmonks_id_map bridges API-Football IDs with new Sportmonks IDs
-- during the parallel run period (used by settle.js for both teams and fixtures)

CREATE TABLE IF NOT EXISTS sportmonks_id_map (
  internal_id UUID NOT NULL,
  entity_type VARCHAR(50) NOT NULL, -- 'team', 'fixture', etc.
  sportmonks_id INTEGER NOT NULL,
  api_football_id INTEGER,
  PRIMARY KEY (internal_id, entity_type)
);

CREATE INDEX IF NOT EXISTS idx_id_map_sportmonks ON sportmonks_id_map(entity_type, sportmonks_id);
CREATE INDEX IF NOT EXISTS idx_id_map_api_football ON sportmonks_id_map(entity_type, api_football_id)
  WHERE api_football_id IS NOT NULL;

-- Reference cache for Sportmonks state IDs, type IDs, etc.
-- Populated at startup so we never resolve them inline
CREATE TABLE IF NOT EXISTS reference_cache (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT NOW()
);
