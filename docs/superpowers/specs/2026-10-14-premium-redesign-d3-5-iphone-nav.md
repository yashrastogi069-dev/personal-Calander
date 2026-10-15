# Premium redesign D3.5: iPhone navigation, gestures and motion

Date: 2026-10-14. Author: Fable 5.1 (owner-approved key design moment, DECISIONS 2026-10-13 "iPhone navigation, gestures and glance features"). Status: design only, nothing built.
Builds on [D0](2026-10-13-premium-redesign-d0-design.md), [D1 shell](2026-10-13-premium-redesign-d1-shell.md), [D2.5 Focus and inner surfaces](2026-10-13-premium-redesign-focus-and-inner-surfaces.md) and [D3 Tasks](2026-10-13-premium-redesign-d3-tasks.md) (section 11 reserved phone swipe for this slice).

Design read: a daily-use planner for one owner on an iPhone, used one-handed and mostly in short sessions. Modern, futuristic, calm: a floating glass bar, tinted tiles, springy but never slow-feeling motion, all inside the approved white/blue and slate-dark identity. Dials: variance 4 (the structure is fixed by the owner), motion 7 (state-driven, every movement says something), density 4.

Timing follows the owner's 2026-10-14 direction ("realistic, not too fast"): taps 120 to 220ms, entrances and transitions 380 to 600ms, data motion 1.1 to 1.6s, reduced motion instant. This supersedes the "~240ms" tab slide in DECISIONS 2026-10-13. Emil Kowalski's "under 300ms" rule is kept only for press feedback; the owner's brief wins everywhere else, and frequent motions stay interruptible so slower never means blocked.

Not claimed anywhere in this document: no physical iPhone, Vercel Preview or live-data check has happened. iPhone Safari has no Vibration API, so there are no haptics; "armed" states are visual.

---

## 0. Scope and decisions taken here

Belongs in D3.5 (from the HANDOFF "Demo audit findings"):

| Finding | Decision |
|---|---|
| Today: "Completed today" body looks empty while the header says "4 evidence records" | In D3.5. Section 2.5. Reproduce first, then fix; cause is likely the closed `<details>`, not missing data. |
| Today: "Upcoming milestone" card is mostly empty | In D3.5. Becomes one compact row. |
| Calendar opens in Day view | In D3.5. Day stays the default (it is what the owner plans in), but Week and Month are one pinch or one tap away, and Month taps zoom into Day. See 2.6. |
| Calendar: 30-minute blocks clip "Complete" | In D3.5. Blocks show title and time only; actions move to a docked tray. |
| Calendar: grid is a short scroll box beside a 24-item inbox | In D3.5 (phone). The grid joins page scroll; the inbox becomes an "Unscheduled" sheet plus a placing mode. |
| Calendar: Week view is a legacy panel below the fold | In D3.5 (all widths). Week and Month show the matrix first; the Day workspace renders only in Day mode. |

Decisions I took that the owner can veto (not questions, because the recommended answer is safe):

1. The Home segmented control (Dashboard / Today / Calendar) is hidden on phone when the bar already holds all three. It would duplicate the bar. If the owner customises the bar so one is missing, the control returns.
2. With reduced motion on, the bar does not shrink at all (stable chrome). Without it, it shrinks.
3. The Calendar surface is recoloured from its hard-coded dark green to the premium tokens at every width (colour only on desktop, layout changes on phone). A dark-green island inside a blue app is the single most visible incoherence left.
4. Pinch covers Day, Week, Month only. Quarter and Year stay on the segmented control.
5. No swipe on Board cards or Calendar blocks. Both own horizontal intent (long-press drag, block selection); they keep buttons.
6. iPhone landscape is 844px wide, above the 680px phone breakpoint, so it gets the iPad layout. Not changed here.

---

## 1. Current state, from the code

Shell and bar (`client/src/features/shell/`):

1. **Wrong destinations.** `phase4DefaultPreferences.primary` is `defaultShortcutTargets.slice(0, 4)`: Today, Tasks, Daily plan, Projects. With the centre Capture button `PhoneNavigation` shows `slice(0, 3)`, so the bar reads Today / Tasks / Daily plan, `+`, More. Dashboard and Calendar are buried in More.
2. **The `+` is context-blind.** It always renders `Plus`, always `aria-label="Capture a task"`, and `runGlobalAction("capture")` always calls `openComposer("task")`. `ComposerKind` is `task | goal | project | habit`; there is no event kind.
3. **No live data on the bar.** `PlannerShell` receives `badges` but does not pass them to `PhoneNavigation`.
4. **Active tab is dead.** Tapping the active tab calls `onNavigate` again, which is a no-op. Nothing scrolls to top.
5. **The bar never reacts to scroll.** It is `position: fixed`, 56px capture, always full width, with `planner-main` padded 104px at the bottom. The Focus dock is hard-coded 90px above the bottom (`focus.css`).
6. **More is a text list in the legacy `PlannerSheet`** (20px icon plus label rows under Work / Planning and review / Account). No tiles, no counts, no drag dismiss (the premium `Sheet` has it).
7. **No tab transition.** Content swaps instantly; the only motion is the indicator glide (`GLIDE` is still `0.24` in `design/motion.ts` while `tokens-v2.css` has already been retuned to 380ms) and a 300ms icon pop.
8. **Swipe is wrong and invisible.** `CanonicalTaskRow` (Today, Calendar) resolves a swipe only on pointer-up with `resolveMobileTaskGesture`: swipe LEFT completes, swipe RIGHT reveals an Archive confirm. That is the opposite of the approved design, has no follow-the-finger feedback, no undo, and no `touch-action`, so scroll and swipe race. D3's `TaskRow` renders an empty `.task-row-swipe` underlay with `data-swipe="complete|reschedule"` hooks and nothing else. Calendar swipes days only on `.calendar-date-rail`, never on the grid, with no animation.
9. **Scroll model.** On phone the document scrolls; `planner-main` is a scroll owner only at 681px and wider (`planner-shell.css`). Every scroll-driven feature on phone binds to `window`, not to `<main>`.
10. **No refresh gesture.** Data refreshes by reload or by invalidation after a mutation. `utils.planner.workspace.snapshot.invalidate()` and `utils.planner.dashboard.invalidate()` already exist.

Today (`features/today/TodayWorkspace.tsx`):

11. "Completed today" is a closed `<details>`. Its summary says "N evidence records" while the visible area is empty. The milestone card renders a label, a title, a date and a button for one data row.
12. The projection is built by `projectToday({ localDate, ... })`, so a different date is technically possible, but the workspace is wired to `today` everywhere (habit check-in, plan day, recovery).

