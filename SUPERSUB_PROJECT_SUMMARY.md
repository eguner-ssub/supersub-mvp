# Supersub — Project Summary for Business Handover

## What Is Supersub?

Supersub is a **mobile-first football prediction game** where users play as a virtual football manager. The core mechanic revolves around **prediction cards** — users spend cards from their inventory to place bets on real match outcomes across Europe's top football leagues. The signature feature is the **Supersub card**, which lets users bet on substitute players scoring or assisting — a unique angle that no mainstream betting or fantasy platform focuses on.

The product is currently a **proof-of-concept (POC)** deployed at **supersub.mobi**, built as a React SPA with Vercel serverless functions and a Supabase (PostgreSQL) backend. Data comes from the **Sportmonks v3 API** for fixtures, lineups, odds, and player stats.

---

## Product Concept & User Journey

### Onboarding
New users land on an **interactive tutorial** set during the iconic 1999 Champions League Final (Man Utd vs Bayern Munich). They experience the full game loop — viewing a match, browsing the bench, tapping a "Supersub" card on Ole Gunnar Solskjær, confirming the bet, then watching the famous 93rd-minute goal play out. This teaches the mechanics through a real historical moment before prompting signup.

### Core Loop
1. **Manager Office** — The user's home base. A visual room with interactive hotspots: a laptop (opens League Hub), a tablet (match day), training equipment, etc.
2. **Match Hub** — Browse today's fixtures across 5 leagues. Tap a match to see pre-match intel, lineups, odds, and bench analysis.
3. **Place Predictions** — Use one of 4 card types to make a prediction. Each card is consumed from inventory.
4. **Settlement** — After matches finish, predictions are automatically settled. Points are awarded for correct calls.
5. **Leaderboards** — Global, per-league, and per-country rankings across multiple time periods.
6. **League Hub** — Standings, fixtures by round, top scorers, bench analytics, EPL news, and FPL data.

### Monetization Hooks (Designed, Not Yet Implemented)
- **Energy system** — Users have limited energy to play cards. Watching ads refills energy (the `watch_ad_reward` RPC exists).
- **Card packs / inventory** — Card scarcity creates natural demand for replenishment.
- **Premium features** — Scouting intel, advanced bench analytics.

---

## The Four Card Types

| Card | What It Does | Win Condition | Points |
|------|-------------|---------------|--------|
| **Match Result** | Predict home win, draw, or away win | Correct final result | `odds × 100` |
| **Total Goals** | Predict over or under 2.5 goals | Correct over/under | `odds × 100` |
| **Player Score** | Pick a specific player to score | Player scores (normal or penalty, ≤90 min) | `odds × 100` |
| **Supersub** | Bet on a bench player to score/assist | Team-level: any sub scores/assists = **500 pts**. Player-level: named sub scores/assists = **2,500 pts** |

The Supersub card is the differentiator — it's the only prediction type that focuses on bench impact, backed by proprietary bench analytics (coach substitution patterns, team bench goal rates, player sub-on efficiency).

---

## League Coverage

| League | Sportmonks ID | Country |
|--------|--------------|---------|
| Premier League | 8 | England |
| Championship | 9 | England |
| Bundesliga | 82 | Germany |
| La Liga | 564 | Spain |
| Serie A | 384 | Italy |

EPL gets additional features: News feed (BBC, Sky Sports, Guardian RSS) and FPL transfer data.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, React Router 7, Tailwind CSS, Lucide icons, Sonner toasts |
| Build | Vite 7 |
| Hosting | Vercel (Hobby plan, 12 serverless function limit) |
| Database | Supabase (PostgreSQL with Row-Level Security) |
| Data Source | Sportmonks v3 API |
| Testing | Vitest (unit/integration), Playwright (E2E, mobile viewports) |

### Architecture

```
User (mobile browser)
  → React SPA (Vite, Tailwind)
    → /api/* Vercel serverless functions (6 endpoints)
      → Supabase PostgreSQL (25+ tables, RLS on all user tables)
        ← Sportmonks v3 API (fixtures, lineups, odds, players, coaches)
```

