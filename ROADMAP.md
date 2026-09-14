# Quest Product Roadmap

## Goal
Turn Quest from a personal productivity dashboard into a reliable, installable, offline-first productivity app that learns how long the user actually takes to complete work and improves future estimates.

## Guiding rule
Do not spend money early unless a stage specifically requires it. Keep the product on free tiers while validating that people genuinely use it.

---

## Phase 0 — Current MVP
**Status: in progress**

- React + Vite web app
- Supabase login and persistence
- Quest/domain system
- Tasks with XP, dates and times
- Daily anchors/routines
- Daily and weekly XP
- Rewards
- Odyssey visual theme
- Mobile/iPhone layout
- Task estimate vs actual time learning

### Before moving on
Finish the remaining core feature ideas that materially affect how Quest works.

---

## Phase 1 — Product cleanup
**Goal: make the current website feel stable enough to use every day.**

- Finish remaining core features
- Fix bugs and edge cases
- Polish iPhone layout
- Improve onboarding for a first-time user
- Make task creation/editing simple
- Make time estimates easy to understand
- Make weekly XP mathematically clear
- Keep existing users' saved data safe during updates

### Exit condition
Quest feels good enough that the founder personally wants to use it every day.

---

## Phase 2 — PWA
**Goal: install Quest on iPhone like an app.**

- Add web app manifest
- Add app icon
- Add Apple touch icon
- Add standalone display mode
- Add theme/status-bar styling
- Add splash/loading polish
- Make safe-area spacing work around iPhone notch/Dynamic Island
- Verify Add to Home Screen flow in Safari

### Cost target
$0 while using the current free hosting/backend setup for personal/non-commercial beta use.

---

## Phase 3 — Offline-first Quest
**Goal: Quest should remain useful with bad or no internet.**

- Cache the app shell so it opens offline
- Store tasks/quests/anchors locally on device
- Allow create/edit/complete actions offline
- Queue changes locally
- Sync automatically with Supabase when internet returns
- Handle conflicts safely when two devices change the same task
- Show clear sync state: synced / waiting / conflict

### Exit condition
A user can spend a full day using Quest without internet and lose no work.

---

## Phase 4 — Real data model
**Goal: prepare for more than one serious user.**

Move away from relying primarily on one large JSON state object and introduce structured tables such as:

- users/profiles
- quests
- tasks
- task_completions
- anchors
- anchor_completions
- time_estimates
- time_history
- rewards
- user_settings

Also add:

- Row Level Security review
- database indexes
- migrations
- backup/recovery plan
- data export/delete support

### Exit condition
The database can safely support a private beta without fragile state migrations.

---

## Phase 5 — Quest intelligence
**Goal: make the learning system the product advantage.**

Examples:

- learn task duration by **quest + task identity**
- distinguish French > Anki from Dentistry > Anki
- compare estimated vs actual time
- detect chronic underestimation/overestimation
- predict how long today's workload will really take
- warn when a day is overloaded
- suggest realistic task placement
- learn recent performance more strongly than old performance

### Product thesis
Quest should become more than a to-do list: it should learn how the user actually works and help them plan realistically.

---

## Phase 6 — Private beta
**Goal: test whether other people actually want it.**

Start small: roughly 10–30 testers.

Track:

- Do they come back after day 1 / week 1?
- Do they understand XP and quests?
- Do they use time estimates?
- What do they ignore?
- What causes them to quit?
- Which features actually help them plan better?

Add:

- feedback button
- basic analytics
- crash/error reporting
- onboarding improvements
- privacy policy
- terms

### Exit condition
A meaningful portion of testers keep using Quest without being reminded.

---

## Phase 7 — Native mobile app
**Goal: turn the same product into App Store / Play Store apps.**

Use Capacitor rather than rewriting the entire app.

Add native capabilities where useful:

- notifications
- badges
- haptics
- widgets later
- better background behavior
- native sharing

### iPhone path
- Capacitor iOS wrapper
- Apple Developer account
- TestFlight
- App Store review

### Android path
- Capacitor Android wrapper
- Play Console account
- closed testing
- Play Store release

---

## Phase 8 — Public launch
**Goal: launch Quest as a real product.**

- final brand/name check
- domain
- landing page
- App Store screenshots
- product demo
- support email
- public roadmap / changelog
- pricing decision
- support process
- backups and monitoring
- release process

Do not rush monetization before retention is proven.

---

# Minimum-cost strategy

## Stage A — Personal use / early PWA beta
Target: **$0**

- Vercel free Hobby while use remains personal/non-commercial
- Supabase Free
- GitHub Free
- free Vercel subdomain

Optional custom domain: usually around **$10–20/year**, depending on the domain and registrar.

## Stage B — iPhone App Store release
Required Apple Developer Program membership: **$99/year**.

You can skip Android at first if the first real users are mainly iPhone users.

## Stage C — Android release
Google Play full distribution developer registration: **$25 one time**.

## Stage D — only when growth or commercial use requires it
Possible upgrades:

- Vercel Pro: currently $20/month
- Supabase Pro: currently starts at $25/month

Do not upgrade just because the plans exist. Upgrade when traffic, production reliability, commercial terms, backups, or capacity actually require it.

---

# Recommended order from today

**Remaining feature ideas**
→ **stabilize current website**
→ **make it an installable PWA**
→ **polish iPhone experience**
→ **build offline-first sync**
→ **clean up the database architecture**
→ **use it personally for several weeks**
→ **private beta**
→ **improve based on retention/feedback**
→ **Capacitor + TestFlight**
→ **App Store launch**
→ **Android later if demand exists**

---

## Current rule for feature work
If a feature changes Quest's core behavior, build and validate it on the web codebase **before** making the offline sync/native layers more complicated.

PWA installability itself can be added early because it uses the same React app and does not stop future feature work.
