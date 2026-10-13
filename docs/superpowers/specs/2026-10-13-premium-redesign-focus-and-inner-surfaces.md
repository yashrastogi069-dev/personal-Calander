# Premium redesign: Focus timer system and inner-surface map

Date: 2026-10-13. Author: Fable (owner-approved key design moment). Status: design proposal, not built. Branch `work/premium-redesign`.

Owner input behind it: "Focus clock really looks BAD", "so many things need redesign and new UX/UI". The main reference is the Coterie "Time tracker" (`BEST Shots/... 4.37.07 PM (6).jpeg`). The secondary reference is the Fernly "Time Tracker" card (`BEST Shots/... 4.37.07 PM.jpeg`).

Design read: a daily-use product tool for one owner on laptop and iPhone. It uses a precise-instrument language (a watch dial, not a game timer) inside the approved v2.1 white/blue and slate-dark identity. Dials: variance 5, motion 6 (state-driven), density 4.

Part 1 covers the Focus timer system in detail. Part 2 is the inner-surface redesign map and how it fits the build plan.

---

## Part 1: Focus timer system

### 1.1 What is wrong today (seen in synthetic-data screenshots, 1440 and 390, light and dark)

1. **Dashboard banner.** A 160px full-width white banner sits above the Dashboard grid. It holds a thin ring with a `TimerReset` icon in the middle, which looks like a loading spinner, plus "Recording focus", the digits and the task. **Stop is the filled blue primary button**, so the destructive action looks like the main one. It duplicates the "Focus this week" card a few centimetres below.
2. **Focus screen.**
   - The title appears twice ("Focus" page header, then "Focus" h2 plus a tagline).
   - The dial has 12 thin tick strokes floating inside a plain ring and a stray marker stub at 9 o'clock.
   - The readout is three stacked micro-lines ("Recording focus / 25 min target / 9 minutes to target").
   - Pause and Stop sit **below the fold** at 1440x1000.
   - The outcome form (note field, Mark done, Keep open, Adjust estimate) is always visible while the timer runs. That is decision overload in the middle of a session.
3. **Stale handoff while a session runs.** "Finish → Next step: You completed <task>" shows the previous session's handoff next to the live timer. This reads as if the current session has already finished.
4. **Mini control.** It is a floating card with four buttons (Pause, blue Stop, Focus, chevron) and a 40px dial with "FOCUS" printed in it. On the phone it takes about 120px above the bottom bar. In dark mode, Stop is light-blue filled.
5. **Phone 390.** The bottom nav covers the task title and the Pause/Stop row on the Focus screen. Nothing important fits in the first viewport except the dial.
6. **Visual system drift.** `focus-watch.css` uses none of the `--pc-*` tokens. There are no category colours, no motion and no tabular digit cells, and the eyebrows are mono uppercase.

### 1.2 What Focus really supports (from code; nothing here is invented)

| Capability | Source | Notes |
|---|---|---|
| Start with optional linked task, optional habit, target 5-240 min | `planner.focus.start`, `server/focus.ts` | Only one open session per workspace. The task must be unfinished. Habit only after the follow-up migration (`focusHabitAttributionAvailable`). |
| Pause and resume | `focus.pause` / `focus.resume` | Optimistic version check (`expectedVersion`). `pausedAt` is stored. |
| Count-up elapsed | `confirmedActiveSeconds` (`shared/focusClock.ts`) | The timer **counts up**. The target is guidance and the session never auto-ends. |
| Target guidance and overtime | `formatFocusTargetGuidance` | "9 minutes to target", "Target reached", "Target reached · 6m over". |
| Finish with outcome | `focus.finish` | `done` (completes the linked task; blocked for a recurring parent or incomplete hard prerequisites), `continue` (keep open), `adjust_estimate` (new estimate ≥5), `stopped` (saved as state `abandoned`). Optional note up to 2000 chars. |
| Next-step handoff | `focus.setFollowUp` | `task` + `nextStepTaskId`, `plan`, or `none`, after finishing, behind the migration flag. |
| Context | `shared/focusFollowUp` | Routine conductor, meeting horizon (next 3h), habit companion, session trail. |
| Evidence | `shared/focusMetrics` | Recorded minutes, measured tasks, estimate accuracy. |
| Linked task facts | snapshot `tasks` | Title, `estimateMinutes`, `categoryId` (→ tone via `resolveCategoryTones`), project. |
| Offline | `confirmedOnline` | Shows estimated time. Controls are disabled. |
| Display preference | localStorage `personal-calendar-focus-presentation-v1` | Dial or digital. Desk View is a local toggle. |

**Derivable on the client (no new data):**

- Session tone from the task category.
- "Ends about 12:11 if uninterrupted" (now + remaining).
- "Paused at 11:58" (from `pausedAt`).
- The next meeting's position on the dial (from `externalEvents`).
- Today's session count and total (sessions by `startedAt`).
- The target-reached moment (elapsed crosses target while the page is visible).
- "Use the task estimate" as a duration preset.
- `H:MM:SS` digits for sessions over an hour (new formatter; the existing one drops seconds after an hour).

**Needs data:** see §1.11.