**Key constraint**: Vercel Hobby plan limits to 12 serverless functions. Currently using 6 API files. All API handlers use lazy Supabase client initialization (inside handler, not module top-level) to avoid cold-start crashes.

---

## API Endpoints (6 files)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/matches` | Matches by date or single fixture by ID |
| `GET /api/odds` | Pre-match odds from Sportmonks (1×2, Over/Under, Goalscorers) |
| `GET /api/intel` | Pre-match scouting report (form, matchups, bench watch) |
| `GET /api/news` | News articles from RSS feeds, filtered by league/team |
| `GET /api/league` | Standings, fixtures by round, top scorers, bench analytics |
| `GET /api/leaderboard` | Rankings (global/league/country × all-time/season/weekly/monthly) |

---

## Database Schema (Key Tables)

**User-facing:**
- `profiles` — energy, coins, points, club_name, country, ads_watched
- `predictions` — all bets (PENDING → LIVE → SETTLED with WON/LOST)
- `inventory` — card ownership counts per user

**Match data:**
- `matches` — fixtures with `events`, `lineups`, `odds` JSON columns, `round_name`
- `fixtures` — Sportmonks raw fixture data (bridge table, `sportmonks_id` = `matches.id`)
- `standings`, `top_scorers`, `teams`, `leagues`, `seasons`

**Analytics/Intelligence:**
- `team_bench_stats` — bench goal rates, sub timing patterns per team
- `player_supersub_stats` — goals/assists as sub, efficiency metrics per player
- `coach_substitution_patterns` — avg first sub minute, positional tendencies
- `match_intel` — pre-match scouting reports (generated, expires at kickoff)
- `news_intel` — RSS articles with team detection

**Leaderboards:**
- `leaderboards`, `leaderboard_entries`, `user_league_points`

**Critical RPC functions:**
- `settle_prediction()` — atomic bet settlement + points award + leaderboard update
- `watch_ad_reward()` — refill energy on ad watch

---

## Operational Scripts (18 scripts in `scripts/`)

| Category | Scripts | Purpose |
|----------|---------|---------|
| **Data sync** | `backfill-sportmonks.js`, `backfill-matches-full.js`, `fetch-missing-matches.js` | Populate fixtures, events, lineups, odds from Sportmonks |
| **Standings** | `sync-standings.js`, `backfill-round-names.js` | League tables + round name mapping |
| **Analytics** | `sync-supersub-stats.js`, `sync-coaches.js` | Bench metrics, coach sub patterns |
| **Intelligence** | `sync-match-intel.js`, `sync-news-intel.js` | Pre-match reports, RSS news ingestion |
| **Settlement** | `settle.js` | Process all pending bets after match completion |
| **Leaderboards** | `refresh-leaderboards.js`, `backfill-user-league-points.js` | Rebuild rankings |
| **Seeding** | `seed-reference-cache.js`, `seed-types.js`, `seed-coaches.js`, `sync-squads.js` | Bootstrap reference data |

All Sportmonks scripts respect a 1-request-per-second rate limit.

---

## Frontend Structure

### State Management
Single global context (`GameContext.jsx`) via `useGame()` hook — holds auth, profile, inventory, and betting state. No Redux or external state library.

### Key Pages & Features

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Landing | Public landing page |
| `/intro` | InteractiveOnboarding | 1999 CL Final tutorial (5 slides: bench scene → match view → sub selection → confirm → payoff) |
| `/dashboard` | Dashboard | Main hub after login |
| `/manager-office` | ManagerOffice | Visual room with interactive hotspots |
| `/match-hub` | MatchHub | Today's fixtures browser |
| `/match/:id` | MatchDetail | Full match view: scoreboard, lineups, subs (with Supersub CTA), events, stats, pre-match intel, odds |
| `/league-hub` | LeagueHub | League dropdown (5 leagues), tabs: Standings, Fixtures (with round nav), Top Scorers, Bench Watch, News (EPL), FPL (EPL) |
| `/inventory` | LockerRoom | Card collection: deck, live bets, pending, fridge |
| `/leaderboard` | Leaderboard | Global/league/country rankings |

