# Supersub — Product Backlog

> Cross-referenced against pitch deck (`supersub_pitch.pptx`), live codebase, and `SUPERSUB_PROJECT_SUMMARY.md`.
> Priorities: **P0** = World Cup blocker (ship by April 2026) · **P1** = Required before affiliate conversations · **P2** = Retention & organic growth · **P3** = Future market expansion

---

## LEGAL & COMPLIANCE

Everything in this epic is a hard prerequisite for any affiliate revenue conversation. No operator will sign a deal without these in place. None of it exists today.

### Privacy Policy and Terms of Service documents
- **Priority:** P0
- **Effort:** S
- **Why (commercial link):** UKGC affiliate registration requires a live ToS and PP before any operator will discuss commercial terms. Also required before collecting country_code or DOB at signup (GDPR data processing basis).
- **What exists today:** No ToS or PP pages, no `/terms` or `/privacy` routes, no legal copy anywhere in the app.
- **What needs building:** Two static pages: `/terms` and `/privacy`. Add routes in `App.jsx` (public, no `ProtectedRoute`). Add to `vercel.json` rewrites. Content: standard SaaS ToS adapted for a free-to-play prediction game (no real money, no gambling licence required at this stage) plus a GDPR-compliant PP covering Supabase data storage, Sportmonks data use, and affiliate link tracking. Add footer links on `Landing.jsx`, `Signup.jsx`, and all affiliate CTA components.
- **Dependencies:** None — can be written and deployed independently of all other stories.

### ToS acceptance and 18+ confirmation at signup
- **Priority:** P0
- **Effort:** S
- **Why (commercial link):** UKGC affiliate operators require evidence that users have confirmed they are 18+ and accepted terms before being shown affiliate content. This is also required before any partner will share a tracking link.
- **What exists today:** `Signup.jsx` has email + password only. No checkbox, no age confirmation, no legal acceptance. The `profiles` table has no `terms_accepted_at` or `dob` column.
- **What needs building:** (1) Add a migration: `ALTER TABLE profiles ADD COLUMN terms_accepted_at TIMESTAMPTZ; ADD COLUMN is_age_verified BOOLEAN DEFAULT false;`. (2) In `Signup.jsx`, add two required checkboxes below the password field: "I confirm I am 18 or over" and "I agree to the Terms of Service and Privacy Policy" (with inline links to `/terms` and `/privacy`). Block form submission unless both are checked. (3) On successful signup, write `terms_accepted_at = NOW()` and `is_age_verified = true` to `profiles` via `supabase.from('profiles').update(...)`. (4) Gate all affiliate CTA rendering in `PostPredictionSheet.jsx` and `WinCelebrationModal.jsx` on `userProfile.is_age_verified === true`.
- **Dependencies:** Privacy Policy and Terms of Service pages (must be live before linking from signup).

### `<AffiliateDisclaimer />` component
- **Priority:** P0
- **Effort:** XS
- **Why (commercial link):** Every affiliate placement must display "18+ | BeGambleAware.org | T&Cs apply" to satisfy UKGC affiliate guidelines. Operators will check for this before approving creatives.
- **What exists today:** Nothing. No responsible gambling copy anywhere.
- **What needs building:** A small shared component at `src/shared/ui/AffiliateDisclaimer.jsx`. Renders a single line: "18+ · BeGambleAware.org · T&Cs apply · Play responsibly." with a link to `https://www.begambleaware.org`. Style: `text-[9px] text-white/30 uppercase tracking-widest text-center`. Render this component at the bottom of every `PostPredictionSheet`, `WinCelebrationModal`, and any future affiliate placement. Takes an optional `operator` prop to add "Bet with [Operator]" text.
- **Dependencies:** None.

### 18+ badge on Landing.jsx
- **Priority:** P0
- **Effort:** XS
- **Why (commercial link):** A visible 18+ marker on the entry point is a basic requirement for any operator to list Supersub as a partner on their affiliate directory. Takes 10 minutes to build.
- **What exists today:** `Landing.jsx` has a logo, two buttons (Join / Login), and a stadium background. No compliance markers.
- **What needs building:** Add a small "18+" pill in the bottom-right corner of `Landing.jsx`. Style to match the existing design language — dark background, white/grey text, same font weight as other small labels. Also add "BeGambleAware.org" as a subtle text link in the footer of the landing view.
- **Dependencies:** None.

---

## AFFILIATE REVENUE ENGINE

The pitch deck's core commercial model. Three revenue streams: post-prediction contextual ads, post-win affiliate offers, and bench analytics data licensing. None are live.