### 1.3 One instrument: `FocusDial`

Every surface uses one component in four sizes. A family resemblance makes the session read as the same object wherever it appears, and a shared-element morph can carry it between surfaces.

| Size | Diameter | Where | Ticks | Digits inside |
|---|---|---|---|---|
| `xs` | 24px | Mini pill | none (arc only) | no |
| `sm` | 96px | Dashboard card | 30 | no (digits beside) |
| `md` | 168px | Pill popover, phone sheet, finish panel | 60 | yes, 28px |
| `lg` | `clamp(260px, 72vw, 360px)` | Focus screen | 60 | yes, `--pc-text-timer` |

Anatomy (`lg`, viewBox 240):

```
            ╷ 12 o'clock = session start
     ·  ·  ┃┃┃ ·  ·  ·              tick ring: 60 ticks, every 5th is major (8u vs 4u)
  ·     ┃┃┃┃      ·                 elapsed ticks lit in --pc-k, rest in --pc-line
 ·   ╭━━━━━━━━╮    ·              progress arc r=94, stroke 10, round caps, --pc-k
·   ┃  ● Focusing ┃  ·            state pill (pc-live dot only while running)
·   ┃   14:32     ┃  ▸ ←──        digits; ▸ = meeting notch (if inside target)
·   ┃  of 25m     ┃  ·            sub line: target + "ends ~12:11"
 ·   ╰━━━━━━━━●   ·               ● arc head: 12px dot, 3px card ring, tone halo
  ·     ░░░░      ·               ░ comet: 3-tick highlight, one lap per minute
     ·  ·  ·  ·  ·
```

- **Face.** The full circle is the target. Each tick is target/60 (25m → 25s per tick). The arc grows clockwise from 12.
- **Comet (seconds sweep).** A short three-tick highlight steps around the tick ring once a minute. It is the only ambient "live" cue, and it shows only while the session is running.
- **Overtime lap.** After the target, the arc stays full and a second, thinner ring (r=82, stroke 4, dotted `2 4` dash, the hatched-future motif from D2) draws the overtime as a fraction of another target length. Digits keep counting the total.
- **Meeting notch.** A 6px triangle on the outer edge, with the label "Meeting 12:30" on hover/focus. It shows when the next meeting starts before the target is reached. Derived from `buildMeetingHorizon`.
- **Tone.** `pc-tone-<slot>` comes from the linked task's category. An unlinked or uncategorised session uses the brand accent (`--accent`), never grey.
- **Digits.** One fixed-width cell per character (`0.6em`) with tabular figures, so nothing jitters and each digit can roll on its own. Format `MM:SS` under an hour, `H:MM:SS` from one hour.

### 1.4 Shared state model

| State | Ring | Ticks | Head / comet | Center pill | Primary action | Secondary |
|---|---|---|---|---|---|---|
| **Idle** (no open session) | Full ring hatched in `--pc-planned` (the plan, not progress) | `--pc-line` | none | `Ready` (Timer icon) | Start focus (Play) | Duration chips |
| **Running** | Solid `--pc-k` arc to elapsed/target | Elapsed lit `--pc-k` | Head with halo; comet steps each second | `● Focusing` with `pc-live` | Pause | Finish |
| **Paused** | Arc and lit ticks at 40% opacity | Same, dimmed | Head becomes hollow ring; no comet | `Paused at 11:58` (Pause icon) | Resume (Play) | Finish |
| **Overtime** | Arc full; dotted overtime lap grows | All lit | Head on the lap; comet continues | `Target reached · +6m` (Flag icon), neutral tint | Pause | Finish (gets a soft tone fill to invite closing) |
| **Finished** | Arc closes to its final value; Done → check | All lit, then fade | none | `Saved` (CheckCircle2) | Next-step choice | Start another |
| Offline | As running/paused, digits prefixed `≈` | as is | comet hidden | `Estimated · offline` (WifiOff) | disabled, label "Reconnect to control" | none |
| Conflict / error | unchanged | | | | inline alert with `Refresh` | |

Overtime colour is deliberately not amber or red. Running past the target is information, not failure (Product principle 3, "recovery is part of planning").

---

### 1.5 Surface A: Dashboard focus card

The live session replaces the full-width banner. The "Focus this week" card is the home of the timer and changes mode with the session, so the grid never jumps (same grid area, same size). The persistent pill is hidden on the Dashboard, just as it is on the Focus screen.

**Layout, idle (white card, like the other KPI cards):**

```
┌──────────────────────────────────┐
│ [⏱ tile] Focus this week      ↗ │   ↗ = Open Focus (labelled, 36px)
│                                  │
│ 41m  of 3h planned               │   count-up, existing data
│ ▓▓▓▓▓▓▓▓▓░░░░ (stacked by tone)  │   existing pc-grow-x bar
│ ● Personal 41m                   │
│ ──────────────────────────────── │
│ ( ▶ Start focus )  on "Draft Q4…"│   up-next task if any, else "Start focus"
└──────────────────────────────────┘
```

**Layout, running / paused / overtime (night card, Fernly-style):**

