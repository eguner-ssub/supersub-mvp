# Supersub — Product Backlog

> Cross-referenced against pitch deck (`supersub_pitch.pptx`), live codebase, `SUPERSUB_PROJECT_SUMMARY.md`, and game economy audit (April 2026).
> Priorities: **P0** = Soft launch blocker (ship by mid-April 2026) · **P1** = Required before affiliate conversations / first 2 weeks post-launch · **P2** = Retention & organic growth · **P3** = Future market expansion
> Last updated: 2026-04-02 — merged game economy backlog from Octalysis audit session. World Cup Readiness downgraded to P3. Real-time score updates marked shipped. Signup & Funnel epic marked shipped.

---

## LEGAL & COMPLIANCE

Everything in this epic is a hard prerequisite for any affiliate revenue conversation. No operator will sign a deal without these in place.

### ~~Privacy Policy and Terms of Service documents~~ ✅ SHIPPED 2026-03-26
- **Priority:** P0
- **Effort:** S
- **Shipped in:** commit `b39408f`
- **What was built:** `src/pages/Terms.jsx` and `src/pages/Privacy.jsx` — mobile-first dark-themed pages with 9 sections each, back navigation, cross-links, and footer BeGambleAware + 18+ badge. Public routes added in `App.jsx` (no `ProtectedRoute`). `/terms` and `/privacy` rewrites added to `vercel.json`. Footer `<Link>` components added to `Landing.jsx` and `Signup.jsx`.

### ~~ToS acceptance and 18+ confirmation at signup~~ ✅ SHIPPED 2026-03-26
- **Priority:** P0
- **Effort:** S
- **Shipped in:** commit `b39408f`
- **What was built:** Two required checkboxes added to `Signup.jsx` below the password field: "I confirm I am 18 years of age or older" (`isAgeVerified`) and "I agree to the Terms of Service and Privacy Policy" (`hasAcceptedTerms`, with inline `<Link>` components). Form submission is blocked with an inline error if either is unchecked. On successful signup, `terms_accepted_at` and `is_age_verified: true` are written to `profiles` via `upsert` (safe against trigger timing). DB migration skipped — `terms_accepted_at` and `is_age_verified` already existed on the table. Both `PostPredictionSheet` and `WinCelebrationModal` gated on `userProfile?.is_age_verified === true`.
- **Note:** LOST prediction variant removed from `WinCelebrationModal` — only WON predictions show the modal. LOST predictions are silently marked as seen.

### ~~`<AffiliateDisclaimer />` component~~ ✅ SHIPPED 2026-03-26
- **Priority:** P0
- **Effort:** XS
- **Shipped in:** commit `f36bf3a`
- **What was built:** `src/shared/ui/AffiliateDisclaimer.jsx` — renders "18+ · BeGambleAware.org · T&Cs apply · Play responsibly." with linked BeGambleAware.org. Accepts optional `className` prop. Rendered at the bottom of `PostPredictionSheet` and `WinCelebrationModal`.

### ~~18+ badge on Landing.jsx~~ ✅ SHIPPED 2026-03-26
- **Priority:** P0
- **Effort:** XS
- **Shipped in:** commits `f36bf3a` + `b39408f`
- **What was built:** Compliance footer bar added to `Landing.jsx` (absolute bottom, full width). Left side: BeGambleAware.org external link · Terms (React Router `<Link>`) · Privacy (React Router `<Link>`). Right side: "18+" pill with muted border. All items styled at `text-[9px] text-white/25 uppercase tracking-widest` to avoid competing with CTAs.

---

## AFFILIATE REVENUE ENGINE

The pitch deck's core commercial model. Three revenue streams: post-prediction contextual ads, post-win affiliate offers, and bench analytics data licensing.

### ~~`seen_by_user` flag on predictions (DB migration)~~ ✅ SHIPPED 2026-03-26
- **Priority:** P0
- **Effort:** XS
- **Shipped in:** commit `f36bf3a` — migration `034_add_affiliate_columns.sql`
- **What was built:** `predictions.seen_by_user BOOLEAN NOT NULL DEFAULT false` + `predictions.share_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE`. Indexes on `(user_id, status, seen_by_user)` for the unseen-settlements query. `markPredictionsSeen(ids[])` added to `GameContext.jsx`. `unseenSettlements` state fed from `loadProfile()` query (`status='SETTLED' AND seen_by_user=false`, limit 5). Also created `affiliate_events` table in the same migration.

