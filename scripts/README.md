# scripts/

Operator scripts for sync, backfill, and Monte Carlo simulation. All scripts
load `.env` then `.env.local` (override-safe) and require
`SUPABASE_SERVICE_ROLE_KEY` + `SPORTMONKS_API_TOKEN` (the simulation scripts
don't need the SportMonks token — they read locally from match_intel).

## Sync scripts

| Script | npm alias | Purpose |
|---|---|---|
| `sync-match-intel.js` | — | Pulls SportMonks predictions for upcoming matches, merges with internal bench/coach analytics, generates editorial prose, upserts to `match_intel`. Triggers `simulateOne()` per fixture as a post-hook so `match_simulations` stays in lockstep. |
| `sync-standings.js` | — | Per-league standings + top scorers from SportMonks. Writes home/away breakdown columns. |
| `sync-referee-stats.js` | `npm run sync:referees` | Aggregates referee stats from `matches.raw_data.referees` + `matches.events`. |
| `backfill-matches-full.js` | — | Full season backfill of fixtures across all 5 leagues. Reads metadata.type include for `LINEUP_CONFIRMED` flag. |
| `backfill-referee-data.js` | — | One-off: pulls `referees` include for completed matches. Idempotent. |

## Simulation scripts (Phase 1)

| Script | npm alias | Purpose |
|---|---|---|
| `run-match-simulations.js` | `npm run sim:matches` | Per-fixture Monte Carlo. Reads SportMonks W/D/L from `match_intel.report_sections`, calibrates Poisson lambdas, runs 10k iterations, upserts `match_simulations`. |
| `run-season-simulations.js` | `npm run sim:seasons` | Per-league season Monte Carlo. Reads remaining-fixture distributions from `match_simulations`, samples 10k seasons on top of current standings, upserts `season_probabilities`. |

## Cron schedule

Document only — set in cron-job.org (Vercel Hobby caps Vercel-native cron at daily).

| Cadence | Job | Endpoint / command | Notes |
|---|---|---|---|
| Every 4h (`0 */4 * * *`) | `sync-match-intel` | `POST /api/cron?job=sync-match-intel` | Catches new fixtures + intel staleness within the 14-day window. Post-hook auto-runs `simulateOne()` per processed fixture so `match_simulations` is fresh after every intel write. |
| Every 6h | `sim:matches` | `npm run sim:matches` (or `/api/cron?job=sim-matches` if added) | Catches any fixtures whose intel was written without the post-hook (e.g. failure path). Idempotent. |
| Daily 02:00 UTC | `sim:seasons` | `npm run sim:seasons` | Must run AFTER `sim:matches` — depends on fresh per-match results. |
| Daily 06:00 | `sync-fpl` | Vercel-native cron in `vercel.json` | FPL trending players. |

**Run order matters.** The dependency chain is:

```
sync-match-intel  →  sim:matches  →  sim:seasons
(SportMonks)         (per-fixture)    (per-team season)
```

If you run them out of order, the season sim falls back on stale per-match
distributions or skips fixtures it can't find. Both scripts log clearly
when they hit gaps, so it's diagnosable.

## Manual operations

- **Local backfill** when scheduled cron is behind:
  ```bash
  node scripts/sync-match-intel.js   # repeat until "0 need refresh"
  npm run sim:matches
  npm run sim:seasons
  ```
- **Single-fixture refresh** (after editing intel manually or recovering from a
  failed sync):
  ```bash
  node scripts/run-match-simulations.js --fixture=19427723
  ```
- **One-off scripts** that have already done their job (kept for re-runnability):
  - `reparse-lineup-confirmed.js` — re-parse stored raw_data.metadata for the LINEUP_CONFIRMED flag without hitting SportMonks
  - `backfill-referee-data.js` — pull historical referee data into raw_data