```
┌──────────────────────────────────┐  --pc-night bg + faint contour-line texture in tone
│ ● Focusing             Open ↗    │
│  ╭────╮   14:32                  │  sm dial 96px + 40px digits
│  │ ◔  │   of 25m · ends ~12:11   │
│  ╰────╯   Draft Q4 report        │  task, 1 line, category dot + name
│ ( ❚❚ Pause )   ( ■ Finish )      │  44px round-rect buttons with labels
│ 41m this week                    │  KPI demoted to a footnote
└──────────────────────────────────┘
```

- **Finished.** For 10 minutes after a session ends on this device, or until a next step is saved, the card reads "Saved · 25m on Draft Q4 report" with "Choose next step" (opens the Focus summary). Then it returns to idle. It uses the existing handoff data.
- **Phone.** When a session is open, the card moves to the top of the stack via CSS `order`.
- **Start.** Start focus calls the existing `actions.startFocus(upNextTaskId)` or `openFocus`, which open the Focus screen with the task preselected. There is no silent one-tap start, because the duration choice belongs to the user.

**States:** idle as above. Running: night card, live dot, comet on the `sm` dial. Paused: digits stay ink-on-night, the dial dims, and the label "Paused at 11:58" replaces "Focusing". Overtime: pill `+6m over` next to the digits, and the dotted lap appears on the `sm` dial. Finished: see above.

**Motion:**

| Trigger | Animation | Duration / easing | Reduced motion |
|---|---|---|---|
| Card mounts | existing `pc-rise` with stagger index | `--pc-dur-base`, `--pc-ease` | none (final state) |
| Session starts or ends (idle ↔ night) | Background and colour crossfade; content blur-bridge (`pc-blur-out` → `pc-blur-in`) | 240ms `--pc-ease` | instant swap |
| Week total appears | existing `CountUp` | `--pc-dur-data` `--pc-ease-data` | final number |
| Arc per second | `stroke-dashoffset` step | 240ms `--pc-ease` (mechanical tick) | no transition |
| Digit change | changed digit only rolls (`pc-tick`) | 140ms `--pc-ease` | instant |
| Running live cue | `pc-live` dot + comet | 2s loop / 1s steps, running only | hidden |
| Pause ↔ Resume | icon morph: out scale .8 + blur 2px, in `pc-pop` | 140ms `--pc-ease` | instant |
| Button press | scale .97 | `--pc-dur-press` | none |
| Target reached (visible) | `pc-burst-ring` in tone around the dial + pill `pc-pop` | `--pc-dur-celebrate` | pill appears, no burst |

**Tokens:** `--pc-night`, `--pc-on-night-muted`, `--pc-night-accent`, `--pc-k` via `pc-tone-*` (remapped by a new `.pc-on-night` class to the dark-theme category values for ≥3:1 on night), `--pc-track`, `--pc-r-feature`, `--pc-e2`, `--pc-text-display` (digits 40px on `sm`), `.pc-num`.

**Accessibility:**

- The card is a `section` labelled "Focus".
- Digits are `aria-hidden`. A `role="timer"` text reads "14 minutes of 25, Draft Q4 report". It updates once a minute, not every second.
- Buttons carry visible text, and the Open link names its target.
- The texture is decorative (`aria-hidden`). Contrast: night text ≥4.5:1, tone ring ≥3:1 (add both to the D0 contrast test).

---

### 1.6 Surface B: Focus screen (desktop and laptop)

One title. A stage on the left and a context rail on the right. The controls always sit inside the first viewport.

```
Focus · Friday, October 2                                     [Capture] [Search]
┌──────────────────────────────── stage (r 24, tone wash) ──┐ ┌── rail 360px ─────────┐
│  [● Personal] Draft Q4 report · Q4 Planning        ⋯ menu │ │ Up next after this    │
│                                                            │ │ Stay with Draft Q4…   │
│                    ╭───────────────╮                       │ │ [Return to timer]     │
│                 ·  │   ● Focusing   │  ·                   │ ├───────────────────────┤
│               ·    │    14:32       │    · ▸ Meeting 12:30 │ │ Coming up             │
│               ·    │ of 25m · ~12:11│    ·                 │ │ 12:30 Planning mtg    │
│                 ·  ╰───────────────╯  ·                    │ │ in 30m  [Calendar]    │
│                                                            │ ├───────────────────────┤
│          ( ■ Finish )   (  ❚❚  Pause  )   ( ⤢ Full screen )│ │ Today                 │
│                                                            │ │ ▮▮▯ 2 sessions · 41m  │
│  30m estimate · 41m recorded on this task                  │ │ Habits: [✓Read] [Walk]│
└────────────────────────────────────────────────────────────┘ │ Accuracy: on target   │
                                                               └───────────────────────┘
```

**Idle (setup) stage**, replacing the current "Choose the work" form:

```
│        ╭ hatched ring ╮                                           │
│        │    Ready     │      What are you focusing on?            │
│        │    25:00     │      [ 🔍 Draft Q4 report · Personal · 30m ▾ ]  (combobox)
│        ╰──────────────╯      Length  (25m)(50m)(90m)(Use estimate 30m)(Custom)
│                              ▸ Count time toward a habit (disclosure, flag-gated)
│                              (  ▶  Start focus  )                   │
```