### Design Language
- Dark theme (near-black backgrounds, white text)
- Mobile-first (tested on iPhone 13 Pro, Pixel 5 viewports)
- Card system uses glow effects: gray (default) → blue (selected) → yellow pulse (pending) → green glow (won) → red (lost)
- Cyan (`#00e5ff`) as the Supersub accent color throughout

---

## What Makes Supersub Unique

1. **Bench-focused betting** — No other platform lets you specifically bet on substitute impact. The Supersub card at 2,500 pts for a named sub scoring is high-risk/high-reward.

2. **Proprietary bench analytics** — Coach substitution patterns, team bench goal frequency, individual player sub-on efficiency. This data powers both the Supersub card and the pre-match intel reports.

3. **Manager fantasy wrapper** — It's not presented as "betting." Users are a virtual football manager making tactical calls. The Manager Office, scouting reports, and card inventory create a game layer over prediction mechanics.

4. **Interactive historical onboarding** — The 1999 CL Final tutorial isn't just instructions — it's a playable recreation that hooks users emotionally before they've even signed up.

5. **Multi-league coverage** — EPL, Championship, Bundesliga, La Liga, Serie A with full standings, fixtures, and analytics.

---

## Current State & Known Limitations

### What's Working
- Full onboarding flow (bench scene → match → Supersub play → goal → signup prompt)
- Match browsing and detail views with live scoreboards
- Card placement and settlement engine
- League Hub with standings, fixtures by round, top scorers, bench analytics
- Pre-match intel generation (form guide, coach patterns, bench watch)
- News feed (EPL — BBC, Sky, Guardian)
- Leaderboards (global, per-league, per-country)
- Manager Office with interactive navigation

### Constraints
- **Vercel Hobby plan**: 12 serverless function limit (6 currently used — 6 remaining)
- **Sportmonks API**: Rate-limited (1 req/sec). Subscription tier limits some endpoints.
- **No real-money integration**: Points-based only. No payment processing.
- **No push notifications**: Users must check the app manually.
- **No social features**: No friends, no chat, no sharing.

### What's Not Built Yet
- Signup page redesign (planned)
- Real-time match updates (Supabase Realtime subscription exists for predictions but not for live scores)
- Card pack purchasing / store
- Ad integration for energy refills (backend exists, no ad provider connected)
- Push notifications
- Social features (friends, leagues, sharing)

---

## Environment & Deployment

- **Production URL**: supersub.mobi
- **Hosting**: Vercel (SPA with serverless functions)
- **Database**: Supabase (hosted PostgreSQL)
- **Domain**: Custom domain on Vercel
- **CI/CD**: Git push to `main` → auto-deploy on Vercel
- **Auth**: Supabase Auth (email/password). Optional site-wide password gate via `SITE_PASSWORD` env var (currently disabled).

### Environment Variables
| Variable | Scope | Purpose |
|----------|-------|---------|
| `SUPABASE_URL` | Client + Server | Supabase project URL |
| `SUPABASE_ANON_KEY` | Client + Server | Public API key (RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Admin key for settlement, syncs |
| `SPORTMONKS_API_TOKEN` | Server only | Sportmonks v3 API access |

---

## Repository

- **Repo**: GitHub (`eguner-ssub/supersub-mvp`)
- **Branch**: `main` (single-branch workflow)
- **Structure**:
  ```
  api/              → 6 Vercel serverless functions
  scripts/          → 18 data sync/maintenance scripts
  src/
    features/       → match-day, locker-room, league-hub, office, inventory, debug
    pages/          → auth, dashboard, onboarding, training, settings
    shared/         → GameContext, hooks, config
    utils/          → cardConfig, settlementEngine
  supabase/
    migrations/     → 33 SQL migrations
  ```
