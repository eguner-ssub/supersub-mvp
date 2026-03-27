# Supersub — Product Backlog

> Cross-referenced against pitch deck (`supersub_pitch.pptx`), live codebase, and `SUPERSUB_PROJECT_SUMMARY.md`.
> Priorities: **P0** = World Cup blocker (ship by April 2026) · **P1** = Required before affiliate conversations · **P2** = Retention & organic growth · **P3** = Future market expansion
> Last updated: 2026-03-27 — reflects 5 commits shipped on 2026-03-26.

---

## LEGAL & COMPLIANCE

Everything in this epic is a hard prerequisite for any affiliate revenue conversation. No operator will sign a deal without these in place. None of it exists today.

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

The pitch deck's core commercial model. Three revenue streams: post-prediction contextual ads, post-win affiliate offers, and bench analytics data licensing. None are live.

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
- **What was built:** `affiliate_events` table with `(id, user_id, event_type CHECK IN ('impression','click','share'), operator, card_type, match_id, odds, created_at)`. RLS INSERT-only for authenticated users. Migration 036 added `'share'` to the event_type enum. Tracking is fire-and-forget (`void supabase.from('affiliate_events').insert(...)`) in `PostPredictionSheet` (impression on mount + click on CTA), `WinCelebrationModal` (click on CTA), and `ShareCardButton` (share events).
- **Open:** Create a Supabase view `affiliate_summary` grouping by `operator/date/card_type` — needed before operator conversations.

### Ad provider integration for energy refills
- **Priority:** P2
- **Effort:** M
- **Why (commercial link):** Slide 3 — "Daily card rewards from the Training Ground keep users returning. Card scarcity creates natural engagement pressure." Ads fund the energy loop.
- **What exists today:** `AdOverlay.jsx` exists as a **mock** component — it shows a placeholder with a 5-second countdown timer. `Training.jsx` calls it when energy = 0. The `watch_ad_reward()` RPC exists in migration 010 but is never called from the frontend. `GameContext.jsx` has `gainEnergy()` which updates Supabase directly but bypasses the RPC.
- **What needs building:** Replace `AdOverlay.jsx` mock with a real ad SDK (Google AdMob for web, or a rewarded video provider). Wire the completion callback to call `watch_ad_reward()` RPC (which atomically refills energy and increments `ads_watched`). Add ad frequency caps to prevent abuse.
- **Dependencies:** Ad network account (Google AdMob, Unity Ads, or ironSource).

---

## SHAREABLE PREDICTION CARDS

The pitch deck's organic growth engine. Every share during the World Cup is free acquisition. Build the infrastructure once; both card variants (pre- and post-settlement) reuse it.

### ~~`share_token` column on predictions (DB migration)~~ ✅ SHIPPED 2026-03-26
- **Priority:** P0
- **Effort:** XS
- **Shipped in:** commit `f36bf3a` — migration `034_add_affiliate_columns.sql`
- **What was built:** `predictions.share_token UUID NOT NULL DEFAULT gen_random_uuid()` with unique index `idx_predictions_share_token`. Share URL pattern: `supersub.mobi/share/<share_token>`.

### ~~`/api/share-card` image generation endpoint~~ ✅ SHIPPED 2026-03-26
- **Priority:** P0
- **Effort:** M
- **Shipped in:** commits `b39408f` + `87f0de0` (deployment fix)
- **What was built:** `api/share-card.js` using `@vercel/og` (`@vercel/og` added to `package.json`). Accepts `?token=<share_token>`. Fetches prediction via Supabase service role key. Renders 1200×630 OG image: Supersub branding, match title, card type, selection, WON/LOST badge. Cache-Control headers set for performance. Runs on Node.js serverless runtime (Edge runtime skipped — incompatible with supabase-js). Deployment fix in `87f0de0` resolved a runtime conflict. Now 7/12 Vercel functions used.

### ~~`ShareCardButton.jsx` — share trigger component~~ ✅ SHIPPED 2026-03-26
- **Priority:** P0
- **Effort:** S
- **Shipped in:** commit `b39408f`
- **What was built:** `src/shared/ui/ShareCardButton.jsx`. Web Share API on mobile with `navigator.clipboard` + Sonner toast fallback. Fires `affiliate_events` share event (fire-and-forget). Placed in: `WinCelebrationModal.jsx` (post-win), `MatchDetail.jsx` confirmation screen (pre-settlement), `ViewLedger.jsx` settled rows, `ViewLive.jsx` active bet rows.