### ~~`useAffiliateLink()` utility and operator config~~ ✅ SHIPPED 2026-03-26
- **Priority:** P0
- **Effort:** S
- **Shipped in:** commit `f36bf3a`
- **What was built:** `src/shared/config/affiliates.js` — operator array with `{ id, name, baseUrl, trackingParam, affiliateId, brandColor, active }`. Placeholder Bet365 entry with real base URL. `src/shared/hooks/useAffiliateLink.js` — returns `{ operator, affiliateUrl, displayReturn, stakeDisplay }`. Computes `displayReturn` as `(DEFAULT_STAKE_GBP * odds).toFixed(2)`; returns `null` when `odds <= 0` (Supersub fixed reward). GBP only (£10 default stake). Tracking param appended to URL when `operator.affiliateId` is set.
- **Open:** Replace Bet365 placeholder with real tracking URL + affiliate ID when operator agreement is signed.

### ~~Post-prediction bottom sheet (`PostPredictionSheet.jsx`)~~ ✅ SHIPPED 2026-03-26
- **Priority:** P0
- **Effort:** M
- **Shipped in:** commits `f36bf3a` + `b39408f`
- **What was built:** `src/features/match-day/PostPredictionSheet.jsx` — slide-up bottom sheet (`fixed inset-x-0 bottom-0 z-[130]`) with `requestAnimationFrame` slide-in animation, 8-second countdown with depleting green progress bar, operator CTA, `<AffiliateDisclaimer />`. Fires `affiliate_events` impression on mount and click on CTA tap (fire-and-forget). Wired into `MatchDetail.jsx` via `affiliateSheetData` state — set after `consumeCard()` succeeds. **Supersub cards excluded** from triggering the sheet (fixed reward, no market odds). Gated on `userProfile?.is_age_verified`.

### ~~Post-settlement celebration modal with affiliate CTA (`WinCelebrationModal.jsx`)~~ ✅ SHIPPED 2026-03-26
- **Priority:** P0
- **Effort:** M
- **Shipped in:** commits `f36bf3a` + `843f2f3` + `b39408f`
- **What was built:** `src/shared/ui/WinCelebrationModal.jsx` — WON-only modal (LOST variant removed by design; LOST predictions are silently marked seen in Dashboard `useEffect`). Trophy icon, "You called it" heading, match title, points earned (`points_awarded ?? potential_reward`), `<ShareCardButton>`, affiliate CTA with `displayReturn` or fallback copy, `<AffiliateDisclaimer />`. 44px close button (mobile-safe tap target). `Dashboard.jsx` updated: filters `unseenSettlements` to first WON prediction, auto-marks LOST ones seen. Gated on `userProfile?.is_age_verified`.

### ~~Affiliate impression & click tracking~~ ✅ SHIPPED 2026-03-26
- **Priority:** P1
- **Effort:** S
- **Shipped in:** commits `f36bf3a` + `b39408f` — migrations `034_add_affiliate_columns.sql` + `036_add_share_event_type.sql`
- **What was built:** `affiliate_events` table with `(id, user_id, event_type CHECK IN ('impression','click','share'), operator, card_type, match_id, odds, created_at)`. RLS INSERT-only for authenticated users. Migration 036 added `'share'` to the event_type enum. Tracking is fire-and-forget in `PostPredictionSheet` (impression on mount + click on CTA), `WinCelebrationModal` (click on CTA), and `ShareCardButton` (share events).
- **Open:** Create a Supabase view `affiliate_summary` grouping by `operator/date/card_type` — needed before operator conversations.

### Ad provider integration for energy refills
- **Priority:** P1
- **Effort:** M
- **Why (commercial link):** Ads fund the energy drink loop.
- **What exists today:** `AdOverlay.jsx` exists as a **mock** component — 5-second countdown placeholder. `watch_ad_reward()` RPC exists but grants direct energy (to be updated in Game Economy epic).
- **What needs building:** Replace `AdOverlay.jsx` mock with a real ad SDK (Google AdMob for web, or Unity Ads / ironSource). Wire the completion callback to call the updated `watch_ad_reward()` RPC (which now grants 1 energy drink — see Game Economy: ad system story).
- **Dependencies:** Ad network account. Game Economy: ad system story (P0, must ship first).

---

## SHAREABLE PREDICTION CARDS

### ~~`share_token` column on predictions (DB migration)~~ ✅ SHIPPED 2026-03-26
- **Priority:** P0
- **Effort:** XS
- **Shipped in:** commit `f36bf3a` — migration `034_add_affiliate_columns.sql`