### `seen_by_user` flag on predictions (DB migration)
- **Priority:** P0
- **Effort:** XS
- **Why (commercial link):** The post-settlement CTA depends on detecting unseen settled bets when the user opens the app. Without this flag, there is no way to show the modal exactly once per settled prediction.
- **What exists today:** `predictions` table has no `seen_by_user` column. The `settle_prediction()` RPC sets `status = 'SETTLED'` but does not track user awareness.
- **What needs building:** Migration: `ALTER TABLE predictions ADD COLUMN seen_by_user BOOLEAN NOT NULL DEFAULT false;`. Update `settle_prediction()` RPC to leave `seen_by_user = false` on settlement (it already does — this is the default). Add a `markPredictionsSeen(ids[])` helper to `GameContext.jsx` that sets `seen_by_user = true` for a batch of prediction IDs. This helper is called when the `WinCelebrationModal` dismisses.
- **Dependencies:** None — pure DB change, no UI impact.

### `useAffiliateLink()` utility and operator config
- **Priority:** P0
- **Effort:** S
- **Why (commercial link):** Both affiliate CTA components (post-prediction and post-settlement) need a shared, tested utility that constructs affiliate URLs with correct tracking parameters. Without this, each operator integration is a one-off hack.
- **What exists today:** Nothing. No operator config, no link builder, no tracking parameter schema.
- **What needs building:** (1) A config file at `src/shared/config/affiliates.js` that exports a list of operators: `{ id: 'sky_bet', name: 'Sky Bet', baseUrl: 'https://...', trackingParam: 'btag', brandColor: '#...' }`. Initially one entry (Bet365 or Sky Bet, whichever signs first — use a placeholder). (2) A `useAffiliateLink(operator, cardType, selection, odds)` hook at `src/shared/hooks/useAffiliateLink.js` that returns a full affiliate URL with deep link to the relevant market where possible. (3) The hook also computes the display return figure: `(stake * odds).toFixed(2)` using a default stake (£10 GBP, configurable). (4) Currency/locale is read from `userProfile.country_code` — UK = £, DE = €, ES = €. Initially only GBP.
- **Dependencies:** `seen_by_user` migration (same sprint). Operator agreement (provides real tracking URL and btag format).

### Post-prediction bottom sheet (`PostPredictionSheet.jsx`)
- **Priority:** P0
- **Effort:** M
- **Why (commercial link):** Slide 7 — "After placing a card, users see: 'This call could return £35 for £10 at Sky Bet.'" This is the highest-volume affiliate touchpoint — every single card placement triggers it.
- **What exists today:** In `MatchDetail.jsx`, after `consumeCard()` succeeds at line ~846, a success toast fires and the UI returns to the match view. No interstitial, no offer, no upsell.
- **What needs building:** (1) Create `src/features/match-day/PostPredictionSheet.jsx` — a slide-up bottom sheet that appears for 8 seconds after a successful card placement. Props: `{ cardType, selectionLabel, odds, onDismiss }`. Shows: "Nice call — [SELECTION LABEL]" headline, the computed return figure ("£10 → £35 at Sky Bet"), operator logo, a primary CTA button ("Place at Sky Bet →"), and a secondary "Dismiss" link. Renders `<AffiliateDisclaimer />` at the bottom. (2) In `MatchDetail.jsx`, after the `consumeCard()` success branch, set state `showAffiliatSheet: true` and pass the staged bet details. (3) On CTA click: call `trackAffiliate({ type: 'click', ... })` then `window.open(affiliateUrl, '_blank')`. On impression: call `trackAffiliate({ type: 'impression', ... })`. Auto-dismiss after 8s. (4) Only render if `userProfile.is_age_verified === true`.
- **Dependencies:** `useAffiliateLink()` utility. `<AffiliateDisclaimer />` component. ToS/18+ acceptance at signup.

