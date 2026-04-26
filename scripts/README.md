# scripts/

Operator scripts for sync, backfill, and season simulation. All scripts
load `.env` then `.env.local` (override-safe) and require
`SUPABASE_SERVICE_ROLE_KEY` + `SPORTMONKS_API_TOKEN` (the season simulation
script doesn't need the SportMonks token — it reads locally from match_intel).

## Sync scripts

| Script | npm alias | Purpose |
|---|---|---|
| `sync-match-intel.js` | — | Pulls SportMonks predictions for upcoming matches, merges with internal bench/coach analytics, generates editorial prose, upserts to `match_intel`. (No simulation post-hook as of 2026-04 — see "Architecture" below.) |
| `sync-standings.js` | — | Per-league standings + top scorers from SportMonks. Writes home/away breakdown columns. Lazy-refreshed via `api/league.js` (3h TTL) and at the start of each `sim:seasons` league iteration. |
| `sync-referee-stats.js` | `npm run sync:referees` | Aggregates referee stats from `matches.raw_data.referees` + `matches.events`. |
| `backfill-matches-full.js` | — | Full season backfill of fixtures across all 5 leagues. Reads metadata.type include for `LINEUP_CONFIRMED` flag. |
| `backfill-referee-data.js` | — | One-off: pulls `referees` include for completed matches. Idempotent. |

## Simulation scripts

| Script | npm alias | Purpose |
|---|---|---|
| `run-season-simulations.js` | `npm run sim:seasons` | Per-league season simulation. For each remaining fixture, samples 10,000 outcomes from SportMonks W/D/L predictions read directly from `match_intel.report_sections.commandOfPitch.data`. Aggregates title / top-4 / relegation / expected final points. Upserts `season_probabilities`. Fixtures without intel are skipped (no fallback) — coverage improves as the 14-day intel window rolls forward. |

### Archived: per-match Monte Carlo (`run-match-simulations.js`)

Moved to `scripts/_archived/run-match-simulations.js` in 2026-04. The
two-stage Monte Carlo pipeline (per-match → per-season) was replaced by
SportMonks predictions as the single source of truth — see the README in
that directory for context, related files, and revival path.

## Cron schedule

Document only — set in cron-job.org (Vercel Hobby caps Vercel-native cron at daily).

| Cadence | Job | Endpoint / command | Notes |
|---|---|---|---|
| Every 4h (`0 */4 * * *`) | `sync-match-intel` | `POST /api/cron?job=sync-match-intel` | Catches new fixtures + intel staleness within the 14-day window. |
| Daily 02:00 UTC | `sim:seasons` | `npm run sim:seasons` | Refreshes standings per league (preflight) then samples season trajectories from intel. |
| Daily 06:00 | `sync-fpl` | Vercel-native cron in `vercel.json` | FPL trending players. |

The `sim:matches` cron entry was removed in 2026-04. If a `cron-job.org`
schedule still points at `?job=sim-matches`, it now returns 400 (`Unknown
job`) on every run — delete it.

**Run order:** `sync-match-intel` → `sim:seasons`. The season sim reads
`match_intel.commandOfPitch.data` directly; if intel hasn't been refreshed
recently, the sim under-counts remaining fixtures rather than failing.
Logs flag the skip count clearly.

## Manual operations

- **Local backfill** when scheduled cron is behind:
  ```bash
  node scripts/sync-match-intel.js   # repeat until "0 need refresh"
  npm run sim:seasons
  ```
- **One-off scripts** that have already done their job (kept for re-runnability):
  - `reparse-lineup-confirmed.js` — re-parse stored raw_data.metadata for the LINEUP_CONFIRMED flag without hitting SportMonks
  - `backfill-referee-data.js` — pull historical referee data into raw_data

## Architecture

**Match prediction architecture (as of 2026-04): SportMonks predictions are
the single source of truth.** All probability surfaces — `/api/intel`,
`/api/stats-gen/match-probabilities`, `sim:seasons` — read from
`match_intel.report_sections`. The previous Monte Carlo pipeline (Poisson
calibration from W/D/L → 10k iterations → `match_simulations` table) is
archived in `scripts/_archived/`.

The `match_simulations` Supabase table is preserved as inert schema. Drop
manually after 30 days if storage is a concern.