- **Task combobox.** Searchable. Grouped as "Today's commitments" first, then "Other open tasks". Each row shows the category chip and the estimate. "No task (unlinked)" is the last option. The native `select` is retired.
- **Duration.** Selecting a duration redraws the hatched ring and rolls the digits to the planned length. Custom opens a 5-240 stepper. Drag-to-set on the dial (`role="slider"`, 5-min steps) is P2.

**Rail by state:**

- Running/paused: Up next (conductor), Coming up (meeting horizon), Today (session trail as a mini bar strip plus habit chips with check toggles), Evidence (three numbers).
- Idle: the last session's handoff card ("Last session: 25m on X · next step not chosen"). It appears **only when no session is open**, which fixes the stale-handoff bug.

**`⋯` stage menu:** Display (Dial | Digits; keeps the existing preference), Full screen (replaces Desk View: the stage fills the viewport, dial up to 520px, Wake Lock requested if supported), Open task.

**States:** as in §1.4. While a session runs, the outcome form does not exist on screen. It lives behind Finish (Surface E).

**Motion:**

| Trigger | Animation | Duration / easing | Reduced motion |
|---|---|---|---|
| Screen mount with session | Arc draws 0 → current; lit ticks sweep in order (stagger capped so the sweep ≤ 600ms) | `--pc-dur-data` `--pc-ease-data` | final state |
| Start focus | Start pill shares `layoutId` with the Pause button and morphs into it; hatched ring crossfades to the solid arc; setup fields `pc-blur-out` | 240ms `--pc-ease` | instant swap |
| Arc and comet per second | arc step + comet group rotate step | 240ms / 140ms `--pc-ease` | arc jumps; comet hidden |
| Digit roll | per changed digit, `pc-tick` | 140ms | instant |
| Pause | arc and ticks to 40% opacity; head morphs filled → hollow; comet fades | 240ms `--pc-ease` | opacity only, instant |
| Resume | reverse of pause; comet fades back in at the current second | 240ms | instant |
| Target reached | ring flash (stroke-width 10 → 12 → 10), `pc-burst-ring` + `pc-burst-dots` in tone, state pill `pc-pop` to "Target reached" | `--pc-dur-celebrate` (520ms; a completion moment, same exception as D2) | pill text change only |
| Overtime lap | dotted lap grows by step like the arc | 240ms | jumps |
| Meeting notch appears | `pc-pop` from scale .95 | 240ms | instant |
| Rail cards | `pc-rise` staggered, first mount per route only (D0 rule) | `--pc-dur-base` | none |
| Full screen enter/exit | stage scale .98 → 1 + fade; dial shared-element grow | 240ms `--pc-ease` | instant |
| Stage hover | none (instrument stays calm) | | |

**Tokens:**

- Stage `--pc-card` with a radial wash `color-mix(in srgb, var(--pc-k-soft) 70%, transparent)` at the top, plus `--pc-r-feature` and `--pc-e1`.
- `--pc-track`, `--pc-line`, `--pc-planned` (hatch), `--pc-k`/`--pc-k-ink`.
- New `--pc-text-timer` for the digits.
- Text: `--pc-text-h1` for the task title, `--pc-text-body-sm` for the sub line.
- Rail cards use `--pc-r-panel` with tinted icon tiles (D2 pattern).

**Accessibility:**

- One `h1` ("Focus"). The task title is an `h2`.
- `role="timer"` minute text as in A.
- One polite live region (`role="status"`) announces only these events, never seconds:
  - "Focus started, 25 minute target."
  - "Paused at 14 minutes."
  - "Resumed."
  - "5 minutes to target."
  - "Target reached."
  - "Session saved."
- The ring and comet are `aria-hidden`. Meeting notch info is repeated in the rail as text.
- Controls are ≥44px with visible labels and keep the `--focus-ring` 2px/2px offset.
- Optional P2 shortcuts on this screen only: `Space` pauses or resumes when focus is on the stage; `F` opens Finish. Both are listed in the `⋯` menu. They are not animated when used from the keyboard (Emil: keyboard actions are instant).
- Colour never stands alone: every state has a word in the pill.

---

### 1.7 Surface C: Persistent mini control (all other pages)

The four-button floating card becomes a **Focus pill**: a dark capsule (a calm "dynamic island") in the header's right cluster on desktop, and docked above the glass bottom bar on phone.

```
Desktop header:  ... [ (◔) 14:32  Draft Q4 rep…  ❚❚ Pause ]  [+ Capture] [Search]
                     xs dial  digits  task (max 18ch)  labelled button

Click the pill body → popover (anchored, 320px, origin top-right):
┌─────────────────────────────┐
│ ● Focusing     Open Focus ↗ │
│        md dial 168          │
│         14:32               │
│     of 25m · ends ~12:11    │
│ Draft Q4 report · Personal  │
│ ( ❚❚ Pause )  ( ■ Finish )  │
└─────────────────────────────┘
```

