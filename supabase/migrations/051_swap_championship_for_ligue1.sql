-- Migration 051: Swap English Championship (SportMonks league_id=9) for Ligue 1 (SportMonks league_id=301)
-- Ligue 1 current season: 25651 (2025/2026)
--
-- Deletion order respects FK dependencies:
--   predictions → matches (CASCADE), match_intel (CASCADE), affiliate_events (no FK)
--   user_league_points → leagues (manual, composite PK includes league_id)
--   standings → seasons → leagues
--   player_stats_cache → player_squad_cache → (independent)
--   teams → only if not shared with other supported leagues

-- 1. Delete news_intel rows for Championship
DELETE FROM news_intel WHERE league_id = 9;

-- 2. Delete affiliate_events for Championship matches (no FK — must be manual)
DELETE FROM affiliate_events
WHERE match_id IN (SELECT id FROM matches WHERE league_id = 9);

-- 3. Delete user_league_points for Championship
--    (composite PK includes league_id; must go before leagues row is removed)
DELETE FROM user_league_points
WHERE league_id = 9;

-- 4. Delete predictions for Championship
--    (also covered by ON DELETE CASCADE from matches, but explicit delete
--     avoids relying on cascade ordering and clears league_id=9 rows directly)
DELETE FROM predictions WHERE league_id = 9;

-- 5. Delete player_stats_cache for Championship players
--    (must run before player_squad_cache is cleared)
DELETE FROM player_stats_cache
WHERE player_id IN (
  SELECT player_id FROM player_squad_cache WHERE league_id = 9
);

-- 6. Delete player_squad_cache for Championship
DELETE FROM player_squad_cache WHERE league_id = 9;

-- 7. Delete standings for Championship seasons
DELETE FROM standings
WHERE season_id IN (
  SELECT id FROM seasons
  WHERE league_id = (SELECT id FROM leagues WHERE sportmonks_id = 9)
);

-- 8. Delete matches for Championship (cascades to predictions, match_intel)
DELETE FROM matches WHERE league_id = 9;

-- 9. Delete Championship-only teams
--    (safe guard: only delete teams not referenced by any remaining match)
DELETE FROM teams
WHERE sportmonks_id IN (
  SELECT DISTINCT home_team_id FROM matches WHERE league_id = 9
  UNION
  SELECT DISTINCT away_team_id FROM matches WHERE league_id = 9
)
AND sportmonks_id NOT IN (
  SELECT DISTINCT home_team_id FROM matches WHERE league_id != 9
  UNION
  SELECT DISTINCT away_team_id FROM matches WHERE league_id != 9
);

-- 10. Delete seasons for Championship
DELETE FROM seasons
WHERE league_id = (SELECT id FROM leagues WHERE sportmonks_id = 9);

-- 11. Delete Championship league row
DELETE FROM leagues WHERE sportmonks_id = 9;

-- 12. Insert Ligue 1
INSERT INTO leagues (sportmonks_id, name, country)
VALUES (301, 'Ligue 1', 'France')
ON CONFLICT DO NOTHING;
