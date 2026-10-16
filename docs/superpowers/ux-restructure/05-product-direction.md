# Product direction: will this app actually get used? (2026-10-16)

The owner asked: step back. Is this genuinely helpful, or an app that gets installed and never opened? Do the features serve a purpose? Should we add or change things? Can it be more connected? What is the end-to-end timeline? This file is the primary agent's answer. The questions at the bottom await owner decisions.

Inputs: `docs/MARKET_RESEARCH.md`, `docs/PRODUCT_SPEC.md`, `docs/FEATURE_SCOPE.md`, `docs/PWA_SYNC_NOTIFICATIONS_ROADMAP.md`, `docs/R21_ICS_OVERLAY_READINESS.md`, `02-competitor-patterns.md`, and interview Q1–Q51.

## 1. Verdict
The plan is good, but it is not yet enough to beat "installed, never opened." The redesign makes the app beautiful and coherent *once you are inside it*. Planner apps don't die from ugliness. They die because the app is never the place the information already lives, and it never calls you back. Two additions fix that: **capture from everywhere** and **the app reaching out to you** (nudges plus meetings). Most of the pieces exist, so this is a sequencing change, not a rewrite.

## 2. Why planners get abandoned, and where we stand

| Why people stop opening a planner | Our plan today | Gap |
|---|---|---|
| **The plan is wrong because meetings live elsewhere.** The planner says "6h free"; Google Calendar says otherwise. | Q50 Google OAuth, Q51 meetings everywhere, capacity counts them | Covered once built |
| **Tasks are born elsewhere** (email, WhatsApp, browser, a thought while walking), so the app goes stale | In-app Capture only (plus natural-language quick add, `shared/naturalLanguageTask.ts`) | **Big gap** |
| **The app never calls you back.** You must remember to open it. | Web push is deployed (Phase 3), but only for task reminders | **Gap:** no morning "plan your day", no evening shutdown nudge, no meeting alerts yet |
| **Upkeep costs more than it gives.** Re-planning every day is a chore. | Plan my day (3 moves, ~2 min), shutdown (1 min), weekly ritual | Covered; the build must keep these truly short |
| **Too many places to look** | The restructure cut duplicates (Roadmap → Goals lens, Review+Analytics → Insights, one board concept) | Covered |

## 3. What really matters: the daily loop
Everything should serve one loop:

**Morning** (nudge) → *Plan my day*, 2 min → **day**: Today + Focus + meeting alerts → **evening** (nudge) → *Shut down*, 1 min → **Sunday**: the *Week* ritual, 10 min.

- **Core** (opened daily; build first, highest polish): Today, Plan my day, Shut down, Focus, Capture/Inbox, the Calendar with real meetings, push nudges.
- **Support** (weekly): the Week ritual, Tasks List/Board, Habits.
- **Depth** (monthly or occasional): Goals Overview/Timeline, Insights, saved views, Archive, bulk actions.

Depth features stay, because they are approved, but they come **after** the core loop is excellent. A beautiful Goals Timeline doesn't make someone open the app tomorrow morning; a 7:45 nudge with "3 tasks + 2 meetings, plan in 2 min" does.

Success test (dogfooding, owner): opened on 5 or more days a week for 2 weeks, with Plan my day done on at least 4 of them. If not, fix the loop before building more depth.

## 4. Connectors: making it "help from everywhere" (honest feasibility)

| Connector | What it gives | Feasibility | Recommendation |
|---|---|---|---|
| **Google Calendar (OAuth)** | Real meetings, Meet links, capacity truth, time blocks written back | Decided in Q50. Note: an app in Google "Testing" status gets refresh tokens that expire after 7 days. For personal use the fix is publishing as an unverified production app (warning screen, ≤100 users) or completing verification. Confirm at setup. | **Now** (phase C) |
| **Universal Inbox API** (one secure personal endpoint + token) | Anything can create an Inbox task | Our server; small; a token stored securely | **Now.** It unlocks everything below |
| **Apple Shortcuts / Siri / Share Sheet** | "Hey Siri, add to planner"; share a link or text from any iPhone app | iOS PWAs can't receive the Share Sheet directly (Web Share Target isn't supported on iOS), but a Shortcut calling the Inbox API works | **Now** (rides on the Inbox API) |
| **n8n** (the owner already runs it) | Gmail label → task; job-scorer follow-ups → tasks; RSS, Slack and others | n8n holds its own Gmail access, so **our app avoids Gmail's "restricted" scope**, which would need a paid security assessment | **Now** (rides on the Inbox API) |
| **Email-in address** (forward an email → task) | Works from any mail app | Needs an inbound-mail service (infra, gated) | Later, or via n8n |
| **Push nudges** | Morning plan, evening shutdown, meeting in N min with Join, deadline today | Push infra deployed; needs scheduler rules | **Now** |
| **Apple Calendar** | See iCloud events | Read-only via the iCloud subscription link (no OAuth exists); outbound feed already built | Keep as built |
| **Apple Reminders / Health / Screen Time** | | **Impossible from a web app** | No |
| **Microsoft Outlook (Graph)** | Work calendars | Same pattern as Google | Later, if needed |
| **AI assist** (Claude API) | "Suggest my day" draft, break a vague task into steps, weekly review summary | Drafts only, the owner confirms (FEATURE_SCOPE rule). Costs API usage; needs a key (gated secret) | Later (phase F), optional |