- Finish in the popover opens the same finish panel (Surface E) as a dialog. The pill can therefore record any outcome, not only "stopped". It uses the same mutation and no new data.
- The pill is hidden on the Dashboard (the card shows the session) and on the Focus screen.
- **Paused:** the capsule switches to `--pc-card-2` with an ink border, `❚❚` becomes `▶ Resume`, and the digits are static.
- **Overtime:** a `+6m` tag after the digits.
- **Offline:** `≈` digits and the button reads "Offline", disabled.
- **Finished:** the pill collapses away after a "Saved ✓" flash (1.2s), with a "Next step" toast action linking to the summary.

**Motion:**

| Trigger | Animation | Duration / easing | Reduced motion |
|---|---|---|---|
| Leave Focus screen with an open session | `lg` dial shared-element shrinks into the pill's `xs` dial (framer `layoutId="focus-dial"`); capsule widens from the dial | 240ms `--pc-ease` | pill fades in, 0ms |
| Popover open / close | `pc-pop` from scale .96, origin at the pill; exit 160ms fade | 240ms / `--pc-dur-exit` | opacity only |
| Digit roll, arc step | as in B | 140ms / 240ms | instant |
| Pause ↔ Resume | capsule colour crossfade + icon morph | 140ms | instant |
| Live cue | `pc-live` dot on the xs ring, running only | 2s loop | hidden |
| Session saved | check `pc-spring-pop` + `pc-check-draw`, then capsule collapses (scaleX to the dial, fade) | 520ms then 160ms | "Saved" text, then removed |
| Press | scale .97 | 80ms | none |

**Tokens:** `--pc-night` capsule with `--pc-night-border` in dark, `--pc-on-night-muted`, `.pc-on-night` tone remap, `--pc-r-pill`, `--pc-e2` for the popover, `--pc-z-overlay` for the popover layer.

**Accessibility:**

- The pill is a `region` labelled "Current focus session". The body is a button ("Show focus controls, 14 minutes, Draft Q4 report") with `aria-expanded`.
- The Pause/Resume button is separate and named.
- The popover is a non-modal dialog: Escape closes it and focus returns to the pill.
- The minute-level `role="timer"` lives in the popover. The pill does not announce anything. Announcements come only from the single shared status region (mounted once in the shell), so pages never double-announce.

---

### 1.8 Surface D: Phone (390 x 844)

**Focus screen, running.** Everything that matters fits above the bar.

```
┌ 390 ───────────────────────────────┐
│ Focus                    Fri 2 Oct ⋯│  compact header, single title
│ [● Personal] Draft Q4 report        │  2-line clamp
│                                     │
│          ╭───────────────╮          │
│        · │  ● Focusing   │ ·        │  lg dial = 280px
│        · │    14:32      │ ·        │
│        · │ of 25m ~12:11 │ ·        │
│          ╰───────────────╯          │
│                                     │
│  (■ Finish)   ( ❚❚ Pause )   (⋯ More)│  thumb row; Pause 64px circle + label under
│                                     │
│ ─── scroll for: Up next · Coming up │
│     · Today · Evidence ───          │
├─────────────────────────────────────┤
│   glass bar (compact pill on Focus) │  D3.5; padding-bottom = bar + safe-area
└─────────────────────────────────────┘
```

- The bottom bar starts compact on the Focus screen (D3.5 behaviour), and the stage reserves `calc(var(--pc-phone-bar) + env(safe-area-inset-bottom))`. The current overlap bug cannot recur.
- **Idle on phone:** dial 220px hatched, task combobox opens as a full-height sheet with search, duration chips scroll horizontally, Start is a full-width pill above the bar.
- **Pill on phone (other pages):** a 44px capsule, centred 8px above the bar, max 340px wide: `(◔) 14:32 · Draft Q4… · ❚❚`. When the bar compacts on scroll, the pill shrinks to 36px (dial and digits only). Tapping it opens a **bottom sheet** with the `md` dial, labelled Pause/Resume and Finish, and "Open Focus". Drag down to dismiss.
- **Full screen on phone** (from `⋯`): dial up to 340px, digits 80px, screen Wake Lock if available, bar hidden. Exit is a labelled "Done" button.

**Motion (phone-specific; dial motion as in B):**

| Trigger | Animation | Duration / easing | Reduced motion |
|---|---|---|---|
| Pill → sheet | sheet slides from 100% with the dial shared from pill to sheet | 300ms `cubic-bezier(.32,.72,0,1)` (iOS sheet; proposed `--pc-ease-sheet`, shared with D3.5) | fade, 0ms |
| Sheet drag dismiss | follows finger, momentum dismiss at 0.11 px/ms, damped upward | gesture-driven | button-only close remains |
| Bar compact ↔ pill shrink | pill height 44 → 36, task text fades | 240ms `--pc-ease` | instant |
| Thumb-row press | scale .97, Pause circle .95 | 80ms | none |
| Target reached | burst as in B + `navigator.vibrate` where supported (not on iOS Safari) | 520ms | text only |

**Tokens:** as B plus proposed `--pc-ease-sheet` and `--pc-phone-bar` (owned by D3.5).

**Accessibility:**

