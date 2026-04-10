# Supersub — Product Backlog

> Cross-referenced against pitch deck (`supersub_pitch.pptx`), live codebase, `SUPERSUB_PROJECT_SUMMARY.md`, and game economy audit (April 2026).
> Priorities: **P0** = Soft launch blocker (ship by mid-April 2026) · **P1** = Required before affiliate conversations / first 2 weeks post-launch · **P2** = Retention & organic growth · **P3** = Future market expansion
> Last updated: 2026-04-10 — all P0 Game Economy items marked shipped (Prompts 1–10). High-roller prediction, Seasonal narrative arc, and User hit rate stats downgraded to P2. P1 build order updated.

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

### ~~Schema migration batch — economy primitives~~ ✅ SHIPPED
- **Priority:** P0
- **Effort:** M
- **Claude Code prompt:** Prompt 1
- **What was built:** Migration `040_economy_primitives.sql`: added `current_streak`, `last_streak_date`, `best_streak`, `energy_last_updated_at`, `energy_drinks`, `training_sessions_today`, `last_training_date`, `ads_watched_today`, `last_ad_date` to `profiles`; `inventory.expires_at TIMESTAMPTZ nullable`; index on `inventory(user_id, expires_at)`.

### ~~Energy regeneration — time-based calculation~~ ✅ SHIPPED
- **Priority:** P0
- **Effort:** S
- **Claude Code prompt:** Prompt 2
- **What was built:** `computeEnergyRegen()` in `GameContext.jsx`; `loadProfile` calculates current energy on read — `min(max_energy, stored + floor((now - energy_last_updated_at) / 4h))`; no cron required.

### ~~Energy drinks — six-pack resource~~ ✅ SHIPPED
- **Priority:** P0
- **Effort:** S
- **Claude Code prompt:** Prompt 3
- **What was built:** `useEnergyDrink()` (consume 1 drink → gain 1 energy, cap 6) and `grantEnergyDrink(amount)` in `GameContext.jsx`. Granted at streak milestones, 10/10 training, rewarded ads.

### ~~Ad system — server-side daily cap and energy drink grant~~ ✅ SHIPPED
- **Priority:** P0
- **Effort:** S
- **Claude Code prompt:** Prompt 4
- **What was built:** `watch_ad_reward()` RPC (migration `041`): server-side 2/day cap, grants 1 energy drink, resets on date change. `claimAdReward()` in `GameContext.jsx` updated. Client localStorage cooldown removed.

### ~~Streak system — decay model~~ ✅ SHIPPED
- **Priority:** P0
- **Effort:** M
- **Claude Code prompt:** Prompt 5
- **What was built:** `incrementStreak()` + `computeStreakDecay()` in `GameContext.jsx`. Tier model: 1-3, 4-6, 7+. Decay drops one tier on missed day. Energy drink grants at day 3, 5, 7 milestones.

### ~~Training bag — daily login reward~~ ✅ SHIPPED
- **Priority:** P0
- **Effort:** S
- **Claude Code prompt:** Prompt 6
- **What was built:** `claimTrainingBag()` in `GameContext.jsx`; 2-3 common cards by streak tier; dressing room modal on first daily open; `expires_at` set to next Monday 23:59 UTC.

### ~~Card expiry — Monday 23:59 reset~~ ✅ SHIPPED
- **Priority:** P0
- **Effort:** M
- **Claude Code prompt:** Prompt 7
- **What was built:** `nextMondayExpiry()` helper; `expires_at` applied to all common card grants (`null` for Supersub); `loadProfile` filters expired cards from local state; Tuesday 00:05 UTC cron Edge Function.

### ~~Training mode — 10 questions with tiered rewards~~ ✅ SHIPPED
- **Priority:** P0
- **Effort:** M
- **Claude Code prompt:** Prompt 8
- **What was built:** `src/pages/Training.jsx` — 10q trivia, 10s timer per question. Tiers: 0-4→1c, 5-6→2c, 7-8→3c, 9→4c, 10→5c+1 Supersub+1 drink. 2 sessions/day cap. `startTrainingSession()` + `completeTrainingSession(score)` in `GameContext.jsx`.

### ~~Training mode — progress UI~~ ✅ SHIPPED
- **Priority:** P0
- **Effort:** S
- **Claude Code prompt:** Prompt 9
- **What was built:** `ScoreHUD` sub-component in `Training.jsx` — real-time score, cards earned, next threshold. Prominent tension styling at Q7+. Joseba milestone toast reactions at 5, 7, 9, 10 correct (2.5s auto-dismiss).