### Post-settlement celebration modal with affiliate CTA (`WinCelebrationModal.jsx`)
- **Priority:** P0
- **Effort:** M
- **Why (commercial link):** Slide 7 — "Settled winning prediction: the win context makes the offer feel like a reward, not a push. Highest CTR moment." Post-win is the single highest-intent moment in the app.
- **What exists today:** `WinModal.jsx` is used only in `InteractiveOnboarding.jsx` (the 1999 tutorial). It has a trophy, confetti, and points display — but no share button and no affiliate CTA. `ViewLedger.jsx` shows settled bets in a plain list. No modal fires when a real prediction settles. `GameContext.jsx` `loadProfile()` fetches the user profile but does not check for unseen settled bets.
- **What needs building:** (1) Create `src/shared/ui/WinCelebrationModal.jsx` — different from the existing `WinModal.jsx` (keep that for onboarding). Props: `{ prediction, onShare, onAffiliateCTA, onDismiss }`. WON variant: trophy icon, "YOU CALLED IT" heading, points earned, share button, and affiliate CTA ("You could have won £87.50 on this at Sky Bet"). LOST variant: muted styling, "Unlucky" heading, and softer affiliate CTA ("Place it for real next time at Sky Bet"). Both variants include `<AffiliateDisclaimer />`. (2) In `GameContext.jsx` `loadProfile()`, after fetching the profile, query `predictions` for `status = 'SETTLED' AND seen_by_user = false` — if any exist, store them in context state as `unseenSettlements`. (3) In `Dashboard.jsx` or a root-level component, when `unseenSettlements.length > 0`, show `WinCelebrationModal` for the first unseen prediction. On dismiss, call `markPredictionsSeen([id])` and advance to the next if any remain. (4) Add a share button — hooks into the shareable card flow (see SHAREABLE CARDS epic). (5) Only render if `userProfile.is_age_verified === true`.
- **Dependencies:** `seen_by_user` DB migration. `useAffiliateLink()` utility. `<AffiliateDisclaimer />` component. Pre-settlement shareable card (for the share button — can ship modal without share and add it in sprint 2).

### Affiliate impression & click tracking
- **Priority:** P1
- **Effort:** S
- **Why (commercial link):** Operators require CTR and conversion data before committing to commercial terms. This is the proof of volume needed to negotiate a CPA rate.
- **What exists today:** Nothing. No tracking tables, no analytics events.
- **What needs building:** (1) Migration: create `affiliate_events` table `(id UUID, user_id UUID, event_type TEXT CHECK IN ('impression','click'), operator TEXT, card_type TEXT, match_id INT, odds FLOAT, created_at TIMESTAMPTZ)`. RLS: users can insert their own rows, no select. (2) `src/shared/utils/trackAffiliate.js` — lightweight fire-and-forget utility: `supabase.from('affiliate_events').insert(event)`. No await needed (best-effort logging). (3) A Supabase view `affiliate_summary` grouping by operator/date/card_type for reporting. Export as CSV for operator conversations.
- **Dependencies:** `PostPredictionSheet.jsx` and `WinCelebrationModal.jsx` (the callers).

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

### `share_token` column on predictions (DB migration)
- **Priority:** P0
- **Effort:** XS
- **Why (commercial link):** Public share URLs cannot expose internal prediction UUIDs. A short opaque token enables public links without leaking user data.
- **What exists today:** `predictions` table has a UUID primary key — unsuitable for public URLs.
- **What needs building:** Migration: `ALTER TABLE predictions ADD COLUMN share_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE;`. Add index: `CREATE INDEX idx_predictions_share_token ON predictions(share_token)`. The share URL becomes `supersub.mobi/share/<share_token>` — opaque, unguessable, non-sequential. No RLS change needed; the `/share/:token` route uses the service role key server-side (or anon key with a policy allowing SELECT on share_token lookups for non-sensitive columns only).
- **Dependencies:** None — pure DB migration, no UI impact.

### `/api/share-card` image generation endpoint
- **Priority:** P0
- **Effort:** M
- **Why (commercial link):** Without a server-generated OG image, links shared on Twitter/WhatsApp/iMessage render as plain text. A rich preview image is the difference between a click and a scroll-past. This is the visual hook that drives World Cup acquisition.
- **What exists today:** Nothing. No image generation anywhere in the codebase. Currently 6/12 Vercel functions used — this would be the 7th, leaving 5 slots.
- **What needs building:** New `api/share-card.js` endpoint using `@vercel/og`. Accepts `?token=<share_token>`. Looks up the prediction by share_token (service role). Renders a 1200×630 OG image with: Supersub branding (logo top-left), match name (e.g., "Arsenal vs Chelsea"), card type badge, selection text ("Supersub — Trossard to Score"), odds or points awarded (for settled cards), team colours, and a footer: "Play free at supersub.mobi". For WON predictions: adds a green "✓ CALLED IT" badge and points earned. For LOST: adds a muted "X" badge. The image uses inline styles (Satori/Vercel OG constraints — no Tailwind classes, no external CSS). Cache with `Cache-Control: public, max-age=3600` for performance.
- **Dependencies:** `share_token` migration. `@vercel/og` package install (`npm install @vercel/og`).

