-- Add a flag tracking whether the lineups Sportmonks gave us are the official
-- confirmed XI (~1h pre-kickoff) or the predicted/probable XI from earlier.
--
-- Source: Sportmonks fixture metadata array contains an entry shaped like
--   { developer_name: 'LINEUP_CONFIRMED', values: { confirmed: true } }
-- once the team sheets are released. Until then the entry is missing or
-- `confirmed: false`. We surface that as a per-match boolean so the UI can
-- swap "PREDICTED XI" for "CONFIRMED XI" without re-parsing JSON client-side.
--
-- Default false because the vast majority of historical rows pre-date the
-- backfill change that writes this column, and "predicted" is the safer
-- assumption for any row we haven't refreshed yet.

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS lineup_confirmed BOOLEAN DEFAULT false;
