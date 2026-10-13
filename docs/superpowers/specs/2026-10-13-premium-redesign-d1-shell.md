# Premium redesign D1: shell and navigation

Date: 2026-10-13. Status: locally implemented; the browser harness needs a re-run after the review fixes (see Evidence). Builds on [D0](2026-10-13-premium-redesign-d0-design.md). Target look: v2.1 preview boards (Main, Today, Calendar, Phone).

## Scope
- Grouped desktop rail with live badges, a "Search or jump ⌘K" entry and a More disclosure.
- ⌘K / Ctrl+K command palette.
- Home view tabs: Dashboard | Today | Calendar.
- Phone floating pill with a centre Capture button.
- Grey page backdrop on the Dashboard only.
- Relabel Insights as Analytics.

No change to URLs, stored preferences, schemas or planner data.

## Navigation model (`client/src/features/shell/premiumNavigation.ts`)

| Group | Items (destination/view) |
| --- | --- |
| (Home) | Dashboard home/overview, Today home/today (badge "N left"), Inbox tasks/inbox (badge N) |
| Plan | Tasks tasks/list (badge "N overdue", alert tone), Plan plan/daily, Calendar plan/calendar, Roadmap plan/roadmap |
| Grow | Goals & Projects intentions/projects, Habits habits/due (badge "N due"), Focus home/focus |
| Reflect | Review review/rituals, Analytics review/insights |
| More (closed `<details>`) | Goals intentions/outcomes, Connections settings/connections, Categories & Recycle Bin settings/categories |

- `activeNavState` returns `exactId`, which gets `aria-current="page"` and is always unique. A view without its own item highlights its parent with `is-active-parent` and no aria-current.
- Badges:
  - Inbox = open, unscheduled tasks with no planned time (same as `inboxTasks()`).
  - Overdue = open tasks with `dueLocalDate < today`.
  - Today left = unique open task records in today's timeline plus the flexible list (carried commitments de-duplicated).
  - Habits due comes from the Today projection.
  - A count of zero hides the badge.
- Rail buttons always carry an `aria-label`, including the badge text, so the icon-only mid-width rail (681–1060px) keeps its names.

## Command palette (`CommandPalette.tsx`)
- Groups: Actions (Capture, Start Focus, Toggle theme), Go to (every nav item), Tasks (open tasks by title, max 6), and "Search everything for …".
- Prefixes: `>` shows actions only, `#` shows tasks only.
- cmdk item values are static strings (a value that includes the query matches everything).
- Shortcut: Ctrl/⌘+K, also from inputs. Ignored during IME composition, when another `[role=dialog]` is open, and before the snapshot loads.
- Search from the palette pushes one history entry `{home, search, action: search, q}`. It never rewrites the page being left.
- Opening a task from the palette clears the Search return refs.

## Home tabs
- `SegmentedTabs` with `activationMode="manual"`, so arrow keys only move focus and Enter/Space navigates.
- Shown on home/overview, home/today and plan/calendar.
- On phone the control is full width with equal segments and no badge.
- Known: the Radix triggers point `aria-controls` at panels that aren't rendered (the tabs navigate rather than switch panels).
- The default landing stays home/today until D2 ships a real Dashboard.

## Phone
- Floating pill: left/right 12px, radius pill, e3 shadow, blur.
- A 56px gradient Capture button sits centred across the primaries plus More, in one flat keyed list.
- With Capture shown, the bar holds the first three preferred shortcuts (2 | + | 2). The fourth stays reachable in More. Preferences themselves are unchanged.
- The destination scroll owner gets bottom padding of `104px + safe-area` so the pill never covers content.

## Deferred
- Header layout with the tabs inline in the title row (v2.1 Main): D2.
- Dark-mode active-item contrast and the legacy green search-input surface on Tasks (dark): D6 / the Tasks rebuild.
- Lowering legacy-green baselines: as screens are rebuilt.
