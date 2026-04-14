# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server (port 5173); proxies /api/* to localhost:3000
npm run build        # Production build → dist/
npm run lint         # ESLint check (no auto-fix)
npm test             # Vitest (jsdom + node envs)
npm run test:ui      # Vitest UI dashboard
npm run test:coverage

# Run a single test file
npx vitest run api/__tests__/matches.test.js

# E2E tests (requires dev server running)
npx playwright test
```

**Utility scripts** (run with `node scripts/<name>.js`):
- `backfill-sportmonks.js` — fetch and store SportMonks fixture data
- `seed-reference-cache.js` — populate `reference_cache` table
- `sync-standings.js` — sync standings from SportMonks
- `settle.js` — trigger bet settlement engine

## Architecture

### Request Flow

```
React SPA (src/) → /api/* Vercel serverless → Supabase PostgreSQL ← SportMonks v3 API
```

### Frontend (`src/`)

- **`shared/context/GameContext.jsx`** — single global state atom: auth, profile, inventory, betting state. Access with `useGame()`.
- **`shared/hooks/usePredictions.js`** — Supabase Realtime subscription to predictions table; used on match detail pages.
- **`utils/settlementEngine.js`** — resolves bet outcomes for all 4 card types.
- **`utils/cardConfig.js`** — single source of truth for card types (`MATCH_RESULT`, `TOTAL_GOALS`, `PLAYER_SCORE`, `SUPERSUB`), states, icons, and Tailwind classes.
- **`shared/config/coverage.js`** — canonical league ID mappings (EPL=39, Championship=40, Bundesliga=78, Serie A=135, Liga Portugal=94).

Pages live in `src/pages/` (auth, dashboard, training) and feature modules in `src/features/` (match-day, locker-room, office, inventory, debug). Routes are defined in `App.jsx` with a `ProtectedRoute` wrapper.

### API Layer (`api/`)

Vercel serverless functions. Pattern: lazy Supabase client initialization inside the handler (not at module top level) to avoid crashes on missing env vars.

| Endpoint | Purpose |
|----------|---------|
| `GET /api/matches?date=YYYY-MM-DD` | Matches for a date, filtered to supported leagues |
| `GET /api/matches?id=<id>` | Single fixture |
| `GET /api/events?fixture=<id>` | Goals/subs from `matches.events` JSON column |
| `GET /api/lineups?fixture=<id>` | Starters/subs from `matches.lineups` JSON column |
| `GET /api/odds/sportmonks?fixture=<id>` | Pre-match odds from SportMonks (markets 1, 8, 80) |

API handlers always return JSON (never HTML), even on error.

### Database (`supabase/migrations/`)

43 migrations. Key tables:
- `profiles` — user data (energy, coins, ads_watched)
- `predictions` — bets (status: PENDING/LIVE/WON/LOST)
- `matches` — fixtures with `events`, `lineups`, `odds` JSON columns
- `inventory` — card ownership (user_id, card_id, count)
- SportMonks tables: `leagues`, `seasons`, `teams`, `fixtures`, `standings`, `sportmonks_id_map`, `reference_cache`

RLS is enabled on all user-facing tables. Complex DB operations use RPC functions (`settle_prediction`, `watch_ad_reward`).

### Testing

Vitest config (`vite.config.js`):
- `api/__tests__/**` runs in Node environment (Supabase mocked)
- `src/tests/integration/**` runs in jsdom environment
- Playwright targets mobile viewports (iPhone 13 Pro, Pixel 5) against `localhost:5173`

### Environment Variables

```
SUPABASE_URL              # Exposed to client via Vite
SUPABASE_ANON_KEY         # Exposed to client via Vite
SUPABASE_SERVICE_ROLE_KEY # Server-side only (never in client bundle)
SPORTMONKS_API_TOKEN      # SportMonks v3
SITE_PASSWORD             # Basic auth gate (disabled if unset)
```

### Deployment

Vercel with SPA routing rewrites in `vercel.json`. `middleware.js` enforces basic auth using `SITE_PASSWORD`. Build output goes to `dist/`.

### Environments

Branch model:
```
feature/* → staging → main
```
- `main` — production Vercel deployment, production Supabase project
- `staging` — staging Vercel deployment, staging Supabase project
- `feature/*` — local development; PRs open against `staging`

Environment variables per environment (set in Vercel project settings):

| Variable | Production | Staging |
|---|---|---|
| `SUPABASE_URL` | prod project URL | staging project URL |
| `SUPABASE_ANON_KEY` | prod anon key | staging anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | prod service role key | staging service role key |
| `SPORTMONKS_API_TOKEN` | shared | shared |
| `CRON_SECRET` | prod secret | staging secret |
| `SITE_PASSWORD` | set (gated) | set (gated) |

**Bootstrapping a new staging database:**

```bash
# 1. Get the PostgreSQL connection string from Supabase Dashboard
#    → Project Settings → Database → Connection string (URI mode)

# 2. Run all 43 migrations in order against the staging DB
DATABASE_URL=postgresql://postgres.xxxx:password@... node scripts/run-migrations.js

# 3. After bootstrap, normal migration workflow resumes via the CLI
supabase db push
```

After bootstrap, `supabase db push` will report "No migrations to apply" because `run-migrations.js` records each migration in `supabase_migrations.schema_migrations`.