## 5. Settings
Covered by Q39 (one scrolling page with anchors; plain Connections) and prototype #7 (Nav + Settings). The owner is fine with the primary designing the details. Sections:
1. **Planning:** work hours, planning day, preferred shutdown time, capacity.
2. **Notifications:** morning nudge time, evening nudge, meeting lead time, deadline alerts, per device.
3. **Connections:** Google Calendar, Apple feed, Inbox API token + Shortcut install link + n8n how-to.
4. **Appearance:** theme, motion.
5. **Navigation:** phone bar customisation.
6. **Categories & Projects.**
7. **Data:** archive, recycle bin (deleted categories/projects), export.
8. **Account.**

The workspace timezone sits in Planning (the owner checks it, Q48).

## 6. End-to-end timeline (estimate)
Assumptions:
- About 1–2 work sessions a day, often cut by usage limits.
- At most 2 agents at once.
- The owner reviews each prototype within about a day.
- Every Fable run is owner-confirmed.

Dates are targets, not promises.

| Phase | Dates (2026) | What | Who |
|---|---|---|---|
| A. Prototypes | Oct 16–24 | Today+Focus, Calendar, Week, Nav+Settings, then Goals, Habits, Insights (7 Fable runs, each confirmed) | Fable designs, owner approves |
| B. Core loop build | Oct 20–Nov 2 | Tasks page (T1 logic running now → T2 UI); Today + Plan my day + Shut down; Focus upgrades; rail/phone bar + D3.5 hooks mounted; Settings | Opus |
| C. Connected | Oct 27–Nov 9 | Push nudges; Inbox API + iOS Shortcut + n8n recipe; Google OAuth sync + meetings + Join + reminders | Opus; **owner does the gated steps** (Google Cloud project, secrets, migration approval) |
| D. Planning surfaces | Nov 3–16 | Calendar (total redesign), Week ritual, D4 reasons mounted everywhere | Opus |
| E. Depth | Nov 10–23 | Goals (Overview + Timeline), Habits, Insights (D5) | Opus |
| F. Finish | Nov 17–30 | M2 motion pass, D6 empty/first-run states, D3.5.2 browser verification, V visual audit, D7 glance/badges, optional AI assist | Opus + Fable audit |
| G. Release | from ~Dec 1 | Preview checks, the owner's physical-iPhone test, then G1–G3 gates and production, **only when the owner says** | Owner-gated |

**About 6–7 weeks to feature-complete, at the current pace.** The biggest schedule risks are usage limits, owner review turnaround, and the Google OAuth setup and verification.

## 7. Owner decisions requested
- **P1:** adopt the "core loop first" build order (B before D/E)?
- **P2:** add the Universal Inbox API + iOS Shortcut + n8n recipe?
- **P3:** add push nudges (morning plan, evening shutdown, meeting alerts)?
- **P4:** AI assist later (drafts only)?

## 8. Owner answers (2026-10-16)
- **P1 Build order:** core loop first. Order: Tasks → Today/Plan/Shutdown → Focus → Nav + Settings, then Calendar/Week, then Goals/Habits/Insights.
- **P2 Capture:** yes, all three (Inbox API, iOS Shortcut/Siri, n8n). The owner also wants to think about **using n8n more widely** ("connect more if possible or needed"). See §9.
- **P3 Nudges:** yes, all three: morning plan, evening shutdown, meeting in N min with Join.
- **P4 AI assist:** later (phase F), drafts only.

## 9. n8n: what else it can connect (ideas, to design in phase C)
n8n is the owner's automation hub, so the planner exposes a **small personal API** and n8n does the wiring. That keeps every third-party credential out of our app.

**API surface needed (one personal token, scoped, revocable, rate-limited):**
- `POST /inbox`: create an Inbox task (title, notes, link, source, optional deadline/category)
- `POST /habits/:id/check`: tick a habit for a date
- `GET /today` / `GET /week-summary`: read-only digests
- An **outbound webhook** (optional): task completed or habit ticked → n8n

Token storage may need a migration, which is **gated** (owner approval).

| Idea | Flow | Value |
|---|---|---|
| Gmail label → task | Label an email "Planner" → Inbox task with a link back to the email | Email becomes actionable without Gmail scopes in our app |
| Job-scorer follow-ups | Application logged → "Follow up with X" task in 7 days; interview invite email → task + deadline | Ties the job hunt into the daily plan |
| Job alert digest | Seek/LinkedIn alert emails → one "Review N new jobs" task, not N tasks | Less Inbox noise |
| Telegram bot capture | Message the bot (text or voice; voice is transcribed) → Inbox task | Capture from any device, including Windows |
| Morning/weekly digest out | n8n reads `GET /today` → Telegram/email at 7:45; Sunday week summary | A second pull-back channel besides push |
| Habit auto-ticks | Google Fit/Strava workout → tick "Exercise"; a GitHub commit → tick "Code" | Habits that track themselves |
| Bills and renewals | Receipt or renewal emails → task with a deadline | Nothing important lives only in email |
| Done → log | Task done in project "Job hunt" → append a row to the applications sheet | Two-way with existing trackers |

The design pass (phase C) picks the first 3 to ship. The rest are recipes the owner can add in n8n later without app changes.
