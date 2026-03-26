# Supersub — Roadmap to World Cup 2026

> Derived from `BACKLOG.md`. Build backwards from June 2026, not forwards from today.
> Today: March 2026. Feature freeze: April 2026. World Cup kickoff: June 2026.

---

## NOW → END OF MARCH 2026

**Goal: Affiliate infrastructure + shareable cards foundation**

These are the revenue and growth prerequisites. Nothing ships to users yet — this is plumbing.

### Affiliate Revenue Engine (P0 + P1)

| Story | Effort | Key files to create/modify |
|-------|--------|---------------------------|
| Legal compliance layer (18+, BeGambleAware) | S | `Signup.jsx`, new `<AffiliateDisclaimer />` component, `Landing.jsx` |
| Affiliate impression & click tracking | S | New `affiliate_events` migration, new `trackAffiliate()` util |
| Post-prediction affiliate CTA | M | New `PostPredictionOffer.jsx`, modify `MatchDetail.jsx` card placement flow |
| Post-settlement affiliate CTA | M | New `WinCelebrationModal.jsx`, modify `ViewLedger.jsx`, add `seen_by_user` to `predictions` migration |

**Exit criteria:** A user places a prediction → sees a Sky Bet/Bet365 contextual offer → clicks → tracked. A user's bet settles as WON → celebration modal with "You could have won £X" → clicks → tracked.

### Shareable Cards (P0)

| Story | Effort | Key files to create/modify |
|-------|--------|---------------------------|
| Social meta tags & public share routes | S | `index.html` OG tags, new `/share/:id` route in `App.jsx`, `vercel.json` rewrite |
| Pre-settlement shareable card ("I'm calling this") | L | New `ShareableCard.jsx`, `html2canvas` or `/api/card-image` endpoint, share button in `ViewLive.jsx` |
| Post-win shareable card ("I called it") | M | Extend `ShareableCard.jsx` won variant, share button in `WinCelebrationModal.jsx` and `ViewLedger.jsx` |

**Exit criteria:** User can tap "Share" on any live or settled prediction → branded card image generated → share to Twitter/WhatsApp/download. Shared link shows rich preview with card image.

### Signup & Funnel (P1)

| Story | Effort | Key files to create/modify |
|-------|--------|---------------------------|
| Signup page redesign | S | `Signup.jsx` — add country picker, 18+ checkbox, terms, value prop copy |
| Onboarding conversion tracking | S | `InteractiveOnboarding.jsx` — add phase events, new `analytics_events` table |

---

## APRIL 2026 — FEATURE FREEZE

**Goal: World Cup data + public tracker + daily loop locked in**

Everything that touches the World Cup must be production-ready by end of April. No new features after this — only bug fixes.

### World Cup Coverage (P0)

| Story | Effort | Key files to create/modify |
|-------|--------|---------------------------|
| International fixture support | L | `coverage.js` (add WC ID), `backfill-sportmonks.js`, `api/matches.js` league filter, `LeagueHub.jsx` dropdown, `MatchHub.jsx` |
| National team leaderboards | M | `Signup.jsx` country picker, `refresh-leaderboards.js` WC filter, `Leaderboard.jsx` WC tab, flag icons |
| Impact Sub Tracker (public, no-login) | L | New `/tracker` route (no ProtectedRoute), new `ImpactTracker.jsx` page, `vercel.json` rewrite, SEO meta tags |
| World Cup match card placements | S | Verify E2E flow for international fixtures: odds, lineups, bench stats, settlement |

**Exit criteria:** World Cup fixtures appear in Match Hub. Users can place all 4 card types on WC matches. Public Impact Sub Tracker page ranks subs by goals/assists across all 48 teams. Country leaderboards rank users by their WC prediction performance.

### Gamified Daily Loop (P1)

| Story | Effort | Key files to create/modify |
|-------|--------|---------------------------|
| Daily Training quest with streak rewards | M | `Training.jsx` daily limit, `profiles` migration (last_training_date, training_streak), `Dashboard.jsx` daily card |
| Card scarcity & economy balancing | M | `Dashboard.jsx` card count widget, `LockerRoom.jsx` low-stock warnings, economy model tuning |

**Exit criteria:** User gets 1 free Training session per day. Streak counter visible on Dashboard. Card counts create urgency before match days.

### Live Match (P1)

| Story | Effort | Key files to create/modify |
|-------|--------|---------------------------|
| Real-time score updates | M | New `/api/live` endpoint or Supabase Realtime on `matches`, `MatchDetail.jsx` goal flash, reduce poll interval |