### `ShareCardButton.jsx` — share trigger component
- **Priority:** P0
- **Effort:** S
- **Why (commercial link):** The share button needs to appear in four places. A single reusable component ensures consistent behaviour and tracking across all placement points.
- **What exists today:** Nothing. No share UI anywhere in the app.
- **What needs building:** Create `src/shared/ui/ShareCardButton.jsx`. Props: `{ prediction, variant: 'pre' | 'won' | 'lost' }`. On tap: (1) Build the share URL: `https://supersub.mobi/share/${prediction.share_token}`. (2) Use the Web Share API (`navigator.share({ title, text, url })`) on mobile — this surfaces native iOS/Android share sheets covering WhatsApp, iMessage, Twitter, Instagram. (3) Fall back to `navigator.clipboard.writeText(url)` + a "Link copied!" toast (`sonner`) on desktop. (4) Log a `trackAffiliate({ type: 'share', ... })` event for tracking. Mount this button in: `MatchDetail.jsx` confirmation screen (pre-settlement), `WinCelebrationModal.jsx` (post-win), `ViewLedger.jsx` card rows (post-settlement), `ViewLive.jsx` active bet rows.
- **Dependencies:** `share_token` migration. `/api/share-card` endpoint (for the OG image — button works before image endpoint is live, just with plain link previews).

### Pre-settlement shareable card ("I'm calling this")
- **Priority:** P0
- **Effort:** S (reduced — infrastructure now handled by the two stories above)
- **Why (commercial link):** Slide 9 — "Pre-settlement bravado cards." Shared before a match, these drive awareness and bring new users into the onboarding funnel before they know the result.
- **What exists today:** No share button on the prediction confirmation screen in `MatchDetail.jsx`.
- **What needs building:** After `consumeCard()` succeeds and `PostPredictionSheet.jsx` is shown, add a "Share your call" secondary action inside the sheet. On tap: invoke `ShareCardButton` with `variant='pre'`. The shared OG image (generated by `/api/share-card`) will show the selection, odds, and "I'm calling this" framing. The shared link `/share/:token` opens `PublicShareView.jsx` (see below) with a "Can you call it? Play free →" CTA pointing to `/signup`. Copy template for pre-settlement Twitter/WhatsApp share: *"I'm calling [SELECTION] on [MATCH]. Can you call it? Play free at supersub.mobi 🎯"*.
- **Dependencies:** `ShareCardButton.jsx`. `PostPredictionSheet.jsx` (affiliate story). `/api/share-card` endpoint.

### Post-win shareable card ("I called it")
- **Priority:** P0
- **Effort:** XS (incremental — infrastructure complete)
- **Why (commercial link):** Slide 9 — "Post-win celebration cards ('I called it — 2,500 pts')." The emotional peak moment is the highest-conversion share trigger. A won Supersub call on a World Cup match going viral is the PR story the pitch deck is built around.
- **What exists today:** `WinModal.jsx` has a celebration UI but no share button. `ViewLedger.jsx` shows settled bets with no sharing.
- **What needs building:** Add `<ShareCardButton prediction={prediction} variant='won' />` inside `WinCelebrationModal.jsx` (between the points display and the affiliate CTA). Also add a smaller share icon to each WON row in `ViewLedger.jsx`. Copy template for post-win share: *"I called it. [SELECTION] — [MATCH]. +[POINTS] pts on Supersub 🏆 supersub.mobi/share/[token]"*. The `/api/share-card` endpoint already handles the WON badge for won predictions — no additional endpoint work needed.
- **Dependencies:** `ShareCardButton.jsx`. `WinCelebrationModal.jsx` (affiliate story).

### Public share view and OG meta tags (`PublicShareView.jsx`)
- **Priority:** P0
- **Effort:** S
- **Why (commercial link):** The share link must resolve to a page that (a) shows the prediction to non-users, (b) prompts signup, and (c) renders correct OG meta tags so Twitter/WhatsApp display the card image rather than a blank link. Without this, the share loop breaks at the click.
- **What exists today:** No public routes for shared predictions. `index.html` has no OG meta tags at all.
- **What needs building:** (1) Add default OG tags to `index.html`: `og:title` ("Supersub — Call the sub"), `og:description`, `og:image` (a static default card image), `og:url`. (2) Create `src/pages/PublicShareView.jsx` — a public route (no `ProtectedRoute`) that reads `:token` from the URL, fetches prediction details from `/api/matches` (or a new thin public endpoint), and renders: the prediction card, match context, and a prominent "Play free — make your own call" CTA pointing to `/intro` (re-enter the onboarding funnel). (3) For dynamic OG images: Twitter/WhatsApp crawlers hit the `/share/:token` URL. Inject per-page OG meta via a lightweight `react-helmet` or meta tag update in the route component (`document.querySelector('meta[property="og:image"]').content = ...`). This works for in-app browsers (WhatsApp preview). For Twitter's crawler: the `/api/share-card` endpoint returns the image at a predictable URL structure so the OG tag can reference it directly. (4) Add `/share/:token` to `App.jsx` routes and `vercel.json` rewrites.
- **Dependencies:** `share_token` migration. `/api/share-card` endpoint. `ShareCardButton.jsx`.

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