Calendar (`features/calendar/CalendarExecutionWorkspace.tsx`, `calendar-execution.css`, Home.tsx lines 8940 to 8990):

13. Two separate `selectedDate` states (one in the workspace, one in Home for the matrix), so a mode change cannot carry the date.
14. The Day workspace always renders above the mode toolbar; Week and Month matrix sit below it. Default mode is `Day`.
15. Grid slots are 30px per 15 minutes. A 30-minute block is 60px and has to hold a title, a time line, a Complete button and a resize/remove row. That is the clipping.
16. On phone the grid is an inner scroll box (`max-height: 530px`), under an inbox of up to 24 stacked tasks (`max-height: 286px`, then `186px` below 460px), under a rollover panel, a "Manual reservation" note and a keyboard-shortcut strip that means nothing on a phone.
17. Hard-coded greens (`#0c1714`, `#71d6b5`) and IBM Plex Mono at 8 to 11px. Below the 12px text floor in D0.
18. The header "Add task" button duplicates the new context `+`.

---

## 2. Information architecture and layouts (390 x 844, iPhone standalone, safe-area bottom 34px)

### 2.1 Bar destinations and highlight rules

Default bar (code default only): **Home** (`home/overview`, the Dashboard) | **Today** (`home/today`) | **+** | **Calendar** (`plan/calendar`) | **More**.

`phase4DefaultPreferences.primary` becomes exactly those three shortcuts. `order` starts with the same three, then Tasks, Daily plan, Projects, Habits, Review, Focus, Settings and the existing secondary list. A saved custom list is never overwritten (one exception, owner question 3).

Highlight rules (opus, tested):

| Location | Highlighted |
|---|---|
| `home/overview` | Home |
| `home/today` | Today |
| `plan/calendar` | Calendar |
| `home/focus`, `home/search` | More (parent fallback is disabled for `home/*`; today it would wrongly light Today) |
| everything else (Tasks, Plan daily/weekly/roadmap, Habits, Projects, Review, Settings) | More |
| a custom list that pins one of those | that tab, exact match first, then parent as today |

Icons (lucide, one family, stroke 1.8 at rest, 2.2 active): Home `House`, Today `Sun`, Calendar `CalendarDays`, More `LayoutGrid`. The rail keeps `LayoutDashboard` for the same Dashboard destination; different form factor, deliberate.

### 2.2 The bar: rest and shrunk

Rest (default). Fixed, `left/right: 12px`, `bottom: calc(8px + env(safe-area-inset-bottom))`, height 64, radius pill, glass. Capture is 56px, raised so its top sits 6px above the bar's top edge (the only element allowed to break the pill).

```
 y=738                                                  390 wide
 +------------------------------------------------------+
 |   (house)    (sun)(5)    .---.     (cal)      (grid)  |   bar: x=12..378, 64px tall
 |    Home       Today     | + |    Calendar     More   |   labels 12px/600
 |                          '---'                       |   capture 56px, gradient
 +------------------------------------------------------+
   home indicator area 34px
```

Four slots of 73px plus the 56px centre. Each slot is a 44px-minimum target at full slot width and bar height.

Shrunk (scrolling down). A compact pill centred at the bottom: 244 x 52, same glass, labels gone, icons 22px, capture 48px. Every item keeps a 44 x 44 target (capture 48).

```
                 +------------------------------+
                 |  (house) (sun)  (+)  (cal) (grid) |    244 x 52, centred, x=73..317
                 +------------------------------+
```

Rules (hook `useScrollShrink`, state flips only at thresholds, never per frame):

| Event | Result |
|---|---|
| scrollY above 96px and downward travel of 48px since the last direction change | shrink |
| upward travel of 12px | expand |
| scrollY under 8px, or within 4px of the document bottom | expand |
| focus enters the bar (keyboard, VoiceOver cursor) | expand, stay expanded while focus is inside |
| any sheet, the More launcher, the quick menu or the on-screen keyboard is open | no change; keyboard open hides the bar (visualViewport height under 75% of the window) |
| reduced motion | never shrinks |
| tap on a shrunk item | performs that item's normal action (no extra "expand" tap) |

The hook publishes `--pn-bar-clear` on `<html>`: rest `76px`, shrunk `64px` (both plus the safe inset). The Focus dock, toasts and the calendar block tray position themselves from it. Content padding stays at `104px + safe` in both states so the page never jumps.