- Thumb-row targets are ≥48px.
- The sheet is `role="dialog"` `aria-modal="true"` with a visible title "Focus" and a labelled Close button (the drag gesture is never the only way out).
- Text never drops below 12px. The dial digits respect dynamic type up to 200% by wrapping the sub line below the dial.

---

### 1.9 Surface E: Finish and follow-up panel

Finishing becomes a two-step panel instead of an always-visible form plus a separate next-step card. Desktop: the stage controls give way to an inline panel while the dial shrinks to `md` (the session keeps running until saved). Pill: a centred dialog. Phone: a bottom sheet.

**Step 1: How did it go?**

```
┌───────────────────────────────────────────────┐
│  ( md dial still live )   14:32 on Draft Q4…  │  recap updates live
│                           target 25m · est 30m│
│  How did it go?                                │
│  ┌───────────────────────────────────────────┐│
│  │ (✓) Done. Complete the task               ││  radio tiles, icon tile + text
│  ├───────────────────────────────────────────┤│
│  │ (→) Keep the task open                    ││  default when linked
│  ├───────────────────────────────────────────┤│
│  │ (⌛) Needs more time   [ 45 ] min estimate ││  stepper appears inline when chosen
│  └───────────────────────────────────────────┘│
│  Note (optional) [ What changed?            ] │
│  ( Save session )        End without outcome  │  text button = "stopped"
│  Back to focus                                 │
└───────────────────────────────────────────────┘
```

- Done and Needs more time are disabled with a reason when there is no linked task.
- Server refusals (recurring parent, hard prerequisites) show inline under the tile with "Open task". They never appear as a toast only.
- Unlinked sessions see one tile, "Save the time", plus End without outcome.

**Step 2: Saved. What next?** Replaces the "Finish → Next step" card.

```
┌───────────────────────────────────────────────┐
│   ✓ (burst)  Session saved                    │
│   14m 32s  ·  target 25m  ·  [30m / 15m] chip │  TimeChip planned/actual
│   "Outlined sections 1-3"                      │  note if any
│   What next?                                   │
│   [ ▶ Next task  Review the calendar ▾ ]       │  preselected from the conductor
│   [ 📅 Daily plan ]   [ ☕ Nothing for now ]    │
│   ( Save and go )         Start another focus  │
└───────────────────────────────────────────────┘
```

- Without the follow-up migration, step 2 shows "Open task" and "Plan next step" links (the current fallback) and no save.
- A remote change during editing keeps the existing "Use latest saved action" recovery copy, shown as an inline alert.

**States:** Step 1 while running or paused. Step 2 after a successful finish. Error: inline alert keeps the draft. Offline: Save disabled with "Reconnect to save. Your choice stays here."

**Motion:**

| Trigger | Animation | Duration / easing | Reduced motion |
|---|---|---|---|
| Open (Finish pressed) | desktop: controls `pc-blur-out`, panel `pc-rise`, dial shrinks lg → md (shared element); phone: sheet as in D | 240ms `--pc-ease` / 300ms sheet | instant |
| Choose a tile | tile border and fill crossfade; radio dot `pc-spring-pop`; stepper reveals with `clip-path` inset 100% → 0 | 140ms / 240ms | colour only |
| Save → Done | arc closes to the final value; center digits swap to a check (`pc-check-draw`); `pc-burst-ring` + `pc-burst-dots` in tone | 520ms `--pc-dur-celebrate` | static check + "Session saved" |
| Save → Keep open / stopped | arc settles; no burst (only real completion celebrates) | 240ms | instant |
| Step 1 → 2 | content crossfade with blur bridge; time count-up in the summary | 240ms + `--pc-dur-data` | instant, final number |
| Save and go | panel exits 160ms, then navigation | `--pc-dur-exit` | instant |

**Tokens:** choice tiles `--pc-card` / selected `--pc-k-soft` with `--pc-k` 1.5px full border (no side stripes), `--pc-r-panel`, icon tiles with `--pc-k-soft`/`--pc-k-ink`, `--pc-ok` for the saved check, `TimeChip` and `StatusPill` primitives.

**Accessibility:**

- Tiles form a `radiogroup` with arrow-key movement.
- Focus moves to the "How did it go?" heading on open and back to Finish on close. Escape means Back to focus.
- Step 2 announces "Session saved, 14 minutes" once.
- Every error is `role="alert"` and placed next to the control it concerns.

### 1.10 Tokens to add (additive, in `tokens-v2.css`)

| Token / class | Value | Why |
|---|---|---|
| `--pc-text-timer` | `clamp(56px, 15vw, 80px)`, line-height 1, weight `--pc-w-display`, tracking `-.02em` | Dial digits (display 48px is too small for the instrument) |
| `--pc-dial-lg / md / sm / xs` | `clamp(260px,72vw,360px)` / 168 / 96 / 24px | One dial, four sizes |
| `--pc-ease-sheet` | `cubic-bezier(.32,.72,0,1)` | Phone sheets (shared with D3.5) |
| `.pc-on-night` | remaps `--pc-k*` to the dark-theme category values | Tone ≥3:1 on night surfaces |
| `.pc-digit` | `display:inline-block; width:.6em; text-align:center; font-variant-numeric: tabular-nums` | Per-digit roll without jitter; verify Onest `tnum` |
| `.pc-hatch` | SVG pattern for planned rings, reuses the D2 hatched-bar pattern | Idle ring |