**Exit criteria:** Scores update within 60 seconds of a goal during live matches. Goal flash animation fires on score change.

---

## APRIL → MAY 2026 — HARDENING

**Goal: Stress test, performance, polish. No new features.**

- Load test all API endpoints with projected World Cup traffic (10× current)
- Verify Sportmonks rate limits won't throttle during 4-match concurrent windows
- Run Playwright E2E suite against World Cup fixture data
- Test affiliate CTA flow end-to-end with live operator links
- Verify settlement cron handles 104 WC matches across 30 days
- Monitor bundle size — target < 500KB initial load for 3G markets

---

## JUNE–JULY 2026 — WORLD CUP LIVE

**Live feature set:**

```
┌─────────────────────────────────────────────────────┐
│  WORLD CUP LIVE FEATURES                            │
├─────────────────────────────────────────────────────┤
│  ✦ 4 prediction cards on all 104 WC matches        │
│  ✦ Public Impact Sub Tracker (no login, SEO)        │
│  ✦ Shareable prediction cards (pre + post)          │
│  ✦ Post-prediction affiliate CTAs (Sky Bet et al.)  │
│  ✦ Post-win affiliate CTAs ("You could have won £X")│
│  ✦ National team leaderboards (48 countries)        │
│  ✦ Real-time score updates during matches           │
│  ✦ Daily Training with streak rewards               │
│  ✦ Card scarcity driving daily engagement           │
│  ✦ 18+ / BeGambleAware compliance on all placements │
│  ✦ Domestic leagues running in parallel (5 leagues)  │
└─────────────────────────────────────────────────────┘
```

**Operational requirements during tournament:**
- `settle.js` cron running after every match (up to 4/day)
- `sync-supersub-stats.js` running after every match (Impact Tracker freshness)
- `refresh-leaderboards.js` running after every settlement batch
- Monitor affiliate click-through rates daily — adjust CTA copy/timing
- Manual review of shared card images for brand quality

---

## POST WORLD CUP (H2 2026)

**P2 — Retention & growth**

| Story | Priority | Effort | Notes |
|-------|----------|--------|-------|
| Card Store (points-to-cards) | P2 | L | Points sink, increases Training/ad engagement |
| Half-time card placement | P2 | M | Supersub card during HT — natural re-engagement |
| Web push notifications | P2 | L | Match start, settlement, daily Training reminders |
| 3G performance optimisation | P2 | M | Route code splitting, image lazy loading, bundle diet |

**P3 — Future market expansion**

| Story | Priority | Effort | Notes |
|-------|----------|--------|-------|
| Localisation framework (i18n) | P3 | L | Portuguese first, then Hausa/Yoruba for Nigeria |
| Liga Portugal / Brasileirão coverage | P3 | M | Tier 3 market entry (Brazil) |
| Bench analytics B2B API | P3 | M | Revenue stream #3 from pitch deck |

---

## TIMELINE SUMMARY

```
MAR 2026          APR 2026            MAY 2026         JUN 2026
    │                 │                   │                │
    ├── Affiliates    ├── World Cup       ├── Hardening    ├── WORLD CUP
    │   live          │   fixtures        │   & stress     │   LIVE
    ├── Shareable     ├── Impact          │   testing      │
    │   cards         │   Tracker         │                ├── 104 matches
    ├── Legal         ├── Daily loop      │                ├── 48 nations
    │   compliance    ├── Live scores     │                ├── Affiliate
    ├── Signup        ├── National        │                │   revenue
    │   redesign      │   leaderboards    │                │   flowing
    │                 │                   │                │
    ▼                 ▼                   ▼                ▼
  Revenue           Product             Stability        Go time
  plumbing          completeness        & performance
```

---

## VERCEL FUNCTION BUDGET

Current: 6 of 12 used (`matches`, `odds`, `intel`, `news`, `league`, `leaderboard`).

| Planned new endpoint | Purpose | Can it be merged? |
|---------------------|---------|-------------------|
| `/api/card-image` | OG image generation for shared cards | No (Vercel OG runtime) |
| `/api/live` | Real-time score batch fetch | Could merge into `matches.js` with `?live=true` param |
| `/api/bench-analytics` | B2B data API (P3) | Separate service recommended |

**Safe budget:** 2 new endpoints (card-image + live), keeping 4 in reserve. Merge `live` into `matches.js` if budget is tight.