### ~~Pre-settlement shareable card ("I'm calling this")~~ ✅ SHIPPED 2026-03-26
- **Priority:** P0
- **Effort:** S
- **Shipped in:** commit `b39408f`
- **What was built:** Share button added to `MatchDetail.jsx` prediction confirmation screen using `<ShareCardButton prediction={...} variant='pre' />`. Share URL: `supersub.mobi/share/<share_token>`. OG image rendered by `/api/share-card`. Destination: `PublicShareView.jsx` with signup CTA.

### ~~Post-win shareable card ("I called it")~~ ✅ SHIPPED 2026-03-26
- **Priority:** P0
- **Effort:** XS
- **Shipped in:** commit `b39408f`
- **What was built:** `<ShareCardButton prediction={prediction} variant='won' />` added to `WinCelebrationModal.jsx` between points display and affiliate CTA. Share icon added to WON rows in `ViewLedger.jsx`. OG image generated by existing `/api/share-card` endpoint (WON badge already handled).

### ~~Public share view and OG meta tags (`PublicShareView.jsx`)~~ ✅ SHIPPED 2026-03-26
- **Priority:** P0
- **Effort:** S
- **Shipped in:** commit `b39408f`
- **What was built:** `src/pages/PublicShareView.jsx` — public route (no `ProtectedRoute`), reads `:token` param, fetches prediction, renders card with "Play free" CTA pointing to `/intro`. Default OG meta tags added to `index.html`. Per-page dynamic OG image tag updated client-side pointing to `/api/share-card?token=<token>`. `/share/:token` added to `App.jsx` (lazy-loaded) and `vercel.json` rewrites.

---

## WORLD CUP READINESS

The pitch deck's #1 deadline. "Any feature not in production by April is not in the World Cup."

### International fixture support
- **Priority:** P0
- **Effort:** L
- **Why (commercial link):** Slide 9 — "48 teams · 104 matches · June–July 2026." Supersub cannot participate in the World Cup without international fixture data.
- **What exists today:** `coverage.js` hardcodes 5 domestic league IDs (EPL=8, Championship=9, Bundesliga=82, La Liga=564, Serie A=384). No international competition IDs. All data sync scripts, API endpoints, and frontend league selectors are built around these 5 IDs.
- **What needs building:** Add FIFA World Cup 2026 season/competition ID to `coverage.js` (Sportmonks competition ID TBD — likely available early 2026). Update `backfill-sportmonks.js` to sync World Cup fixtures, teams, and squads. Update `api/matches.js` league filter to include the World Cup competition. Update `LeagueHub.jsx` dropdown to include "World Cup 2026" as a league option. Ensure `MatchHub.jsx` daily view shows World Cup matches alongside domestic leagues.
- **Dependencies:** Sportmonks World Cup 2026 data availability. May require Sportmonks plan upgrade for international fixtures.

### National team leaderboards
- **Priority:** P0
- **Effort:** M
- **Why (commercial link):** Slide 9 — The World Cup is inherently national. Country leaderboards create tribal competition that drives engagement and sharing.
- **What exists today:** `leaderboard_entries` and `leaderboards` tables support `type='country'` with `scope_key` for country codes. `api/leaderboard.js` handles `?type=country&scope_key=GB`. `Leaderboard.jsx` has country tab. `profiles.country_code` stores user's country. The schema is ready; the feature is partially wired.
- **What needs building:** Ensure country_code is collected at signup (currently missing — `Signup.jsx` has no country picker). Add a dedicated "World Cup Leaderboard" view filtered to predictions on World Cup matches only. Auto-create country leaderboard entries in `refresh-leaderboards.js` for World Cup period. Add national flag icons to leaderboard rows.
- **Dependencies:** International fixture support. Country picker at signup (see Signup story).

### Impact Sub Tracker (public, no-login)
- **Priority:** P0
- **Effort:** L
- **Why (commercial link):** Slide 9 — "Public-facing real-time leaderboard of substitute impact across all 32 nations. No login required. SEO magnet, PR hook, organic acquisition engine."
- **What exists today:** `player_supersub_stats` table has goals_as_sub, assists_as_sub, apps_as_sub per player per season. `team_bench_stats` has team-level bench goal data. `Leaderboard.jsx` exists but is wrapped in `<ProtectedRoute>` — login required. `api/leaderboard.js` endpoint itself has no auth check (Supabase anon key works).
- **What needs building:** A new public route `/tracker` (no `ProtectedRoute` wrapper) that shows a "World Cup Impact Sub Tracker" — ranked list of substitutes who've scored/assisted during the tournament. Pulls from `player_supersub_stats` filtered to World Cup season. Add SEO-friendly server-rendered meta tags. Should work without login and encourage signup. Add to `vercel.json` rewrites. Consider a standalone landing page design (different from in-app chrome) for SEO/PR purposes.
- **Dependencies:** International fixture support. `sync-supersub-stats.js` running against World Cup data.