### ~~Supersub card — rarity and points multiplier~~ ✅ SHIPPED
- **Priority:** P0
- **Effort:** M
- **Claude Code prompt:** Prompt 10
- **What was built:** `POINTS_MULTIPLIER` constant in `src/utils/settlementEngine.js` + `scripts/settle.js` (match_result 1×, total_goals 1×, player_score 1.5×, supersub 2.5×). Rarity gated to 10/10 training + day-7 streak only. All other grant sources audited and removed.

### High-roller prediction option (card sink)
- **Priority:** P2
- **Effort:** M
- **What needs building:** Spend 2 cards on a single prediction for 2× points. "Double Down" toggle on confirmation screen. `placeBet()` accepts optional `cardCount = 1` param; `consumeCard()` called twice when `cardCount === 2`. Reward multiplied at placement time (stored in `potential_reward`), not in settlement engine.
- **Dependencies:** Card expiry (economy must be balanced with live data first).

### ~~Card expiry countdown in UI~~ ✅ SHIPPED
- **Priority:** P1
- **Effort:** S
- **What was built:** `expiryMap` built in `loadProfile()` (`GameContext.jsx`); expiry chip rendered in `ViewDeck.jsx` — amber Saturday/Sunday, red Monday, "exp. Mon / exp. tmrw / exp. today" labels.

### ~~Streak save mechanic~~ ✅ SHIPPED
- **Priority:** P1
- **Effort:** S
- **What was built:** `loadProfile()` intercepts decay when `energy_drinks > 0`, setting `pendingDecay` in state; `Dashboard.jsx` shows a "Save streak?" modal before the training bag reward; `saveStreakWithDrink()` / `declineStreakSave()` in `GameContext.jsx`.

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

### ~~Tablet — core notification types~~ ✅ SHIPPED
- **Priority:** P1
- **Effort:** M
- **What was built:** `ManagerOffice.jsx` builds up to 3 notifications on mount: `energy_ready` (4h+ regen), `matchday_soon` (6h window), `streak_warning` (after 20:00). Red badge on tablet hotspot; notifications passed as location state to `/leaderboard` and rendered in a panel at the top.

### ~~Tablet — Joseba intel notifications~~ ✅ SHIPPED
- **Priority:** P1
- **Effort:** S
- **What was built:** Intel fetch piggybacked onto the matches request in `ManagerOffice.jsx`; first available match within 24h checked against `/api/intel`; rendered as a Joseba-styled inline card in the Leaderboard notification panel; tapping navigates to `/match/:id`.

---

## SEASONAL NARRATIVE & USER STATS

### Seasonal narrative arc — manager career mode
- **Priority:** P2
- **Effort:** M
- **What needs building:** New CAREER tab in LockerRoom (`ViewCareer.jsx`). Per-season rollup: total predictions, win %, total points, best gameweek, most-used card type. Season label derived from `created_at`. Pure frontend computation on existing `predictions` table data.
- **Dependencies:** None.

### User hit rate stats — prediction performance breakdown
- **Priority:** P2
- **Effort:** M
- **What needs building:** Section within CAREER tab. Win % by card type, by league, and home/away bias (from `selection` field). Horizontal CSS bar charts reusing `barStyle` pattern from `MatchDetail.jsx`. No new tables.
- **Dependencies:** Seasonal narrative arc (ships in same file).

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

All P0 items shipped. Remaining P1 build order:

```
✅ Schema migration batch
  ✅ Energy regeneration → Energy drinks → Ad system
  ✅ Streak system → Training bag
  ✅ Card expiry → Training mode → Training progress UI
  ✅ Supersub card rarity + multipliers
  │
  ├── Card expiry countdown UI (P1) ← data available, UI only
  ├── Streak save mechanic (P1) ← logic available, UI + GameContext hook
  ├── Tablet core notifications (P1) ← new feature
  │     └── Tablet Joseba intel (P1) ← depends on tablet core
  └── Ad provider integration (P1) ← blocked on ad network account
```

**P1 build order:**
1. ~~Card expiry countdown UI~~ ✅ SHIPPED
2. ~~Streak save mechanic~~ ✅ SHIPPED
3. ~~Tablet core notifications~~ ✅ SHIPPED
4. ~~Tablet Joseba intel notifications~~ ✅ SHIPPED
5. Ad provider integration (when ad network account is ready)