Everything else is reused: `--pc-ease`, `--pc-ease-data`, `--pc-dur-press/fast/base/exit/data/draw/celebrate`, `pc-tick`, `pc-pop`, `pc-rise`, `pc-live`, `pc-burst-ring`, `pc-burst-dots`, `pc-spring-pop`, `pc-check-draw`, `pc-blur-in/out`, `useBecameTrue` (target reached and saved moments), `useChangeCount` (digit keys). The existing reduced-motion block already zeroes the durations. Add `.pc-comet` and the burst classes to its `animation: none` list.

### 1.11 Needs data (not designed in; flagged)

| Idea | Why it needs data |
|---|---|
| Pause count and a pause timeline on the ring | Segments exist server-side (`focusSessionSegments`) but are only exposed as habit aggregates. Needs a read procedure. No migration. |
| "+5 min" or change target mid-session | No update-target mutation (`targetMinutes` is fixed at start). Needs a new procedure. No migration. |
| Switch the linked task mid-session | Not supported by `focus` procedures. |
| Target-reached notification when the app is in the background | Needs push (G2 / D7). In-app only until then. |
| Breaks (Pomodoro rest timer) | No break records. A client-only break timer would be unsaved; not recommended. |
| Daily focus goal ring | No goal field. |
| Exact today total across midnight | Needs segments by `localDate` (as above); `startedAt` grouping is used meanwhile, matching the Dashboard. |

### 1.12 Copy changes

| Old | New |
|---|---|
| "Recording focus" | "Focusing" |
| "Stop" (primary) | "Finish" (secondary). "End without outcome" lives inside Finish. |
| "Desk View" | "Full screen" |
| "Finish → Next step" | "Saved. What next?" |
| "A calm space to make meaningful progress." | removed (the title already says Focus) |
| "Routine conductor" | "Up next after this" |
| "Meeting horizon" | "Coming up" |
| "Focus evidence: Measured, not assumed" | "Evidence" |

---

## Part 2: Inner-surface redesign map

Evidence: synthetic-preview screenshots at 1440 (Today, Inbox, Tasks, Plan, Calendar, Goals & Projects, Review, Analytics, Focus) plus code. Only `features/dashboard` and `features/shell` use `pc-*` classes today. Every other feature folder has zero `pc-*` usage.

Cross-cutting problems seen on almost every inner page:

1. The "Needs review" banner takes a full row on every page.
2. Page tabs are boxed buttons, not `SegmentedTabs`.
3. Mono uppercase eyebrows ("DAILY PLAN", "WEEKLY REVIEW", "KEYBOARD").
4. Marketing-size hero headlines inside tools ("Make this day believable.", "Close the loop before you open a new one.").
5. Native `select` filters.
6. Legacy green: a green search border in dark Tasks, green bar fills in Analytics.
7. Empty states are plain sentences in dashed boxes.

Build these shared pieces once (in D2.5, see below), then reuse them everywhere:

- `PageHeader`: one title, a SegmentedTabs slot and an actions slot.
- `SectionCard`: tinted icon tile, title and action.
- `EmptyState`: icon tile, one line and one action.
- `ChoiceTile`
- `Sheet`
- `FilterChips`
- `ReviewChip`: the banner shrunk to a header chip.