### World Cup match card placements
- **Priority:** P0
- **Effort:** S
- **Why (commercial link):** Core product — users need to be able to place all 4 card types on World Cup matches, not just domestic league games.
- **What exists today:** `MatchDetail.jsx` works for any match ID. `settlementEngine.js` is league-agnostic. The card placement flow doesn't filter by league.
- **What needs building:** Verify that the end-to-end flow works for international fixtures (odds fetching, lineup data, bench stats for national teams). May need to handle cases where Sportmonks has limited data for smaller national teams. Ensure `settle.js` settlement cron picks up World Cup matches.
- **Dependencies:** International fixture support.

---

## GAMIFIED DAILY LOOP

Card scarcity and daily engagement pressure drive return visits.

### Daily Training quest with streak rewards
- **Priority:** P1
- **Effort:** M
- **Why (commercial link):** Slide 3 — "Daily card rewards from the Training Ground keep users returning. Card scarcity creates natural engagement pressure before each gameweek."
- **What exists today:** `Training.jsx` is fully functional: 5-question quiz, 10s timer, costs 1 energy, awards 1 random card on 3/5 correct. But there's no daily mechanic — users can run Training infinitely if they have energy. No streak tracking, no daily reset, no compounding rewards.
- **What needs building:** Add `last_training_date` and `training_streak` columns to `profiles`. Limit Training to 1 free session per day (additional sessions cost energy as today). Streak bonuses: Day 3 = bonus card, Day 7 = rare card, Day 14 = Supersub card. Show streak counter on Dashboard and Training page. Reset streak if a day is missed. Add a "Daily Training" card to `Dashboard.jsx` with countdown to next available session.
- **Dependencies:** None.

### Card scarcity & economy balancing
- **Priority:** P1
- **Effort:** M
- **Why (commercial link):** Slide 3 — "Card scarcity creates natural engagement pressure." Without scarcity, users have no reason to return daily or engage with ads.
- **What exists today:** `inventory` table tracks card counts. `consumeCard()` in `GameContext.jsx` decrements count. Cards are acquired via: onboarding bonus (hardcoded), Training rewards. No other acquisition source. No depletion analytics.
- **What needs building:** Card economy model: define daily earn rate vs daily spend rate to ensure scarcity. Dashboard widget showing card counts with "Low stock" warning when count ≤ 1. "Get more cards" CTA linking to Training (free) or Card Store (future). Gameweek preview: "3 matches today, you have 2 Match Result cards" — creates urgency. Consider card expiry (cards expire if unused for 7 days) to prevent hoarding.
- **Dependencies:** Daily Training quest.

### Card Store (points-to-cards exchange)
- **Priority:** P2
- **Effort:** L
- **Why (commercial link):** Creates a sink for accumulated points, increases Training/ad engagement to earn points for card purchases.
- **What exists today:** Nothing. `ViewDeck.jsx` shows inventory counts but no purchase CTA. No store page, no pricing model, no transaction flow.
- **What needs building:** New `/store` route with a `CardStore.jsx` component. Price cards in points (e.g., Match Result = 200pts, Supersub = 1000pts). Transaction flow: select card → confirm → deduct points from `profiles.points` → increment `inventory.count`. RPC function for atomic purchase. Show store link from LockerRoom and Dashboard.
- **Dependencies:** Card scarcity story (to validate economy).

---

## LIVE MATCH EXPERIENCE

Second-screen engagement is the pitch deck's positioning thesis.

### Real-time score updates
- **Priority:** P1
- **Effort:** M
- **Why (commercial link):** Slide 6 — "35% of second-screen usage is during live matches." 30-second polling feels laggy. Users will switch to a faster app if scores are delayed.
- **What exists today:** `ViewLive.jsx` polls `matches` table every 30 seconds for `home_score`/`away_score`. `usePredictions.js` subscribes to Supabase Realtime for prediction status changes (INSERT/UPDATE/DELETE) — but NOT for match score changes. Sportmonks data itself may be 2–5 minutes delayed depending on sync frequency.
- **What needs building:** Two options: (a) Add Supabase Realtime subscription on `matches` table for score changes — requires `settle.js` or a new cron to update match scores more frequently (currently runs post-FT only). (b) Direct Sportmonks live polling from client via a new `/api/live?fixtures=1,2,3` endpoint that batch-fetches live scores, called every 60s from `MatchDetail.jsx`. Either way, reduce perceived latency. Add goal flash animation in `MatchDetail.jsx` scoreboard when score changes.
- **Dependencies:** Sportmonks live data access (may require plan upgrade for real-time feeds).