### ~~`/api/share-card` image generation endpoint~~ ✅ SHIPPED 2026-03-26
- **Priority:** P0
- **Effort:** M
- **Shipped in:** commits `b39408f` + `87f0de0`

### ~~`ShareCardButton.jsx` — share trigger component~~ ✅ SHIPPED 2026-03-26
- **Priority:** P0
- **Effort:** S
- **Shipped in:** commit `b39408f`

### ~~Pre-settlement shareable card ("I'm calling this")~~ ✅ SHIPPED 2026-03-26
- **Priority:** P0
- **Effort:** S
- **Shipped in:** commit `b39408f`

### ~~Post-win shareable card ("I called it")~~ ✅ SHIPPED 2026-03-26
- **Priority:** P0
- **Effort:** XS
- **Shipped in:** commit `b39408f`

### ~~Public share view and OG meta tags (`PublicShareView.jsx`)~~ ✅ SHIPPED 2026-03-26
- **Priority:** P0
- **Effort:** S
- **Shipped in:** commit `b39408f`

---

## GAME ECONOMY

Card scarcity, energy system, training mode, and the daily engagement loop. Derived from Octalysis framework audit (April 2026). All P0 items have corresponding Claude Code prompts in `p0_prompts.md`.

### Schema migration batch — economy primitives
- **Priority:** P0
- **Effort:** M
- **Claude Code prompt:** Prompt 1
- **What needs building:** Single migration adding to `profiles`: `current_streak`, `last_streak_date`, `best_streak`, `energy_last_updated_at`, `energy_drinks`, `training_sessions_today`, `last_training_date`, `ads_watched_today`, `last_ad_date`. Add `inventory.expires_at TIMESTAMPTZ nullable`. Index on `inventory(user_id, expires_at)`.
- **Dependencies:** None — foundation for all economy features.

### Energy regeneration — time-based calculation
- **Priority:** P0
- **Effort:** S
- **Claude Code prompt:** Prompt 2
- **What needs building:** Calculate on read: `min(max_energy, stored_energy + floor((now - energy_last_updated_at) / 4h))`. Update `loadProfile`, `spendEnergy`, `gainEnergy` in GameContext. No cron.
- **Dependencies:** Schema migration batch.

### Energy drinks — six-pack resource
- **Priority:** P0
- **Effort:** S
- **Claude Code prompt:** Prompt 3
- **What needs building:** `useEnergyDrink()` (consume 1 drink → gain 1 energy, cap 6) and `grantEnergyDrink(amount)` in GameContext. Sources: streak milestones, 10/10 training, rewarded ads.
- **Dependencies:** Schema migration batch. Energy regeneration.

### Ad system — server-side daily cap and energy drink grant
- **Priority:** P0
- **Effort:** S
- **Claude Code prompt:** Prompt 4
- **What needs building:** Update `watch_ad_reward()` RPC: server-side 2/day cap, grant 1 energy drink (not direct energy), reset on date change. Update `claimAdReward()` in GameContext. Remove client localStorage cooldown.
- **Dependencies:** Schema migration batch. Energy drinks.

### Streak system — decay model
- **Priority:** P0
- **Effort:** M
- **Claude Code prompt:** Prompt 5
- **What needs building:** Streak increments on daily open. Decay on missed day (drop one tier, not reset to zero). Tiers: 1-3, 4-6, 7+. Energy drink grants at day 3, 5, 7 milestones. `incrementStreak()` + tier helper exported from GameContext.
- **Dependencies:** Schema migration batch.

### Training bag — daily login reward
- **Priority:** P0
- **Effort:** S
- **Claude Code prompt:** Prompt 6
- **What needs building:** `claimTrainingBag()` in GameContext. 2-3 common cards by streak tier. Calls `incrementStreak()`. Dressing room modal on first daily open. `expires_at` set to next Monday 23:59 UTC.
- **Dependencies:** Streak system. Card expiry (column available from schema migration).

### Card expiry — Monday 23:59 reset
- **Priority:** P0
- **Effort:** M
- **Claude Code prompt:** Prompt 7
- **What needs building:** `nextMondayExpiry()` helper. Apply `expires_at` to all common card grants, `null` for Supersub. Tuesday 00:05 UTC cron deletes expired rows. `loadProfile` filters expired cards from local state.
- **Dependencies:** Schema migration batch.

