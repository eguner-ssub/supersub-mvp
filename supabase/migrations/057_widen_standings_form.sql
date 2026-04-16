-- Widen standings.form to hold a full season's W/L/D sequence.
--
-- The original column was VARCHAR(10) — sized for a rolling "last N" window.
-- The upstream Sportmonks `form` include actually returns every game played
-- this season (up to ~42 chars for league play; more if we ever include
-- cup ties). Since sync-standings now persists the full chronological
-- string (template consumers still take .slice(-5) for display), the
-- 10-char cap blew up with "value too long for type character varying(10)".
--
-- VARCHAR(50) covers the longest expected league season with headroom.

ALTER TABLE standings
  ALTER COLUMN form TYPE VARCHAR(50);