### Half-time card placement
- **Priority:** P2
- **Effort:** M
- **Why (commercial link):** Slide 6 — "34% half-time re-engage, add a card." Currently users can only place pre-match predictions. Half-time is a natural re-engagement window.
- **What exists today:** `MatchDetail.jsx` has view states (PRE_NO_LINEUPS, PRE_WITH_LINEUPS, LIVE, POST). Card placement is only available in PRE states. LIVE state shows a read-only tactical view.
- **What needs building:** Allow Supersub card placement during HT (half-time status from Sportmonks). Add a "HT Special" badge on matches at half-time in `MatchHub.jsx`. Modify `MatchDetail.jsx` LIVE view to show Supersub CTA during HT. Settlement logic in `settlementEngine.js` already handles sub events regardless of when the bet was placed — no backend changes needed.
- **Dependencies:** Real-time score updates (to detect HT reliably).

---

## PUSH NOTIFICATIONS & RE-ENGAGEMENT

### Web push notification infrastructure
- **Priority:** P2
- **Effort:** L
- **Why (commercial link):** Slide 6 — Users need prompting to open their second screen. Without push, Supersub relies on the user remembering to check the app.
- **What exists today:** Nothing. No service worker, no Firebase/FCM, no notification permission flow.
- **What needs building:** Service worker registration in `main.jsx`. Push notification permission request (post-onboarding, not at first visit). FCM or web-push integration. Notification triggers: (1) Lineup announced for a match you follow — "Lineups are in! Place your cards." (2) Prediction settled — "Your Supersub card on Salah just won! +2,500 pts." (3) Daily Training available — "Your daily session is ready." Backend: a `push_tokens` table and a notification dispatch script.
- **Dependencies:** Daily Training quest (for daily notification trigger). Service worker also enables offline support.

---

## SIGNUP & FUNNEL

The funnel is: `/intro` → `/` → `/signup` → email confirmation → `/onboarding` → `/dashboard`. Currently the signup step has no value proposition, no compliance fields, and no analytics. Each story below is a discrete, shippable improvement to one step of this funnel.

### Signup page redesign with value prop and compliance fields
- **Priority:** P1
- **Effort:** M
- **Why (commercial link):** The interactive onboarding creates genuine excitement (1999 CL Final). The signup page immediately deflates it — a bare dark form with "Initialize your performance profile" copy. This is the highest-leverage conversion improvement available: fix the transition from hook to registration.
- **What exists today:** `Signup.jsx` (line 82): heading "Join the Club", subheading "Initialize your performance profile." Two fields: email and password. Carbon fibre texture. Stadium background. A stylised submit button. No value copy, no social proof, no country picker, no compliance checkboxes. Redirects to `/onboarding` on success.
- **What needs building:** (1) Replace subheading with a short value proposition — 2 lines max: *"Call the sub before the manager does."* and *"Earn points. Beat your rivals. Play free."* (2) Add a visual hook above the form: 3 small icon+text rows (⚡ Play free · 🏆 Earn points · 🌍 Compete globally) to reinforce the pitch. (3) Add country picker (see dedicated story below). (4) Add the two compliance checkboxes (18+ and ToS — see LEGAL & COMPLIANCE epic, `ToS acceptance and 18+ confirmation` story — these must ship together). (5) Add a referral code field (optional, collapsed under "Have a code?" disclosure, stores to `profiles.referral_code` for future viral mechanic). (6) Style the email confirmation screen (`needsEmailConfirm` state, line 49): replace "Verify Access / Activation link sent" with warmer copy — "Check your inbox — we've sent you a link to get started." (7) Keep all existing logic (`supabase.auth.signUp`, error handling, `navigate('/onboarding')` on success) intact.
- **Dependencies:** Privacy Policy and Terms of Service pages (must be live before linking). ToS/18+ acceptance migration (needs `terms_accepted_at` and `is_age_verified` columns — ships in LEGAL epic).