### Training mode — 10 questions with tiered rewards
- **Priority:** P0
- **Effort:** M
- **Claude Code prompt:** Prompt 8
- **What needs building:** 10q trivia, 10s timer. Tiers: 0-4→1c, 5-6→2c, 7-8→3c, 9→4c, 10→5c+1 Supersub+1 drink. 2 sessions/day cap. `startTrainingSession()` + `completeTrainingSession(score)` in GameContext.
- **Dependencies:** Schema migration. Energy regen. Card expiry.

### Training mode — progress UI
- **Priority:** P0
- **Effort:** S
- **Claude Code prompt:** Prompt 9
- **What needs building:** Real-time score + cards earned + next threshold during quiz. Prominent threshold display at Q7+. Joseba toast reactions at 5, 7, 9, 10 correct.
- **Dependencies:** Training mode — 10 questions.

### Supersub card — rarity and points multiplier
- **Priority:** P0
- **Effort:** M
- **Claude Code prompt:** Prompt 10
- **What needs building:** Rarity gates: only from 10/10 training, day 7 streak, special Joseba events. Audit and remove from all other grant sources. Settlement multiplier: match_result 1×, over_under 1×, player_score 1.5×, supersub 2.5×. Applied to `points_awarded`.
- **Dependencies:** Schema migration. Card expiry. Training mode.

### High-roller prediction option (card sink)
- **Priority:** P1
- **Effort:** M
- **What needs building:** Spend 2-3 cards on a single prediction for multiplied points. Toggle on confirmation screen. Update `placeBet()`, `consumeCard()`, settlement engine.
- **Dependencies:** Card expiry (economy must be balanced first).

### Card expiry countdown in UI
- **Priority:** P1
- **Effort:** S
- **What needs building:** Time until expiry in inventory + prediction screens. Amber on Sunday, red on Monday. Tablet notification hook.
- **Dependencies:** Card expiry.

### Streak save mechanic
- **Priority:** P1
- **Effort:** S
- **What needs building:** When streak would decay: offer "Spend 1 energy drink to save streak?" on training bag screen. Deduct drink on acceptance.
- **Dependencies:** Streak system. Energy drinks.

### Card Store (points-to-cards exchange)
- **Priority:** P2
- **Effort:** L
- **What needs building:** `/store` route. Atomic purchase RPC. Pricing: Match Result=200pts, Supersub=1000pts.
- **Dependencies:** Economy must be balanced with live data first.

### Training bag — variable rewards (surprise drops)
- **Priority:** P2
- **Effort:** S
- **What needs building:** ~1 in 7 days: bonus Supersub card, extra energy drink, or Joseba scout report.
- **Dependencies:** Training bag. Tablet notification hub.

### Training mode — format rotation
- **Priority:** P2
- **Effort:** M
- **What needs building:** True/false, visual, stat-based, image-based formats. Themed rounds.
- **Dependencies:** Training mode. Economy data showing completion rate decline.

### Midweek training challenge (card sink)
- **Priority:** P2
- **Effort:** M
- **What needs building:** Spend 5 cards to enter. 10q at 7s timer. Win 8 cards + 1 drink if 8+. Only if card inflation observed.
- **Dependencies:** Training mode. Card expiry. Economy data.

### Energy drink expiry
- **Priority:** P2
- **Effort:** S
- **What needs building:** 7-day expiry on drinks if hoarding data warrants it.
- **Dependencies:** Energy drinks. Economy data showing hoarding.

---

## TABLET NOTIFICATION HUB

### Tablet — core notification types
- **Priority:** P1
- **Effort:** M
- **What needs building:** Badge on tablet. Types: energy recharged, matchday countdown (2h before), streak warning (20:00), leaderboard shift. Cap 2-3/day.
- **Dependencies:** Energy regen. Streak system. Leaderboard.

### Tablet — Joseba intel notifications
- **Priority:** P1
- **Effort:** S
- **What needs building:** When new intel generated for upcoming match, push Joseba notification to tablet. Tapping navigates to match intel view.
- **Dependencies:** Pre-Match Intel Engine. Tablet core notifications.

---

## SEASONAL NARRATIVE & USER STATS

### Seasonal narrative arc — manager career mode
- **Priority:** P1
- **Effort:** M
- **What needs building:** Track per-season: predictions, hit rate, best gameweek, biggest upset. Season summary card (Aug-May). Pure frontend reads on existing data.
- **Dependencies:** None.

### User hit rate stats — prediction performance breakdown
- **Priority:** P1
- **Effort:** M
- **What needs building:** Performance breakdown by league, market type, home/away bias. Group by `league_id + card_type + result`. Manager's Office or stats tab. No new tables.
- **Dependencies:** None.

