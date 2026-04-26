# scripts/_archived

Inactive code retained for reference and possible future revival. Nothing
here is wired into the active codebase, and nothing should be imported from
active code paths.

## Why this exists

The Monte Carlo simulation pipeline (Phase 1, late 2026-04) was replaced
with a **SportMonks-only architecture**: SportMonks predictions are now the
single source of truth for per-match probabilities. The primary motivations
for the pivot:

1. **Editorial consistency.** The previous architecture had two independent
   sources for "most likely scoreline" — SportMonks correct-score predictions
   in `match_intel`, and our own Poisson Monte Carlo output in
   `match_simulations`. They almost always disagreed (Poisson under-weights
   high-scoring outcomes vs empirical models), and any UI surface that showed
   both at once looked broken. Surfaces have now converged on one source.
2. **Operational simplicity.** Two-stage sims (per-match → per-season) added
   a dependency chain (`sync-match-intel → sim:matches → sim:seasons`) that
   was easy to break by running scripts out of order. The new design has only
   one sim job: `sim:seasons` reads `match_intel.commandOfPitch.data` directly.
3. **Modeling fidelity.** SportMonks' correct-score model is empirically
   calibrated; our Poisson Monte Carlo treats goal events as independent and
   is provably less accurate for individual scoreline probabilities.

## What's archived here

| Path | Original purpose |
|---|---|
| `scripts/_archived/run-match-simulations.js` | Per-fixture Monte Carlo. Read SportMonks W/D/L from `match_intel.commandOfPitch`, calibrated Poisson lambdas via iterative search, ran 10k iterations, upserted to `match_simulations`. Also exported `simulateOne()` used as a post-hook in `sync-match-intel.js`. |
| `lib/_archived/simulation/engine.js` | Core simulator: `poissonSample`, `simulateMatch`, `calibrateLambdas`. Pure functions, no side effects. |
| `lib/_archived/simulation/engine.test.js` | 13 sanity tests (non-trivial — Poisson mean ≈ λ, scoreline distribution top-20, uncertainty bucketing via Shannon entropy). Outside vitest's `include` glob so doesn't run by default. |

The `match_simulations` Supabase table is **preserved**, not dropped. No
active reads or writes after the pivot. Schema kept for reference; can be
dropped manually after 30 days if storage is a concern.

## Related but NOT archived (still active)

- `season_probabilities` table — same schema, populated by the rewritten
  `scripts/run-season-simulations.js` which reads `match_intel.commandOfPitch`
  directly.
- `scripts/run-season-simulations.js` — still active; only the data source
  changed (no longer reads `match_simulations`).
- `lib/statsGen/handlers/match-probabilities.js` — still active; rewritten
  to read SportMonks predictions from `match_intel.report_sections`.

## Reactivation path (if you ever want to bring it back)

1. `git mv scripts/_archived/run-match-simulations.js scripts/run-match-simulations.js`
2. `git mv lib/_archived/simulation/ lib/simulation/`
3. Restore `package.json`'s `sim:matches` script entry.
4. Restore the `simulateOne` post-hook in `scripts/sync-match-intel.js`
   (look at git history for commit `f152d9f` and earlier).
5. Re-add the `match_simulations` lookup branch in
   `lib/statsGen/handlers/match-probabilities.js` (probably as a fallback
   below the SportMonks branch).
6. Re-add the per-fixture sim-row lookup in
   `scripts/run-season-simulations.js` (it can prefer Monte Carlo over the
   raw SportMonks W/D/L when a sim row exists).
7. Schedule a cron entry for `sim:matches` (`/api/cron?job=sim-matches`)
   if you want post-hook redundancy.
8. Decide what to do about the editorial inconsistency that triggered the
   pivot. Options were laid out in the bug-investigation thread that led
   to this archival.

## Don't import from here

Active code must not import from `scripts/_archived/` or `lib/_archived/`.
A grep guard in CI would catch regressions if needed:

```bash
grep -rn "from.*_archived\|require.*_archived" --include='*.js' --include='*.jsx' \
  src/ api/ scripts/ lib/ \
  | grep -v "^scripts/_archived/" | grep -v "^lib/_archived/"
# Should produce no output.
```