### Country picker at signup
- **Priority:** P1
- **Effort:** S
- **Why (commercial link):** `profiles.country_code` feeds national leaderboards. For the World Cup, users need a country to compete in national rankings. If country is not collected at signup, it must be collected at onboarding — and users frequently skip optional onboarding fields. Collect it at signup when intent is highest.
- **What exists today:** `profiles` table has `country_code TEXT` column. `Signup.jsx` does not collect it. `Onboarding.jsx` does not collect it either. The leaderboard country tab exists in the schema but has no country data for most users.
- **What needs building:** (1) Add a country `<select>` dropdown to `Signup.jsx`, placed after the email/password fields and before the compliance checkboxes. Initially show top 20 countries by football fanbase (England, Germany, Spain, Italy, Brazil, France, Argentina, Netherlands, Portugal, Turkey, Nigeria, Ghana, USA, Mexico, etc.) plus an "Other" fallback. (2) After `supabase.auth.signUp()` succeeds, upsert `country_code` to `profiles`. The `profiles` row is created by a Supabase trigger on `auth.users` insert — update it with: `supabase.from('profiles').update({ country_code }).eq('id', data.user.id)`. (3) Add a UK/EU locale flag icon beside the selected country in the dropdown for visual clarity (use emoji flags — simple, no external library).
- **Dependencies:** Signup page redesign (same component, same sprint).

### Onboarding club name collection
- **Priority:** P1
- **Effort:** S
- **Why (commercial link):** `profiles.club_name` is the gating field for `ProtectedRoute` — without it, users are redirected to `/onboarding` on every authenticated page load. It's also displayed as the user's identity across the app. This field must be collected reliably and the UX must feel worthwhile, not like a form obstacle.
- **What exists today:** `Onboarding.jsx` collects `club_name` and writes it to `profiles`. The `ProtectedRoute` wrapper in `App.jsx` checks `userProfile.club_name` — if missing, redirects to `/onboarding`. This logic works. The current onboarding is functional but plain.
- **What needs building:** (1) Read `Onboarding.jsx` fully and evaluate: is the copy engaging? Does it explain why club name matters? Rewrite the intro copy to frame club name as identity: *"Name your club. This is how rivals will know you on the leaderboard."* (2) Add a brief "here's what you get" value reminder on the first onboarding step — show the 3 card types as mini icons with one-word labels (Result · Goals · Supersub) to prime users before they start. (3) Pre-populate a starter card gift: after `club_name` is set, ensure the profile receives 3 Match Result cards, 2 Total Goals cards, 1 Supersub card (this is likely already in a migration — verify in `supabase/migrations/` and confirm it fires correctly for new signups). (4) Confirm the redirect chain: `/onboarding` complete → `/dashboard` (not `/manager-office`) — this should already be correct.
- **Dependencies:** Signup page redesign (must ship together for cohesive funnel feel).

### Funnel analytics events
- **Priority:** P1
- **Effort:** S
- **Why (commercial link):** Without visibility into the `/intro` → `/signup` → `/onboarding` → `/dashboard` funnel, there is no way to know where users drop off. Affiliate partners will ask for MAU and conversion data — this story produces it.
- **What exists today:** `InteractiveOnboarding.jsx` has 5 phases (bench → match → subs → confirm → payoff) but fires no analytics events. No drop-off tracking anywhere in the funnel.
- **What needs building:** (1) Migration: create `analytics_events` table `(id UUID DEFAULT gen_random_uuid(), session_id TEXT, event TEXT, properties JSONB, created_at TIMESTAMPTZ DEFAULT now())`. No `user_id` on early funnel events (user is not yet authenticated). Session ID generated client-side with `crypto.randomUUID()` and stored in `sessionStorage`. RLS: anon users can INSERT, no SELECT. (2) Fire events at: `onboarding_phase_started` (with phase name), `onboarding_phase_completed`, `signup_page_viewed`, `signup_attempted`, `signup_completed`, `onboarding_club_name_set`. (3) Place event calls in `InteractiveOnboarding.jsx` phase transitions (the `setPhase()` calls), `Signup.jsx` `handleSignup()` function, and `Onboarding.jsx` submit. (4) A simple Supabase query groups by event and date for a funnel report: no external analytics provider needed initially. Plausible or PostHog can be added later as a drop-in.
- **Dependencies:** None — table migration is self-contained. Can ship independently of other funnel stories.