---

## SIGNUP & FUNNEL

### ~~Signup page redesign with value prop and compliance fields~~ ✅ SHIPPED
- **Priority:** P1

### ~~Country picker at signup~~ ✅ SHIPPED
- **Priority:** P1

### ~~Onboarding club name collection~~ ✅ SHIPPED
- **Priority:** P1

### ~~Funnel analytics events~~ ✅ SHIPPED
- **Priority:** P1

### ~~Post-signup welcome card gift confirmation~~ ✅ SHIPPED
- **Priority:** P1

---

## LIVE MATCH EXPERIENCE

### ~~Real-time score updates~~ ✅ SHIPPED
- **Priority:** P1

### Half-time card placement
- **Priority:** P2
- **Effort:** M
- **What needs building:** Allow Supersub card placement during HT. HT Special badge in MatchHub. Settlement logic already handles sub events.
- **Dependencies:** Real-time score updates (shipped).

---

## PUSH NOTIFICATIONS & RE-ENGAGEMENT

### Web push notification infrastructure
- **Priority:** P2
- **Effort:** L
- **What needs building:** Service worker in `main.jsx`. Push permission flow post-onboarding. FCM/web-push. Triggers: lineup announced, prediction settled, daily training. `push_tokens` table.
- **Dependencies:** Service worker also enables offline support.

---

## PERFORMANCE & MULTI-MARKET

### 3G performance optimisation
- **Priority:** P2
- **Effort:** M
- **What needs building:** Route-based code splitting. `loading="lazy"` on images. Responsive `srcset`. Bundle analysis. Vercel Edge caching.
- **Dependencies:** None.

### Localisation framework
- **Priority:** P3
- **Effort:** L
- **What needs building:** `react-i18next`. Translation JSON files. Language picker. Browser locale detection.
- **Dependencies:** Feature set must stabilise first.

### Liga Portugal / Brasileirão coverage
- **Priority:** P3
- **Effort:** M
- **What needs building:** Add Brasileirão to `coverage.js`. Backfill. Verify sync scripts. Frontend league selector. Portuguese-language news feeds.
- **Dependencies:** Localisation framework.

---

## WORLD CUP READINESS

Downgraded to P3. No World Cup work until core economy and retention loop are proven post-launch.

### International fixture support
- **Priority:** P3
- **Effort:** L
- **What needs building:** Add FIFA World Cup 2026 competition ID to `coverage.js`. Update backfill, `api/matches.js`, `LeagueHub.jsx`, `MatchHub.jsx`.
- **Dependencies:** Sportmonks WC2026 data availability.

### National team leaderboards
- **Priority:** P3
- **Effort:** M
- **What needs building:** WC-only leaderboard view. Auto-create country leaderboard entries in `refresh-leaderboards.js`. Flag icons.
- **Dependencies:** International fixture support.

### Impact Sub Tracker (public, no-login)
- **Priority:** P3
- **Effort:** L
- **What needs building:** Public `/tracker` route. World Cup Impact Sub Tracker ranked list. SEO meta tags. No login.
- **Dependencies:** International fixture support. `sync-supersub-stats.js` on WC data.

### World Cup match card placements
- **Priority:** P3
- **Effort:** S
- **What needs building:** Verify end-to-end card placement flow for international fixtures.
- **Dependencies:** International fixture support.

---

## DATA LICENSING (B2B)

### Bench analytics API
- **Priority:** P3
- **Effort:** M
- **What needs building:** `/api/bench-analytics` endpoint. API key auth. Rate limiting. Structured JSON. Documentation. Usage metering.
- **Dependencies:** Sufficient data coverage. API key management.

---

## IMPLEMENTATION DEPENDENCIES (GAME ECONOMY)

```
Schema migration batch
  ├── Energy regeneration
  │     └── Energy drinks
  │           ├── Ad system (server-side cap)
  │           └── Streak save (P1)
  ├── Streak system
  │     └── Training bag (login reward)
  ├── Card expiry
  │     ├── Training mode (10 questions + rewards)
  │     │     └── Training progress UI
  │     └── Card expiry countdown UI (P1)
  └── Supersub card rarity + multipliers
```

**P0 build order (Claude Code prompts 1–10):**
1. Schema migration batch
2. Energy regeneration
3. Energy drinks
4. Ad system
5. Streak system
6. Training bag
7. Card expiry
8. Training mode — 10 questions
9. Training mode — progress UI
10. Supersub card rarity + settlement multipliers