| Surface | Seen today | Redesign direction (one line) | P |
|---|---|---|---|
| Review banner (global) | Full-width "Needs review · Review safely" bar on every page | Collapse into a header `ReviewChip` with a count badge that opens the existing recovery flow; full banner only for blocking conflicts | P1 |
| Tasks (List / Board / Saved) | Underline tabs, native selects, "3 in this view", green-bordered dark search | `PageHeader` + SegmentedTabs; filter chips with counts; rows with category chip, TimeChip, swipe/drag affordances; Board columns as tinted lanes (D3 drag) | P1 |
| Task detail sheet | Legacy inspector CSS | Right sheet (desktop) / bottom sheet (phone) with a title, status pill, "why it matters" slot (D4), sections as SectionCards, Start focus button | P1 |
| Inbox triage | Legacy rows | Card stack with one decision at a time: Schedule / Today / Someday / Delete as labelled chips, swipe on phone, progress "3 left" ring | P1 |
| Today | Mixed legacy cards, light-blue empty heatmap, "0 commitments · 0 min known" bar | Timeline-first day column + flexible work tray; habits as chips with spring check-off; heatmap retired here (lives in Habits) | P1 |
| Capture (sheet + NL workspace) | Legacy capture CSS | Command-style sheet: one input, parsed tokens shown as chips (date, category, estimate) as you type, Enter to save; context "+" from D3.5 | P1 |
| Calendar | Hero "Reserve real focus time", blue date band, always-on keyboard legend, mono slot labels | Quiet header with SegmentedTabs Day/Week/Month; v2.1 grid (weekend tint, hatched busy, pulsing now-line); unreserved tasks as a draggable tray; keyboard help in a `?` popover | P1 |
| Plan Studio: Daily plan stages | Boxed tabs, "01 Resolve…05 Review" numbered cards, giant headline | A real stepper (the sequence is real, so numbers stay) as a compact progress rail; one stage panel at a time; capacity as a ring + planned/actual chips | P1 |
| Plan Studio: Weekly plan board | `plan-week.css` legacy | Seven day lanes with capacity bars, hatched future, drag (D3 primitives), weekly objectives pinned on top | P2 |
| Dialogs and sheets (confirm, recovery, settings dialogs) | shadcn defaults + legacy styles | One `Sheet` and `Dialog` skin: r24, e3, title + icon tile, primary on the right, destructive never primary-blue; iOS sheet easing | P1 |
| Habits | `habit-workspace.css` legacy | Habit cards with streak ring, 14-day squares (D2 pattern), spring check-off + burst, cadence chip; stats move to Analytics | P2 |
| Goals & Projects (+ detail, Intention) | Giant "Move projects forward" hero card around an empty state; mono counters in tabs | PageHeader + SegmentedTabs with counts; project cards with StatusPill (evidence rules from D2), progress bar, next step, category chip; detail page = header + roadmap strip + task list | P2 |
| Roadmap | `roadmap.css` legacy | Horizontal quarter lanes with hatched future, milestone diamonds, today line; tap to open project | P2 |
| Analytics | Mono labels, green bars showing a fill at 0 min (shows non-real data), dashed empty boxes | D5: real-data-only charts (empty = empty track), focus by category stack, estimate accuracy, completion pace; dataviz-validated palette; count-ups | P2 |
| Review ritual + History | Marketing hero with an empty grey right panel | Guided checklist as ChoiceTiles with progress ring; week summary cards (real numbers); History as a timeline of saved reviews | P2 |
| Empty and first-run states | Plain sentences in dashed boxes | `EmptyState` primitive everywhere: tinted icon tile, one sentence, one action; no fake numbers | P2 (primitive in D2.5, sweep in D6) |
| Search | Legacy workspace | Fold into the command palette results style; grouped results with type icons | P3 |
| Settings / Connections / Categories & Recycle Bin | Legacy forms | Settings list groups with icon tiles and toggles; Connections as provider cards with a status pill; category editor with swatch-only colours (D0 deferred) | P3 |
| Phone More launcher | Not built | D3.5 launcher grid of tinted tiles with live badges (already approved) | P1 (D3.5) |

---

## Part 3: Build-order recommendation

1. **New slice D2.5 Focus, now, before D3.** It is the owner's sharpest complaint. It is contained (`features/focus`, the Dashboard focus card, the shell pill slot) and needs no schema or new dependency. It also produces the primitives every later slice needs:
   - `FocusDial` (a generalised ring)
   - digit roll
   - `Sheet`
   - `ChoiceTile`
   - `EmptyState`
   - `PageHeader`
   - `ReviewChip`

   Build order inside the slice:
   - (a) `FocusDial` + tokens + gallery entry
   - (b) Focus screen running/paused/overtime
   - (c) Finish panel
   - (d) idle setup
   - (e) Dashboard card
   - (f) pill + popover
   - (g) phone layout and sheet (the sheet takes its easing from D3.5; use the token now)

   Opus builds it with the design skills. Harness: extend `preview-t19-focus.py` with screenshots for all five states at 390/1440, light and dark, and reduced motion.
2. **D3 Tasks drag.** Add Tasks List/Board/Saved, Inbox triage, the task row, the Task detail sheet, filter chips, and the ReviewChip in the header. This is where Tasks' legacy green comes out.
3. **D3.5 iPhone nav & gestures.** Add the Focus pill docking and compaction, the shared Sheet system (Capture sheet, pill sheet, More launcher), and **Today + Calendar visuals**, because swipe-between-days and pinch need the new grids anyway. If it grows too big, split into D3.5a (bar, sheets, launcher, capture) and D3.5b (Today and Calendar).
4. **D4 Why it matters.** Add the Plan Studio daily stepper and weekly board, Goals & Projects, project detail, Roadmap, and the reason slot in the Task detail sheet. These are the surfaces where reasons appear.
5. **D5 Analytics.** Add Analytics, Review ritual, History, the Habits page (stats move here), and Focus evidence charts (per-category focus, estimate accuracy). If the owner wants pause analytics, add the segment read procedure from §1.11 here.
6. **D6 Polish.** Add Settings, Connections, Categories & Recycle Bin, Search, the empty-state sweep, a dialog consistency audit, and the legacy-green ratchet to zero on rebuilt screens.
7. **D7 Glance & reminders.** Add focus blocks in the calendar feed (already planned), the target-reached and session-left push once G2 opens, and a badge count.

## Owner answers (2026-10-13)

All four recommended options were chosen:
1. Count stopped time in focus totals. Done in `dashboardModel.ts`, with tests.
2. At the target, keep counting with the overtime lap and a quiet "Target reached" moment.
3. The Dashboard card is dark while live and white when idle.
4. Build D2.5 Focus now, before D3.