### Post-signup welcome card gift confirmation
- **Priority:** P1
- **Effort:** XS
- **Why (commercial link):** First-session retention depends on the user immediately understanding the card economy and having something to spend. If a new user arrives at Dashboard with 0 cards, the value proposition evaporates.
- **What exists today:** There is likely a migration that seeds starter inventory for new users (check `supabase/migrations/` for INSERT into `inventory`). `GameContext.jsx` `loadProfile()` fetches `inventoryMap` — the counts should appear in the LockerRoom. It is unclear whether the seed fires reliably for Supabase Auth signups (trigger-based vs manual).
- **What needs building:** (1) Verify in Supabase that new user signups receive starter cards (check the `handle_new_user()` trigger in migrations — it should INSERT into `inventory`). If it works: add a visual confirmation on the `Dashboard.jsx` first load — a one-time toast or banner: "Your starter cards are ready. Make your first call." with a link to `/match-hub`. If it's broken: fix the trigger. (2) Add `has_seen_welcome BOOLEAN DEFAULT false` to `profiles` and show a dismissible welcome banner on first Dashboard visit only.
- **Dependencies:** Signup page redesign (same sprint). Onboarding club name collection.

---

## PERFORMANCE & MULTI-MARKET

### 3G performance optimisation
- **Priority:** P2
- **Effort:** M
- **Why (commercial link):** Slide 8 — Tier 2 markets (Nigeria, Ghana): "Performance on 3G critical." The app must load and function on slow mobile connections.
- **What exists today:** Images use `.webp` format (good). `useAssetPreloader.js` preloads critical images. `ManagerOffice` is the only lazily-loaded route (`React.lazy()` in `App.jsx`). No bundle analysis, no image lazy loading attributes, no responsive srcset, no service worker.
- **What needs building:** Route-based code splitting — wrap all feature routes in `React.lazy()` + `Suspense` (MatchDetail, LeagueHub, Leaderboard, Training, LockerRoom are all eager-loaded). Add `loading="lazy"` to non-critical images. Add responsive `srcset` for background images. Run `vite-bundle-visualizer` to identify bloat. Consider a "lite mode" that skips background images on slow connections. Add Vercel Edge caching headers for API responses.
- **Dependencies:** None.

### Localisation framework
- **Priority:** P3
- **Effort:** L
- **Why (commercial link):** Slide 8 — Tier 3 (Brazil): "Portuguese localisation essential." All UI text is currently hardcoded English.
- **What exists today:** Nothing. No i18n library, no locale detection, no translation files. Every string in every component is inline English.
- **What needs building:** Install `react-i18next`. Extract all user-facing strings into translation JSON files (`en.json`, `pt-BR.json`). Add language picker to Settings. Detect browser locale on first visit. This is a large refactor touching every component with user-facing text.
- **Dependencies:** None technically, but should be done after feature set stabilises (post-World Cup) to avoid translating strings that change.

### Liga Portugal / Brasileirão coverage
- **Priority:** P3
- **Effort:** M
- **Why (commercial link):** Slide 8 — Tier 2/3 market entry requires local league coverage. Nigeria works with EPL. Brazil needs Brasileirão.
- **What exists today:** `coverage.js` has Liga Portugal (94) commented out or was previously included (per project memory). Sportmonks has Brasileirão data.
- **What needs building:** Add Brasileirão Sportmonks ID to `coverage.js`. Run `backfill-sportmonks.js` for the new league. Verify `sync-standings.js`, `sync-supersub-stats.js`, and `sync-news-intel.js` work for the new league. Add league to `LeagueHub.jsx` dropdown. Source Portuguese-language news RSS feeds for Brazil.
- **Dependencies:** Localisation framework (for Brazilian users).

---

## DATA LICENSING (B2B)

### Bench analytics API
- **Priority:** P3
- **Effort:** M
- **Why (commercial link):** Slide 7 — "Bench analytics feed: coach substitution patterns, sub-on scoring efficiency, team bench rates. B2B revenue, no user scale required."
- **What exists today:** All the data exists: `team_bench_stats`, `player_supersub_stats`, `coach_substitution_patterns` tables are populated by `sync-supersub-stats.js` and `sync-coaches.js`. The data is consumed internally by `api/intel.js` and `api/league.js` (bench watch tab). But there's no external-facing API or documentation.
- **What needs building:** A dedicated `/api/bench-analytics` endpoint (or a separate API service) with API key authentication, rate limiting, and structured JSON responses. Documentation page. Usage metering for billing. Consider hosting separately from the Vercel Hobby plan to avoid the 12-function limit.
- **Dependencies:** Sufficient data coverage across leagues. API key management system.