Glass material (an honest web approximation of the idea, not Apple's Liquid Glass): `background: color-mix(in srgb, var(--pc-card) 78%, transparent)`, `backdrop-filter: blur(20px) saturate(160%)`, 1px border `color-mix(in srgb, var(--pc-card) 40%, var(--border))`, inset top highlight, shadow `--pc-e3`. `@media (prefers-reduced-transparency: reduce)` and `@supports not (backdrop-filter: blur(1px))` switch to `var(--pc-card)` solid. Dark mode: the slate card at 78% with a 1px white-at-10% edge. Labels use `--ink-muted` and must reach 4.5:1 over the worst blend (card at 78% over pure black and pure white content); the test in section 8 checks this.

Active state: icon switches outline to filled (accent stroke plus `fill: color-mix(in srgb, var(--accent) 18%, transparent)`), label turns `--accent` weight 700, and the existing shared indicator pill (`layoutId="pc-phone-active"`) glides behind it.

### 2.3 Context-aware `+`

```
 location                         glyph          accessible name       action
 plan/calendar                    CalendarPlus   "New time block"      task composer, date = calendar selectedDate, reserve step open
 habits/*                         Repeat2        "New habit"           openComposer("habit")
 everything else                  Plus           "New task"            openComposer("task")
```

("New time block" because no event entity exists, owner question 1.)

When the context changes (never on first mount) the glyph morphs: the old glyph rotates -45 degrees and shrinks to 0.6 while fading (160ms), the new one rotates in from +45 degrees (380ms, light spring). A caption chip with the new name appears above the button, holds 1.4s, then leaves, so the change is explained without a tooltip. The button's accessible name changes at once.

Long-press on `+` (450ms) opens the full create menu (2.4). A plain tap always does the context action.

### 2.4 Long-press quick menus

A glass menu anchored above the pressed item, transform-origin at the item, items 48px high, max 5.

```
              +---------------------------+
              |  (check)  New task        |
              |  (repeat) New habit       |
              |  (flag)   New project     |
              |  (target) New goal        |
              |  (timer)  Start focus     |
              +---------------------------+
                        ( + )
```

| Pressed | Items |
|---|---|
| `+` | New task, New habit, New project, New goal, Start focus |
| Home | Search, Start focus |
| Today | Add task for today, Plan the day, Start focus on next task |
| Calendar | Jump to today, Day view, Week view, Month view |
| More | none (tap opens the launcher; long-press does nothing) |

Every item already has a visible home elsewhere (composer entry points, the palette Search, the Plan destination, the Focus pill and screen, the Calendar mode control), so the menu is a shortcut, never the only path.

### 2.5 More as a launcher

The premium `Sheet` (bottom sheet on phone: grabber, labelled Close, drag-down dismiss with 0.11 px/ms momentum) replaces the legacy `PlannerSheet` for this content. Three columns, tiles about 112 x 96, grouped by the existing `groupPhoneMoreTargets` sections.

```
 +----------------------------------------+
 |                 ______                 |   grabber
 |  More                         [ Close ]|
 |                                        |
 |  Work                                  |
 |  +----------+ +----------+ +----------+|
 |  | (blue)   | | (blue)   | | (teal)   ||
 |  |  Tasks   | |  Inbox 12| |  Habits 3||
 |  +----------+ +----------+ +----------+|
 |  +----------+ +----------+ +----------+|
 |  |  Focus   | | Projects | |  Goals   ||
 |  +----------+ +----------+ +----------+|
 |  Plan and review                       |
 |  [Daily plan] [Weekly] [Roadmap]       |
 |  [Review]     [Analytics]              |
 |  Account                               |
 |  [Settings] [Connections] [Categories] |
 |  ------------------------------------  |
 |  [ Refresh data ]   Updated 2 min ago  |
 +----------------------------------------+
```

Tile anatomy: a 48px tinted rounded square (radius `--pc-r-control`, tone background `--pc-k-soft`, glyph `--pc-k-ink`), the label below (13px/550, one line, ellipsis), a badge top-right of the square. The active destination gets a 2px accent ring. Tone mapping (decorative; reuses the category tone tokens):

| Tile | Tone | Tile | Tone |
|---|---|---|---|
| Tasks, Inbox | work (blue) | Review | learning (amber) |
| Habits | health (teal) | Analytics | neutral |
| Daily plan, Weekly plan, Roadmap | personal (violet) | Focus | accent (blue, `pc-tone-accent`) |
| Projects, Goals | learning (amber) | Settings group | neutral |

Badges come from `navBadgeCounts`: Inbox count, Tasks "overdue" count (alert tone), Habits "due" count. Zero shows nothing. The footer button runs the same refresh as pull to refresh and is the visible alternative to that gesture (disabled with its reason when offline).

### 2.6 Today and Calendar as they relate to gestures

**Today (phone).** The Home tabs are hidden (the bar has them). Order, top to bottom:

```
 Today                         [Focus pill]
 Tue 14 Oct
 +---------------------------------------+
 |  <   Yesterday | TODAY | Tomorrow   >  |   day strip (swipe here, chevrons are the buttons)
 +---------------------------------------+
 3 commitments, 4h 20m known     [Plan day]
 +---------------------------------------+
 | Tasks                                 |
 | (o) Write quarterly note        09:30 |   rows swipe: right = done, left = reschedule
 | (o) Reply to Sam                      |
 +---------------------------------------+
 | Habits  (o) (o) (o)                   |
 | Timeline ...                          |
 | Milestone  Launch v2 . 20 Oct  >      |   one compact row (was a card)
 | Completed today  4 done               |   open by default when 1 to 5
 |   Review notes          9:12 am       |
 |   Morning run           7:05 am       |
 |   +2 more                             |
 | Remaining decisions ...               |
 +---------------------------------------+
```

Day peek rules (owner question 2): the strip swipes between Yesterday, Today, Tomorrow only. The day strip is the swipe target because rows own horizontal swipe; the page background and rows never change the day. On a day other than today a chip "Viewing Tomorrow. Back to Today" sits under the strip, and `projectToday` receives that `localDate`. Habit check-in, Plan day and recovery are disabled with the visible reason "Only available for today". Task rows stay fully interactive (completing a task that is planned for tomorrow is valid).

Completed today fix: reproduce on the demo fixtures at 390 before changing anything. Whatever the cause, the contract is: the header count equals the number of rows in the body; the body is open by default on phone when there are 1 to 5 records; a closed body shows the first two titles in the summary line; an empty list reads "Nothing finished yet. Check one off and it lands here."

**Calendar (phone).**

```
 Calendar
 [ Day | Week | Month | Quarter | Year ]      segmented, 5 equal parts
 < Tue 14 Oct >                    [Today]
 M  T  W  T  F  S  S                      date rail, 7 days, selected = filled
 [ Unscheduled 24  > ]                    opens a sheet
 08:00 |-----------------------------
       |
 09:00 | .---------------------------.
       | | Write quarterly note      |    block: title + time only
       | | 09:00 - 09:45             |
       | '---------------------------'
 10:00 |
       ...                                grid is part of the page scroll (no inner box)
 +---------------------------------------+
 | Write quarterly note      [Complete]  |   block tray, docked above the bar, only when a block is selected
 |  -15   +15   Remove time              |
 +---------------------------------------+
```

Placing mode (replaces the stacked inbox): tap "Unscheduled 24", the sheet lists the tasks with estimates, pick one, the sheet closes and a banner reads "Tap a slot to place 'Write quarterly note' (45 min)" with a Cancel button; free slots light up; tapping one runs the existing preview, then the existing "Apply reservation" panel and Undo, unchanged logic.

Week and Month: the matrix is the first thing under the controls (Day workspace not rendered). Tapping a day in Week or Month sets the date and zooms to Day with the same 420ms transition used by pinch. The rollover panel becomes a one-line banner with the Apply button; the keyboard strip and the "Manual reservation" note are hidden on phone.

---

## 3. Gestures

Common rules for every gesture:

- Touch and pen only (`pointerType !== "mouse"`). Mouse keeps buttons and menus.
- Edge guard: ignore a gesture that starts within 20px of the left or right screen edge (Safari's back swipe, the app switcher).
- Axis lock: decided once, after 10px of movement. Horizontal wins only when `|dx| >= |dy| * 1.35` (the ratio already used by `resolveMobileTaskGesture` and `resolveMobileCalendarGesture`). Once vertical, the gesture is abandoned for that touch and the browser scrolls.
- `touch-action: pan-y` on swipe surfaces, `pan-x pan-y` on the calendar grid (blocks native pinch zoom only there), so the browser keeps vertical scroll.
- Only one gesture owner at a time. Priority: sheet/menu drag > row swipe (when started on a swipe-enabled row) > day swipe > pull to refresh.
- Taps after a drag are swallowed (`filterTaps`), so a swipe never also activates a button.
- No haptics exist, so every threshold has a visible "armed" state (underlay saturates, glyph scales to 1.15, label changes to "Release to ...") and reversing under the threshold disarms it.

| # | Gesture | Target | Threshold / velocity | Action / mutation | Refusal / undo | Visible alternative |
|---|---|---|---|---|---|---|
| G1 | Swipe row right | `TaskRow` (Tasks List), `CanonicalTaskRow` (Today). Not Board cards, not Calendar blocks. | Commit at `dx >= max(88px, 28% of row width)`, or `velocity >= 0.55 px/ms` with `dx >= 40px`. Resistance beyond 140px (log damping, same family as `dampUpward`). | Complete: `onToggle(model)`. Recurring rows resolve today's occurrence (`planner.occurrence.resolve`), never a task update. Offline: queued, toast "Saved on this device". | Refused when `completionBlock` has a reason, state is archived, or the row is pending: row nudges 12px and returns (380ms), underlay shows a lock glyph, toast shows the reason text. Undo: 6s toast "Marked done. Undo" reopens with the fresh `expectedVersion`; a version conflict shows "Changed elsewhere, nothing undone". | The check button on the row. |
| G2 | Swipe row left, partial | same rows | `dx` between -56px and the full-swipe threshold, released | Row rests at -168px revealing two real buttons (84px wide, full row height): **Tomorrow** and **Pick date**. | Tapping elsewhere, scrolling, Escape, or running an action closes it. Only one row open at a time. | More menu items "Move to tomorrow" and "Pick a date" (added to the `actions` list). |
| G3 | Swipe row left, full | same rows | `dx <= -(60% of row width)` or `velocity >= 0.7 px/ms` leftwards | Reschedule to tomorrow: the same patch as the More menu / board drop, built by `planTaskDrop` with a date target. "Pick date" opens the D3 date popover (as a sheet on phone; falls back to the detail sheet until D3b lands). | Recurring rows refuse with "Repeats. Change this occurrence in details" and open nothing. Prerequisite, committed and reserved rules come from `planTaskDrop`; a refusal reads exactly like the board's. Undo: 6s toast restores the previous `scheduledLocalDate` with the fresh version. | More menu, row details. |
| G4 | Swipe between days | Calendar day grid wrap and date rail (Day mode) | `dx >= 72px` with ratio 1.35, or `velocity >= 0.45 px/ms` with `dx >= 40px`. Content follows the finger at 0.4x up to 40px. | Left = next day, right = previous day. Updates the single lifted `selectedDate`. | No refusal; any date is valid. | The chevron buttons, the date rail, the Today button. |
| G5 | Swipe between days | Today day strip only | same numbers as G4 | Yesterday / Today / Tomorrow, clamped at plus or minus 1 day. | Clamped ends bounce 8px. Peek day disables today-only actions with a visible reason. | The strip's chevron buttons and the "Back to Today" chip. |
| G6 | Long-press | Bar tabs Home, Today, Calendar, and `+` | Hold 450ms, finger movement under 8px, otherwise it is a scroll or a tap. | Opens the quick menu (2.4). Release over an item activates it; lifting elsewhere keeps the menu open for a tap. | Cancelled by movement or a second finger. | Keyboard: ContextMenu key or Shift+F10 on a focused item, ArrowUp also opens; every action exists elsewhere (2.4). |
| G7 | Pinch | Calendar grid wrap or matrix | Live scale tracks the fingers (clamped 0.85 to 1.15). Commit when the cumulative ratio crosses 0.80 (zoom out) or 1.25 (zoom in). One step per gesture. | Day -> Week -> Month and back. Week keeps the week of `selectedDate`; focal day cell (`data-date`) becomes the date when pinching in. | Below threshold the content springs back (220ms), nothing changes. Quarter and Year ignore pinch out; pinching in from them goes to Month. | The segmented control (5 modes), tapping a day in Week/Month. |
| G8 | Tap the active tab | Bar tab for the current location | A tap on a tab that is already highlighted and `scrollY > 8` | Smooth scroll to top (instant under reduced motion); bar expands. At the top already: nothing. Tapping the active More tab closes the launcher. | none | The tab is the visible control; scrolling up with a finger is the manual path. |
| G9 | Pull to refresh | Window scroll on Dashboard, Today, Calendar, Tasks List, Habits | Only when `scrollY <= 0` at touch start and the first movement is downward. Raw pull of 140px (84px displayed after 0.6 resistance) arms it. | Release when armed: `utils.planner.workspace.snapshot.invalidate()` plus `utils.planner.dashboard.invalidate()`, awaited. | Offline or cached snapshot: refuses, ring turns to the off tone and reads "Offline. Showing saved data." for 2.4s, no network call. Failure keeps the old data and says so. | "Refresh data" in the More launcher; reload. |
| G10 | Drag down | More launcher, Unscheduled sheet, any premium `Sheet` | Existing: flick at or above 0.11 px/ms, or a quarter of the sheet height | Dismiss | none | The labelled Close button. |

Disabled/neutral by design: horizontal swipes on Board cards and Calendar blocks; any swipe while a sheet, menu or the keyboard is open; any gesture on an element with `data-no-gesture`.

---

## 4. Motion

Tokens: reuse `--pc-ease`, `--pc-dur-press 120`, `--pc-dur-fast 160`, `--pc-dur-base 220`, `--pc-dur-pop 380`, `--pc-dur-glide 380`, `--pc-dur-enter 480`, `--pc-dur-sheet 500`, `--pc-dur-data 1300`, `--pc-stagger-tight 40`, and the existing keyframes `pc-spring-pop`, `pc-icon-pop`, `pc-check-draw`. New values live only in `phone-nav.css` as `--pn-*` (no edit to `tokens-v2.css`, which other agents are changing): `--pn-dur-shrink: 420ms`, `--pn-dur-slide: 380ms`, `--pn-slide-x: 28px`, `--pn-dur-hold: 450ms`, `--pn-dur-badge: 480ms`, `--pn-dur-ring-min: 700ms`. JS durations come from `MOTION` in `design/motion.ts` once the retune lands there, and from local constants that mirror these until then. Only transform, opacity, filter and (for the bar) a framer `layout` transition are animated.

| Element | Trigger | Duration and easing | Reduced motion |
|---|---|---|---|
| Tab / `+` press | pointer down | scale 0.96 (capture 0.94), 120ms in, 160ms out, `--pc-ease` | no scale |
| Active indicator pill | active tab changes | 380ms glide (`GLIDE`), shared layout | instant |
| Icon outline to filled | becomes active | fill cross-fade 220ms plus `pc-spring-pop` 380ms | fill swaps, no pop |
| Today badge | count increases | `pn-badge-bounce` 480ms (scale 0.6, 1.18, 1) | no bounce |
| Today badge | count decreases or first mount | 160ms cross-fade of the number, no bounce | instant |
| Bar shrink / expand | scroll thresholds (2.2) | 420ms `--pc-ease`, framer `layout` on the bar, children `layout="position"`, labels fade 160ms out / 220ms in | bar never shrinks |
| `+` glyph morph | context changes | out 160ms (rotate -45, scale 0.6, fade), in 380ms light spring (stiffness 380, damping 22) | cross-fade 0ms |
| `+` caption chip | context changes | 380ms in, 1400ms hold, 200ms out | static for 1.4s, no motion |
| Tab slide (route change) | any location change on phone | enter-only WAAPI on the content wrapper: `translateX(dir * 28px)` plus opacity 0 to 1, 380ms `--pc-ease`, cancelable (interruptible). No exit animation, no remount, so Home state is kept. | none |
| Slide direction | location change | forward (+1) when the bar index increases (Home 0, Today 1, Calendar 2) or when entering a More destination from a bar tab; back (-1) otherwise | n/a |
| Long-press hold feedback | pointer held | icon scales 1 to 1.12 over 450ms (ease-in, so it reads as deliberate) | no scale; a ring outline appears at 450ms |
| Quick menu | hold completes | scrim 220ms, menu scale 0.92 to 1 plus opacity from the item (transform-origin bottom centre) 380ms, items rise 8px with 40ms stagger (cap 5) | opacity only, 0ms |
| Quick menu exit | select / outside tap / Esc | 200ms | 0ms |
| More sheet | More tapped | 500ms iOS sheet curve (existing `Sheet`) | instant |
| More tiles | sheet opens | `pc-rise` 480ms, `--pc-i` stagger 40ms (cap 8, so 320ms spread) | none |
| Row follows finger | drag | 1:1, no easing | stays (direct manipulation) |
| Row armed | crosses threshold | underlay saturation and glyph scale 1.15, 160ms | colour change only |
| Row settle / snap back | release | spring stiffness 380, damping 34 (about 320ms) | instant |
| Row complete | commit | check draw 280ms, then height collapse 380ms if the list hides done rows | instant |
| Row refusal | refused commit | nudge 12px and back, 380ms spring; reason text appears | no nudge, reason text only |
| Revealed reschedule buttons | partial left swipe | follow the row; labels fade in at 40% reveal, 160ms | instant |
| Day change (G4/G5) | commit | content `translateX(dir * 28px)` + opacity, 380ms; date chip glide 380ms | none |
| Pinch live | two fingers | transform scale tracks fingers, no easing | none |
| Pinch commit | threshold | cross-fade 420ms with a 6px blur bridge (`pc-blur-in`) | instant swap |
| Pinch cancel | release under threshold | spring back 220ms | instant |
| Pull ring fill | pulling | stroke-dashoffset follows the finger, no easing | static pill "Pull to refresh" text |
| Pull armed | crosses 84px | arrow rotates 180 degrees 160ms, ring pulses once 220ms | text changes to "Release to refresh" |
| Pull refreshing | release | ring spins 1000ms linear loop, shown for at least 700ms | static "Refreshing" pill, no spin |
| Pull done | promise resolves | check draw 280ms, hold 600ms, collapse 380ms | pill text "Updated", then gone |
| Pull refused | offline / error | ring turns off-tone, message 2400ms, collapse 380ms | message only |
| Block tray | block selected | rises with the sheet curve 380ms in, 200ms out | instant |
| Unscheduled sheet | chip tapped | 500ms sheet | instant |
| Scroll to top | G8 | native smooth scroll | `behavior: "auto"` |
| Today numbers and bars | page enter | existing `pc-grow-x` / count-up, 1300ms (data tier) | existing handling |

Interruptibility: the route slide, day slide, pinch commit and bar shrink are cancelable mid-flight (WAAPI `cancel()` or framer retargeting). A second tab tap during the 380ms slide starts the next slide from the current position.

---

## 5. Components, contracts and file ownership

Rule: no file is edited by two builders. Fable owns every visual file; opus owns every hook, pure model, preference change and every wiring file. Fable components take props and callbacks only (no raw snapshot data, no tRPC). Opus writes the unit tests for its files; Fable writes component tests for its files.

### 5.1 Contracts (agree first, both sides can then start)

```ts
// features/gestures/useScrollShrink.ts (opus)
type BarState = "rest" | "shrunk";
useScrollShrink(o?: { enabled?: boolean }): { state: BarState; expand(): void };
// uses framer useScroll + useMotionValueEvent; sets --pn-bar-clear on documentElement.

// features/gestures/useLongPress.ts (opus)
useLongPress(o: { onLongPress(origin: { x: number; y: number }): void; delayMs?: 450; tolerancePx?: 8 }):
  { onPointerDown; onPointerMove; onPointerUp; onPointerCancel; onContextMenu };

// features/gestures/useSwipeRow.ts (opus)
useSwipeRow(o: {
  enabled: boolean;
  canCommit(side: "complete" | "reschedule"): string | null;   // refusal reason or null
  onCommit(side: "complete" | "reschedule", how: "full" | "button"): void;
}): {
  bind: () => Record<string, unknown>;      // use-gesture drag handlers + touch-action style
  x: MotionValue<number>;                   // row translateX
  progress: { complete: MotionValue<number>; reschedule: MotionValue<number> }; // 0..1 of threshold
  phase: "idle" | "drag" | "armed" | "revealed" | "refused";
  close(): void;
};

// features/gestures/usePullToRefresh.ts (opus)
usePullToRefresh(o: { enabled: boolean; canRefresh(): string | null; onRefresh(): Promise<void> }):
  { progress: MotionValue<number>; phase: "idle" | "pulling" | "armed" | "refreshing" | "done" | "refused"; message: string | null };
// native non-passive touch listeners (preventDefault only while pulling at scrollY <= 0), not use-gesture.

// features/gestures/useDaySwipe.ts, usePinchZoom.ts (opus)
useDaySwipe(o: { enabled: boolean; min?: -1 | number; max?: 1 | number; onShift(dir: -1 | 1): void }): { bind; offset: MotionValue<number> };
usePinchZoom(o: { mode: CalendarMode; onStep(next: CalendarMode, focalDate?: string): void }): { bind; scale: MotionValue<number> };

// features/shell/phoneNavModel.ts (opus, pure, tested)
phoneContextCreate(loc): { kind: "task" | "habit" | "timeblock"; label: string; icon: "plus" | "calendar-plus" | "repeat" };
phoneQuickActions(target | "capture"): QuickAction[];
tabDirection(prevKey: string, nextKey: string, barOrder: string[]): -1 | 1;
phoneBadgeModel(counts: NavBadgeCounts): { today?: { n: number; label: string }; moreDot: boolean };
primaryCoversHomeTabs(prefs): boolean;
stepCalendarMode(mode, dir: -1 | 1): CalendarMode;     // Day<->Week<->Month only
```

Visual props the Fable side exposes: `PhoneNavigation` (`location`, `preferences`, `barState`, `badges`, `createContext`, `moreOpen`, callbacks), `SwipeUnderlay` (`phase`, `progress`, `side` content, `onButton`), `PullRefreshRing` (`progress`, `phase`, `message`), `QuickMenu` (`items`, `origin`, `onSelect`, `onClose`), `MoreLauncher` (`groups`, `badges`, `active`, `onNavigate`, `onRefresh`, `refreshDisabledReason`).

### 5.2 Fable (visual files)

| File | Notes |
|---|---|
| `client/src/features/shell/PhoneNavigation.tsx` | Bar markup, glass, filled icons, context `+`, badges, wires the hooks it is handed. Keep the root classes `mobile-planner-nav pc-phone-nav` and the exports the current tests import (`plannerShortcutKey`, `movePlannerShortcut`, `togglePlannerPrimaryShortcut`, `activePhonePrimaryShortcutKey`, `groupPhoneMoreTargets`). |
| `client/src/features/shell/phone-nav.css` (new) | All bar, quick menu, launcher, caption and ring CSS with `--pn-*`. Fable removes the `.pc-phone-*` block (lines 170 to 260) from `premium-shell.css`; no one else edits that file in this slice. |
| `client/src/features/shell/MoreLauncher.tsx` (new) | Tile grid inside the premium `Sheet`. |
| `client/src/features/shell/PhoneQuickMenu.tsx` (new) | Menu visuals, roving focus, `role="menu"`. |
| `client/src/features/gestures/SwipeUnderlay.tsx`, `PullRefreshRing.tsx`, `gestures.css` (new) | Underlay (complete green-teal `--pc-ok-soft`, reschedule `--pc-selection` blue), ring, refused states. |
| `client/src/features/today/TodayDayStrip.tsx`, `TodayCompleted.tsx`, `TodayMilestoneRow.tsx`, `today-phone.css` (new) | Replace the inline "Completed today" block and the milestone card. |
| `client/src/features/calendar/CalendarModeBar.tsx`, `CalendarSlotGrid.tsx`, `UnscheduledSheet.tsx`, `BlockActionTray.tsx`, `PlacingBanner.tsx`, `calendar-premium.css` (new) | Presentational. `calendar-premium.css` is imported last and overrides the green; it does not edit `calendar-execution.css` (which lowers the legacy-green baseline when its rules are deleted in D6). |
| `client/src/features/shell/__tests__` or sibling `*.test.tsx` for the above | Component tests (section 8). |
| Premium gallery entries (`pages/PremiumGallery*.tsx`) | One entry per new visual in light and dark. Only Fable touches the gallery files in this slice. |

### 5.3 Opus (logic and wiring)

| File | Notes |
|---|---|
| `shared/phase4Preferences.ts` (+ test) | New default `primary` (3 items) and `order`; one-time migration for an exact old default (owner question 3); a different saved list is untouched. |
| `client/src/features/shell/phoneNavModel.ts` (new, + tests) | Pure functions from 5.1, the highlight rules in 2.1, the `home/*` parent-fallback change in `activePhonePrimaryShortcutKey` (that function lives in `PhoneNavigation.tsx`, so opus moves it to the model and Fable re-imports it; do this in wave 0 before Fable starts the file). |
| `client/src/features/gestures/swipeMath.ts`, `useSwipeRow.ts`, `useLongPress.ts`, `usePullToRefresh.ts`, `useScrollShrink.ts`, `useDaySwipe.ts`, `usePinchZoom.ts`, `useRouteSlide.ts` (new, + tests) | `swipeMath.ts` holds the pure classify/commit/damping functions with the numbers from section 3. Replaces `shared/mobileTaskGesture.ts` and `mobileCalendarGesture.ts` callers; leave the shared files in place until their server tests are retired. |
| `client/src/features/tasks/rowSwipeActions.ts` (new, + test) | Builds `canCommit` and `onCommit` from a `TaskCardModel`: complete via `onToggle`, reschedule via `planTaskDrop` with a date target, undo closures. |
| `client/src/features/shell/PlannerShell.tsx` | Pass `badges`, `createContext`, `onCreate`, `onRefresh` to the phone nav; mount `useRouteSlide` on the content wrapper; `data-phone-home-tabs="in-bar"`; `PullRefreshRing` mount. |
| `client/src/pages/Home.tsx` (mount only) | `runGlobalAction("capture")` becomes context-aware; lift `selectedDate`; render the Day workspace only in Day mode; a `viewDate` for Today. No new logic blocks in Home beyond passing props. |
| `client/src/features/tasks/TaskRow.tsx`, `CanonicalTaskRow.tsx` | Integration step after D3b lands (D3 agents still edit task files): mount `useSwipeRow` plus `SwipeUnderlay`; delete the legacy pointer handler and the Archive reveal in `CanonicalTaskRow`; add "Move to tomorrow" / "Pick a date" to the actions list. |
| `client/src/features/today/TodayWorkspace.tsx` | Swap in the three Today components, day peek wiring, disabled-with-reason for today-only actions. |
| `client/src/features/calendar/CalendarExecutionWorkspace.tsx` | Container: controlled `selectedDate`, placing mode state, block selection state, mounts Fable's components, keeps every reserve/preview/undo/complete path unchanged. |
| `client/src/features/focus/focus.css` (one line) | `.pc-focus-dock { bottom: calc(var(--pn-bar-clear, 76px) + 14px + env(safe-area-inset-bottom)) }` and the `Toaster` offset, done by the primary agent at integration to avoid a third editor. |

### 5.4 Build order (a checkpoint after each: HANDOFF, RUN_STATE, push)

- **Wave 0 (opus, one pass):** `phoneNavModel`, `swipeMath`, preferences change and migration, hook skeletons with the contracts. Move `activePhonePrimaryShortcutKey` out of `PhoneNavigation.tsx`.
- **D3.5a Bar, context `+`, More launcher, route slide, scroll shrink** (Fable shell files; opus wiring).
- **D3.5b Gestures:** rows, long-press, pull to refresh, tap-active-tab (needs D3b merged for `TaskRow`).
- **D3.5c Today:** day strip, completed, milestone, day peek.
- **D3.5d Calendar:** mode bar, unscheduled sheet and placing mode, block tray, pinch, day swipe, Week/Month first, recolour.
- **Last:** `scripts/preview-premium-phone.py` and an opus review of the diff.

---

## 6. States

| State | Behaviour |
|---|---|
| Offline | Bar, tab slide and More work. Swipe complete/reschedule are queued by the existing offline queue and the toast says "Saved on this device" (same copy as D3). Pull to refresh and the More "Refresh data" are refused with the reason text and the off tone, no network call. Calendar reservations keep their current error messaging. Today-only disabled actions keep their visible reasons. |
| Cached snapshot (`availableSnapshot.isCached`) | Treated as offline for refresh and for Focus actions. |
| Refusal | Always visible text (toast or inline) plus the row/pinch/ring returning to rest. Never a silent snap-back. |
| Conflict (version changed) | Row returns, a "Changed elsewhere" pill appears (D3 pattern); undo declines politely. |
| Scroll positions | Tab switch resets to top, except that the last scroll offset of Home, Today and Calendar is remembered in memory (not persisted) and restored after the first paint if the document is tall enough; otherwise top. Tap on the active tab goes to top. The bar expands at top and at bottom. |
| Keyboard open | Bar hidden; Focus dock and toasts fall back to the bottom edge. |
| Sheet or menu open | Gestures other than the sheet's own are off; the bar sits under the scrim (z-overlay 60 over nav 40). |
| More open | Indicator sits on More, as today. |
| Loading / empty | Existing skeletons. Unscheduled sheet empty: "Every active task already has a time block" with Open Tasks. Today completed empty: copy in 2.6. |
| Reduced motion | See each row in section 4. Direct manipulation (finger-following) stays; everything animated by time is instant. |
| Landscape iPhone | Above 680px, so the rail layout applies. Unchanged. |

---

## 7. Accessibility

- **Landmarks.** The bar is one `<nav aria-label="Primary">` (renamed from "Phone planning destinations"). Items are `<button>`s, `aria-current="page"` on the exact destination. The Today name includes the count: "Today, 5 left".
- **Targets.** Every control is 44px or larger in both bar states (hit area extends past the visual in the shrunk pill). Revealed swipe buttons are 84px by the row height (at least 56px). Quick menu items 48px. Launcher tiles 112 by 96.
- **Focus.** Visible 2px ring (`--focus-ring`) on every control. Focus entering the bar expands it. Quick menu moves focus to the first item and returns it to the trigger on close; `Escape` closes. The More sheet and Unscheduled sheet use the premium `Sheet` (Radix focus trap and return).
- **VoiceOver.** Long-press has an equivalent: VoiceOver double-tap-and-hold passes through, and all actions exist as visible buttons elsewhere (2.4). Swipe rows: the check button and the More menu are the accessible path; the underlay is `aria-hidden` and `inert` while closed. When revealed, its two buttons become focusable and announced ("Move to tomorrow", "Pick a date"), and closing restores `inert`. Pull to refresh: the ring carries `role="status"` with polite text ("Refreshing", "Updated", "Offline, showing saved data"). The `+` accessible name tracks the context; the caption chip is `aria-hidden` (the name already changed).
- **Reduced motion and transparency.** `prefers-reduced-motion` per section 4. `prefers-reduced-transparency` and no-`backdrop-filter` browsers get the solid card. Dark mode keeps the same contrast gates.
- **Contrast.** Bar labels (12px) 4.5:1 over the worst blend in light and dark; badges, tile glyph on `--pc-k-soft`, underlay text 4.5:1; the armed underlay does not rely on colour alone (glyph and text change).
- **Text size.** Bar labels clamp to 12 to 14px. If the user's text size pushes a label wider than its slot, the label wraps never; it falls back to icon-only (the shrunk label treatment) with the accessible name intact.
- **Zoom.** Pinch is intercepted only when two fingers land inside the Calendar grid/matrix. Page zoom and iOS accessibility zoom elsewhere are untouched. The segmented control gives the same result without a gesture.
- **Colour independence.** Done = teal plus a check glyph and the word "Done"; reschedule = blue plus a calendar glyph and "Tomorrow".

---

## 8. Test plan

**Unit (vitest, opus)**

- `swipeMath`: axis lock table (dx/dy pairs around the 1.35 ratio), commit by distance, by velocity, edge-guard rejection, damping monotonic, partial-left rest position.
- `phoneNavModel`: highlight rules table (every row in 2.1, including `home/focus` and `home/search` lighting More), `phoneContextCreate` for calendar/habits/other, `tabDirection`, `stepCalendarMode` (Month cannot go beyond Month, Quarter pinch-in goes to Month), `phoneBadgeModel`.
- `useScrollShrink` reducer: hysteresis (no flicker at the threshold), expand at top and bottom, never shrinks with reduced motion or an open sheet.
- `phase4Preferences`: default is exactly Home/Today/Calendar; a saved custom list is unchanged; the exact old default list migrates once and writes the backup key the existing code already uses; malformed storage falls back to the new default.
- `rowSwipeActions`: guarded completion refuses with the model's reason; recurring completes through occurrence resolve; recurring reschedule refuses; reschedule patch equals the More-menu "Move to tomorrow" patch.
- Contrast helper: bar label colour over glass at 78% on black and on white, both themes.

**Component (Testing Library, jsdom; Fable plus opus)**

- `PhoneNavigation` with default preferences renders Home, Today, `+`, Calendar, More in that order; `aria-current` on the right item; Today name includes the count; context change swaps the accessible name; `barState="shrunk"` hides labels visually but keeps names; existing test imports still pass.
- `MoreLauncher`: tiles grouped, badges only when above zero, active ring, Refresh disabled with reason when offline.
- `PhoneQuickMenu`: opens with ContextMenu key, roving focus, Escape returns focus.
- `SwipeUnderlay`: `inert` and `aria-hidden` while closed; buttons focusable when `phase="revealed"`.
- `TodayCompleted`: header count equals row count; empty copy; open by default for 1 to 5.
- `TodayDayStrip`: clamps at plus or minus 1; chip appears off today; today-only actions disabled with reason.
- Calendar: `UnscheduledSheet` selection starts placing mode; `BlockActionTray` buttons call the existing handlers; mode change keeps `selectedDate`; Day workspace not rendered in Week/Month.
- Existing suites that must stay green: `PhoneNavigation.test.ts`, `PhoneNavigation.current.test.tsx`, `PlannerShell.test.tsx`, `premiumNavigation.test.ts`, `Sheet.test.tsx`, D3 task tests.

**Browser harness** (`scripts/preview-premium-phone.py`, new, same pattern as `preview-premium-tasks.py`: demo fixtures, all APIs intercepted, Chromium)

Context: viewport 390 x 844, `device_scale_factor=3`, `has_touch=True`, `is_mobile=True`; touch through a CDP session with `Input.dispatchTouchEvent` (helpers `swipe(x1, y1, x2, y2, ms, steps)`, `hold(x, y, ms)`, `pinch(cx, cy, from, to)` using two touch points; `Input.synthesizePinchGesture` as a fallback).

- Bar: five items in order; Home opens the Dashboard; scroll 400px down shrinks it to 244 x 52; scroll up 20px expands; at top expands; `--pn-bar-clear` changes; tabs remain 44px or larger in both states.
- Context `+`: on Calendar it opens the task composer with the calendar date and the reserve step; on Habits the habit composer; elsewhere the task composer.
- Long-press 450ms on `+` opens the 5-item menu; a 7px drag does not; a 300ms hold does nothing.
- Tab slide: after tapping Calendar the content wrapper has a running animation of 380ms with a positive start translate; mid-flight second tap does not throw.
- Tap active tab with `scrollY=600` scrolls to 0.
- Row swipe: right 120px records exactly one `planner.task.update` (or `planner.occurrence.resolve` for the recurring row, and no task update); a guarded row records no mutation and shows the reason; left 100px reveals two buttons; "Tomorrow" records the date patch; left 240px records the same patch; Undo restores; a vertical 80px drag scrolls and records nothing; a swipe starting at x=8 is ignored.
- Day swipe on the Calendar grid changes the date by one and the chevron does the same; Today strip swipe is clamped at plus or minus 1 and disables the habit check-in with the visible reason.
- Pinch in on Day goes to Week, again to Month; pinch out returns; a small pinch springs back with no change.
- Pull to refresh: 160px pull from the top records the snapshot and dashboard queries once and shows the done state; with the context set offline (`context.set_offline(True)`) it records no request and shows "Offline".
- Calendar phone: no inner scroll box on the grid, no horizontal page overflow, Unscheduled sheet lists tasks, placing mode places and the preview panel appears, block actions in the tray, Week mode shows the matrix before the fold.
- Today: "Completed today" body row count equals the header count.
- Runs: light and dark, reduced motion (bar does not shrink, no running animations on route change), no horizontal overflow, no console errors, axe-core 0 serious or critical on Home, Today, Calendar, the launcher and the quick menu, no green computed colours left on Calendar.
- A WebKit smoke at 390 for layout, overflow and tap-only paths (Playwright's WebKit has no CDP touch).

**Gates:** `npm run check`, `npm test`, `npm run build`, and the existing shell and plan harnesses. A local pass is not a device pass: the physical iPhone checklist (Safari and standalone) is listed in section 9 and stays "not verified" until the owner runs it.

---

## 9. Risks and owner input

Risks:

1. **iOS Safari behaviour.** Pinch interception, `overscroll-behavior-y` (iOS 16+), and non-passive touch handling for pull to refresh cannot be proven in Chromium. Mitigation: every gesture has a button path; pull to refresh and pinch are the first things to check on the device. If `overscroll-behavior` fails the rubber band fights the ring, and pull to refresh ships off until fixed.
2. **Edge conflicts.** Safari (non-standalone) back swipe and the app switcher take the screen edges; hence the 20px guard.
3. **Row swipe versus scroll.** Mis-detected axis locks feel broken. The 10px / 1.35 rule is reused from the shipped code; the harness covers a diagonal 30-degree drag.
4. **Collisions with D3b.** `TaskRow`, `TaskWorkspace` and lists are being edited by D3. Hence swipe integration is a late step and the hooks live in new files.
5. **Route slide on a heavy tree.** Enter-only WAAPI avoids remounts; if a screen's own entrance (`pc-rise`) stacks with the slide it will feel doubled, so the slide is skipped for the first paint of a screen and for routes that already animate.
6. **Glass over busy content.** Label contrast on a translucent bar depends on what scrolls under it; the 78% opacity and the contrast test cap the risk, and the solid fallback exists.
7. **Calendar recolour breadth.** A global recolour of `calendar-execution.css` rules could miss hard-coded inline colours (`#C6F06A`, `#61c6a5` in JSX for dots and borders). `calendar-premium.css` plus the container swap must cover them; the "no green computed colours" check in the harness catches leaks.
8. **`motion.ts` retune in flight.** `GLIDE` is still 0.24 while the tokens say 380ms. Builders must not hard-code either; read `MOTION` when it exists.
9. **Today day peek correctness.** `projectToday` accepts a date, but recovery, capacity and "plan" lookups assume `today`. Opus must audit every `today` use in `TodayWorkspace` before enabling the peek; if one cannot be made safe, the peek ships read-only for that block.
10. **Existing stored preferences.** Any phone preference write (density) stores the whole object including the old `primary`, so an owner who ever changed a preference would silently keep the old bar. Hence owner question 3.
11. **Not verified anywhere:** physical iPhone, standalone PWA mode, Vercel Preview, live data, notification delivery.

Owner questions (each with my recommendation):

1. **What should `+` do on Calendar?** You asked for "New event", but the app has no event record: Calendar holds tasks with reserved time, and the Google/ICS feed is read-only. **Recommended:** call it "New time block", which opens the task composer on the selected day and goes straight to choosing a time. Real events need a new data model and sync, a separate decision for later.
2. **Should Today swipe between days?** Today is built around today. **Recommended:** swipe the day strip between Yesterday, Today and Tomorrow only, with habit check-in, Plan day and recovery switched off on the other days (with a visible reason). Free browsing of any date stays on Calendar.
3. **Your phone may already have a saved shortcut list.** Changing the default does not touch a saved list, but any earlier preference change on the phone stored the old four shortcuts as if you had chosen them. **Recommended:** a one-time migration that replaces a saved list only when it is exactly the old default (Today, Tasks, Daily plan, Projects); anything you customised stays.
