# Personal Calendar Phase 4 Total Product Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a coherent, responsive personal planning product that preserves every current capability and record while adding interruption recovery, Outcome/Direction semantics, and a project-level Roadmap through incremental, testable vertical slices.

**Architecture:** Keep `AuthenticatedPlanner`, the owned workspace, the tRPC service boundary, and the account-scoped offline task queue stable. Turn `Home.tsx` into a small coordinator by extracting a compatibility-aware shell and lazy destination workspaces, then build each screen from pure projections over the existing snapshot rather than duplicating planner records. Add only reviewed, nullable columns and new history tables; all multi-record recovery changes remain online-only and transactional until a separately reviewed compound offline protocol exists.

**Tech Stack:** React 19, TypeScript 5.9, Wouter, TanStack Query/tRPC, Drizzle ORM/PostgreSQL, IndexedDB task-operation queue, Vitest/PGlite, Vite/esbuild, Python Playwright verification, CSS semantic tokens, existing Radix primitives, Onest, and IBM Plex Mono.

**Spec:** `docs/superpowers/specs/2026-09-14-phase4-total-product-redesign.md`

## Global Constraints

- Work only on `dev/personal-calendar-workbench`. Never merge it into `main` or promote Production without a new explicit instruction.
- Treat `docs/INDEPENDENT_STACK_HANDOFF.md` as live operational truth. Phases 1–3 are engineering/deployment verified; physical-iPhone evidence is separate.
- Existing planner data is real. Preserve every record ID, workspace ID, version, relationship, timestamp, history row, recurrence identity, sync receipt/conflict, and offline operation.
- Never reset a database, replay `supabase/migrations/0000_loving_madrox.sql` over populated tables, run `db:push`, bulk-infer goal kinds, or restore a backup over newer writes.
- Complete the three functional visual prototype variants and record the owner's selection before broad production-shell styling.
- Keep `Due by`, `Plan for`, `Reserved time`, daily commitment, recurrence occurrence, and actual focus as separate facts in types, labels, selectors, mutations, and tests.
- Preserve `/`, `/calendar`, every current `surface` value, `q`, task query/filter parameters, `create=task`, PWA shortcut parameters, Back/Forward state, saved views, and legacy phone pins/order.
- Preserve the exact R20 Task lane surfaces in Variant A and until a recorded prototype decision says otherwise: To do `#2a405d → #15283f`, Doing `#155b59 → #0b393b`, Done `#1d4b3d → #102f27`.
- Keep supported task capture/updates offline and idempotent. Keep recovery, goal, project, habit, focus, review, settings, notification, and other compound writes visibly online-only unless their queue semantics are separately designed and approved.
- Apple Calendar support remains the outgoing private read-only `webcal://` subscription. Do not imply incoming Apple appointments or two-way sync.
- Private file storage remains deferred. Preserve its UI/data boundary without applying `0002_private_planner_files.sql` or claiming storage is live.
- Notifications are the last Phase 4 functional slice. Subscription, scheduler, and synthetic browser success do not prove physical-iPhone delivery.
- Meet WCAG 2.2 AA behavior, minimum 44px phone hit regions in both densities, safe-area and visual-viewport behavior, reduced motion, 200% text scaling, semantic landmarks, visible focus, focus restoration, and non-drag alternatives.
- Validate 320px, 390px, phone landscape, 768px, and 1440px. Record physical-iPhone checks separately from synthetic evidence.
- Do not add a new UI/state dependency. Use current Radix, Wouter, tRPC, CSS, and browser APIs.
- Use direct checked-in executables because the repository pnpm launcher may fail registry verification: `./node_modules/.bin/vitest`, `./node_modules/.bin/tsc`, `./node_modules/.bin/vite`, `./node_modules/.bin/esbuild`, and `./node_modules/.bin/drizzle-kit` (use `.cmd` on Windows). Vitest/esbuild may require managed permission to spawn local workers.
- Every slice updates `docs/PHASE4_SLICE_EVIDENCE.md` with moved capabilities, mutations, compatibility, state coverage, phone/desktop evidence, remaining physical-device checks, and rollback notes.
- Every task uses a red/green test cycle and one focused commit. Do not combine multiple slices into one giant rewrite.

---

## File and responsibility map

### New shared contracts

- `shared/phase4Prototype.ts`: fixed mixed-life fixture and prototype-only interaction state.
- `shared/phase4Navigation.ts`: six-destination IA, legacy URL aliases, canonical location types, and global action definitions.
- `shared/phase4Preferences.ts`: versioned device-local navigation, density, rail, and Overview preference migration.
- `shared/todayProjection.ts`: one-record Today projection, timeline/flexible/due/recovery partitions, and honest capacity inputs.
- `shared/recovery.ts`: Strict action validation and daily-plan projection rules.
- `shared/goalIntentions.ts`: null-safe Outcome/Direction presentation and conversion consequences.
- `shared/roadmap.ts`: project/milestone bars, undated groups, dependency/risk flags, and date-change previews.
- `shared/overview.ts`: bounded module ordering, empty states, sources, and drill-through locations.

### New client boundaries

- `client/src/features/phase4-prototypes/*`: isolated functional A/B/C comparison; no production planner writes.
- `client/src/features/shell/*`: stable shell, rail/phone navigation, route state, global actions, sheets, and device preferences.
- `client/src/features/today/*`: Today and Overview workspaces built from shared projections.
- `client/src/features/tasks/*`: canonical task row/detail, Inbox/List/Board/saved-view workspace, capture, and search result deep links.
- `client/src/features/recovery/*`: resumable recovery indicator and decision flow.
- `client/src/features/goals/*`: Projects & Goals index, Outcome/Direction detail, project views, and Roadmap.
- Existing `calendar`, `planning`, `habits`, `focus`, `review`, `insights`, and `integrations` workspaces remain in place and are upgraded slice-by-slice.

### Existing coordinators and persistence

- `client/src/pages/Home.tsx`: shrink incrementally to data/sync orchestration and lazy destination composition.
- `client/src/App.tsx`: keep one authenticated boundary; add lazy prototype and canonical routes without auth remounts.
- `client/src/index.css`: retain only global reset/current compatibility rules; import focused feature styles.
- `drizzle/schema.ts`: workspace accountability level, nullable goal/project metadata, and new commitment-resolution/project-dependency tables.
- `supabase/migrations/0004_phase4_product_model.sql`: additive DDL only.
- `server/planning.ts`: version-safe goal/project edits, snapshot additions, and recovery transaction.
- `server/routers/planner.ts`: validated owned-workspace contracts for new operations.
- `scripts/apply-phase4-product-migration.mjs`: guarded, approval-only live migration controller.

## Verification command convention

PowerShell examples below use Windows shims. On another platform remove `.cmd` and change path separators.

```powershell
.\node_modules\.bin\vitest.cmd run server\one-focused-file.test.ts
.\node_modules\.bin\tsc.cmd --noEmit
.\node_modules\.bin\vite.cmd build
node scripts\build-pwa.mjs
.\node_modules\.bin\esbuild.cmd server\_core\vercelApp.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/server/planner-app.mjs
```

Expected global result: commands exit `0`; the full suite has no new skips; the known Vite large-chunk warning is recorded rather than mistaken for failure. If a command is blocked from spawning a checked-in worker, request managed spawn permission and rerun the exact command—do not fall back to a package-manager version switch.

---

### Task 1: Freeze the Phase 4 baseline and traceability record

**Files:**
- Create: `docs/PHASE4_SLICE_EVIDENCE.md`
- Modify: `docs/PHASE4_CAPABILITY_LEDGER.md`
- Test: existing 64 Vitest files plus build/PWA output

**Interfaces:**
- Consumes: the 2026-09-14 spec, capability ledger, current handoff, and current branch.
- Produces: a per-slice evidence template and an old-entry → new-entry traceability table used at every later gate.

- [ ] **Step 1: Verify the immutable starting point**

Run:

```powershell
git branch --show-current
git status --short
.\node_modules\.bin\tsc.cmd --noEmit
.\node_modules\.bin\vitest.cmd run
.\node_modules\.bin\vite.cmd build
node scripts\build-pwa.mjs
```

Expected: branch is `dev/personal-calendar-workbench`; TypeScript/build pass; 64 test files, 274 passing tests, and 3 existing environment skips remain the starting reference unless intervening user work is explicitly recorded; the main bundle baseline is approximately 1,299.28 kB / 371.09 kB gzip.

- [ ] **Step 2: Write the slice-evidence document**

Start it with this exact table:

```markdown
| Slice | Capabilities moved | Data mutations | URL/preference compatibility | Loading/empty/error/offline/conflict/large-data | 320/390/landscape/768/1440 evidence | Physical device remaining | Rollback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Baseline | None | None | Current routes and preferences inventoried | Existing behavior | Existing synthetic evidence only | iPhone offline/relaunch and delivery | Return to baseline commit; preserve all data and caches |
```

Append a route/action inventory covering Today, Capture, Search, Plan, Tasks, Calendar, Goals, Projects, Habits, Focus, Connections, Insights, Review, Settings, Categories/Recycle Bin, sync review, and sign-out. Each row names the new destination/view and whether behavior is unchanged, improved, or additive.

- [ ] **Step 3: Add ledger links to Tasks 2–23 of this plan**

For every capability family, add an `Implementation task(s)` column. Do not change the capability statement itself.

- [ ] **Step 4: Re-run the documentation safety scan**

Run:

```powershell
rg -n "reset database|db:push|incoming Apple|two-way|automatic rollover" docs\PHASE4_SLICE_EVIDENCE.md docs\PHASE4_CAPABILITY_LEDGER.md
```

Expected: only explicit prohibitions or accurately scoped legacy descriptions match.

- [ ] **Step 5: Commit**

```powershell
git add docs/PHASE4_SLICE_EVIDENCE.md docs/PHASE4_CAPABILITY_LEDGER.md
git commit -m "docs: freeze phase4 capability traceability"
```

**Rollback/data safety:** documentation only; never “correct” baseline counts by changing data.

---

### Task 2: Build the shared functional prototype fixture

**Files:**
- Create: `shared/phase4Prototype.ts`
- Create: `server/phase4Prototype.test.ts`

**Interfaces:**
- Produces: `phase4PrototypeVariants`, `phase4PrototypeFixture`, `createPrototypeState()`, and `reducePrototypeState(state, action)`.
- Consumes: no planner API and no live snapshot.

- [ ] **Step 1: Write the failing fixture/interaction test**

```ts
import { describe, expect, it } from "vitest";
import { createPrototypeState, phase4PrototypeFixture, phase4PrototypeVariants, reducePrototypeState } from "@shared/phase4Prototype";

describe("Phase 4 prototype parity", () => {
  it("uses identical mixed-life records in all three variants", () => {
    expect(phase4PrototypeVariants.map(item => item.id)).toEqual(["a", "b", "c"]);
    expect(phase4PrototypeFixture.tasks.map(task => task.id)).toEqual([
      "reply-samira", "read-lease", "buy-groceries", "prepare-dinner", "goal-next-action",
    ]);
    expect(phase4PrototypeFixture.appointments).toHaveLength(2);
    expect(phase4PrototypeFixture.directions[0].progressValue).toBeUndefined();
  });

  it("previews recovery and roadmap changes without mutating fixture records", () => {
    const initial = createPrototypeState();
    const recovering = reducePrototypeState(initial, { type: "open-recovery", commitmentId: "commitment-reply" });
    const preview = reducePrototypeState(recovering, { type: "preview-roadmap-move", projectId: "project-quarterly", startLocalDate: "2026-10-01", dueLocalDate: "2026-12-15" });
    expect(preview.roadmapPreview?.unchangedFields).toContain("goal.dueLocalDate");
    expect(initial.roadmapPreview).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and see the missing-module failure**

Run: `.\node_modules\.bin\vitest.cmd run server\phase4Prototype.test.ts`

Expected: FAIL because `@shared/phase4Prototype` does not exist.

- [ ] **Step 3: Implement the immutable fixture and reducer**

Export this public shape:

```ts
export const phase4PrototypeVariants = [
  { id: "a", name: "Verdigris Workbench" },
  { id: "b", name: "Quiet Agenda" },
  { id: "c", name: "Night Instrument" },
] as const;

export type PrototypeState = {
  view: "today" | "tasks" | "roadmap" | "settings";
  completedTaskIds: readonly string[];
  recoveryCommitmentId: string | null;
  sheet: "task" | "capture" | "settings" | null;
  roadmapPreview: null | { projectId: string; startLocalDate: string; dueLocalDate: string; unchangedFields: readonly string[] };
};
```

The fixture must include the ordinary mixed day, interrupted afternoon, low-capacity state, ten-day return, waiting-for reply, goal missing a next action, continuing health Direction, roadmap dependency, recurring boundary, supported offline task state, unsupported offline goal state, long titles, archive state, and conflict state from the research scenarios.

- [ ] **Step 4: Run the focused test**

Expected: 2 tests PASS and the source fixture remains deeply frozen in development.

- [ ] **Step 5: Commit**

```powershell
git add shared/phase4Prototype.ts server/phase4Prototype.test.ts
git commit -m "test: define shared phase4 prototype scenario"
```

**Rollback/data safety:** fixture IDs are synthetic and must never be passed to tRPC, IndexedDB, or planner mutations.

---

### Task 3: Implement all three functional visual prototype variants

**Files:**
- Create: `client/src/pages/Phase4Prototypes.tsx`
- Create: `client/src/features/phase4-prototypes/PrototypeShell.tsx`
- Create: `client/src/features/phase4-prototypes/PrototypeToday.tsx`
- Create: `client/src/features/phase4-prototypes/PrototypeTasks.tsx`
- Create: `client/src/features/phase4-prototypes/PrototypeRoadmap.tsx`
- Create: `client/src/features/phase4-prototypes/PrototypeSettings.tsx`
- Create: `client/src/features/phase4-prototypes/phase4-prototypes.css`
- Modify: `client/src/App.tsx`
- Create: `server/phase4PrototypeRoute.test.ts`

**Interfaces:**
- Consumes: Task 2 fixture/reducer.
- Produces: authenticated `/phase4-prototypes?variant=a|b|c&viewport=phone|desktop` comparison route with identical content and interactions.

- [ ] **Step 1: Write the route/source contract test**

The test reads `App.tsx` and the prototype CSS and asserts a lazy `/phase4-prototypes` route, `data-prototype-variant`, all three variant selectors, exact Variant A lane colors, and distinct Variant C dark tokens.

```ts
expect(appSource).toContain('path={"/phase4-prototypes"}');
expect(cssSource).toContain('[data-prototype-variant="a"]');
expect(cssSource).toContain("--prototype-todo:#2a405d");
expect(cssSource).toContain('[data-prototype-variant="c"]');
```

- [ ] **Step 2: Run it and verify failure**

Run: `.\node_modules\.bin\vitest.cmd run server\phase4Prototype.test.ts server\phase4PrototypeRoute.test.ts`

Expected: fixture tests pass and route contract fails.

- [ ] **Step 3: Add the lazy authenticated prototype route**

In `App.tsx`, keep `AuthenticatedPlanner` outside the router and lazy-load only the prototype page:

```tsx
const Phase4Prototypes = lazy(() => import("./pages/Phase4Prototypes"));
<Route path={"/phase4-prototypes"}>
  <Suspense fallback={<main role="status">Opening design prototypes…</main>}>
    <Phase4Prototypes />
  </Suspense>
</Route>
```

- [ ] **Step 4: Implement functional parity**

Each variant must support view switching, complete/reopen, open/close Capture, inspect task detail, open/resume Recovery, choose a Strict decision without saving, preview/cancel a Roadmap move, switch comfortable/compact density, reveal sync conflict/error/loading/disabled samples, and reach sign-out placement without calling the account action. Render a persistent “Prototype data—nothing here is saved” notice.

- [ ] **Step 5: Implement visual differentiation**

- A: warm off-white, charcoal, verdigris, exact dark R20 task lanes.
- B: paper surfaces, restrained dividers, typographic hierarchy, state on rows/headers rather than large panels.
- C: coherent dark shell, warm light text, restrained verdigris/cyan, legible task lanes/timeline.

Keep layout, copy, fixture order, and interaction selectors identical across variants. Density changes spacing only; all targets remain at least 44px.

- [ ] **Step 6: Run focused tests and TypeScript**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run server\phase4Prototype.test.ts server\phase4PrototypeRoute.test.ts
.\node_modules\.bin\tsc.cmd --noEmit
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add client/src/App.tsx client/src/pages/Phase4Prototypes.tsx client/src/features/phase4-prototypes shared/phase4Prototype.ts server/phase4PrototypeRoute.test.ts
git commit -m "feat: add functional phase4 visual prototypes"
```

**Rollback/data safety:** removing the prototype route removes the entire slice. The prototype imports no `trpc`, offline store, or account mutation.

---

### Task 4: Validate prototypes and record the visual selection gate

**Files:**
- Create: `scripts/preview-phase4-prototypes.py`
- Create: `docs/PHASE4_VISUAL_SELECTION.md`
- Modify: `docs/PHASE4_SLICE_EVIDENCE.md`

**Interfaces:**
- Consumes: `/phase4-prototypes` and stable `data-testid` hooks.
- Produces: screenshots/results outside Git plus an owner-approved variant and permitted refinements.

- [ ] **Step 1: Write the browser scenario before accepting visuals**

For each variant at 390×844 and 1440×1000, the script must open Today, Tasks, Roadmap, Settings; complete/reopen the same task; open/close Capture and task detail; open Recovery and select Reduce; preview/cancel a Roadmap change; exercise density; assert zero horizontal page overflow, final settings actions in viewport, dialog focus restoration, and no unexpected console/runtime errors.

- [ ] **Step 2: Run the production-like prototype check**

Start the no-watch app on a dedicated port, then run:

```powershell
python scripts\preview-phase4-prototypes.py --url http://127.0.0.1:14774 --output "$env:TEMP\personal-calendar-phase4-prototypes"
```

Expected: 6 core scenarios PASS, screenshots and JSON remain outside Git, and every variant uses the same fixture checksum.

- [ ] **Step 3: Inspect the screenshots and contrast measurements**

Record measured text/control contrast, 320px stress results, phone landscape, 768px, light/dark state samples, and any selected refinements in `docs/PHASE4_VISUAL_SELECTION.md`.

- [ ] **Step 4: Stop for owner selection**

Do not start Task 5 until the owner records Variant A, B, or C plus any accepted lane treatment, density, and motion refinements. The document must say that the choice authorizes production styling only; it does not authorize a schema migration, deployment, or feature removal.

- [ ] **Step 5: Commit the evidence after selection**

```powershell
git add scripts/preview-phase4-prototypes.py docs/PHASE4_VISUAL_SELECTION.md docs/PHASE4_SLICE_EVIDENCE.md
git commit -m "docs: record phase4 visual prototype decision"
```

**Rollback/data safety:** screenshots are disposable external artifacts; the recorded fixture checksum makes visual comparisons reproducible.

---

### Task 5: Establish selected semantic tokens and accessible sheet primitives

**Files:**
- Create: `client/src/features/shell/phase4-tokens.css`
- Create: `client/src/features/shell/PlannerSheet.tsx`
- Create: `client/src/features/shell/planner-sheet.css`
- Modify: `client/src/index.css`
- Modify: `client/src/App.tsx`
- Modify: `client/src/contexts/ThemeContext.tsx`
- Create: `server/phase4DesignFoundation.test.ts`

**Interfaces:**
- Produces: semantic CSS tokens and `PlannerSheet({ open, title, description, onOpenChange, returnFocusRef, children, footer })`.
- Consumes: the selected variant record from Task 4.

- [ ] **Step 1: Write the failing token/primitives contract test**

Assert definitions for `--surface`, `--surface-elevated`, `--ink`, `--ink-muted`, `--border`, `--accent`, `--selection`, `--completion`, `--warning`, `--destructive`, and `--focus-ring`; body 16px; functional secondary copy 14px; reduced-motion rules; sheet portal/focus behavior; explicit `light | dark | system` selection; and no color token named after a task state.

- [ ] **Step 2: Run the focused test and see missing-file failures**

Run: `.\node_modules\.bin\vitest.cmd run server\phase4DesignFoundation.test.ts`

Expected: FAIL because the semantic-token stylesheet, sheet primitive, and switchable theme contract do not exist.

- [ ] **Step 3: Implement tokens and enable three-state theme choice**

Set `<ThemeProvider defaultTheme="system" switchable>` in `App.tsx`. Extend `ThemeContextType` with `setTheme(theme: "light" | "dark" | "system")` while retaining `toggleTheme` compatibility. Map the recorded selection to light and dark semantic tokens; keep category and task-state colors separate from brand accent. Import the new CSS once from `index.css` and do not append another competing `:root` override block.

- [ ] **Step 4: Implement the full-viewport sheet**

Use the existing Radix Dialog portal. The header is fixed within the sheet, the body scrolls independently, footer actions include `padding-bottom: env(safe-area-inset-bottom)`, Escape/scrim/Close work, initial focus is explicit, and focus returns to `returnFocusRef`.

- [ ] **Step 5: Run focused test, TypeScript, and prototype regression**

Expected: all pass; prototype A/B/C CSS remains isolated under `data-prototype-variant`.

- [ ] **Step 6: Commit**

```powershell
git add client/src/features/shell client/src/index.css client/src/App.tsx client/src/contexts/ThemeContext.tsx server/phase4DesignFoundation.test.ts
git commit -m "feat: establish phase4 design foundation"
```

**Rollback/data safety:** tokens and sheet primitives do not change planner data. Revert the imports and ThemeProvider flag together to restore the old presentation.

---

### Task 6: Add canonical route and device-preference compatibility

**Files:**
- Create: `shared/phase4Navigation.ts`
- Create: `shared/phase4Preferences.ts`
- Create: `client/src/lib/plannerLocation.ts`
- Create: `client/src/features/shell/usePlannerPreferences.ts`
- Create: `server/phase4Navigation.test.ts`
- Modify: `server/mobileNavigation.test.ts`

**Interfaces:**
- Produces: `parsePlannerLocation(url)`, `writePlannerLocation(currentUrl, next)`, `migratePhase4Preferences(raw)`, and `phase4Destinations`.
- Consumes: every legacy `surface` ID and `personal-calander:mobile-preferences:${workspaceId}`.

- [ ] **Step 1: Write failing compatibility fixtures**

```ts
expect(parsePlannerLocation(new URL("https://app.test/?surface=today&x=1"))).toMatchObject({ destination: "home", view: "today" });
expect(parsePlannerLocation(new URL("https://app.test/calendar?q=rent"))).toMatchObject({ destination: "plan", view: "calendar", query: "rent" });
expect(parsePlannerLocation(new URL("https://app.test/?surface=capture"))).toMatchObject({ destination: "tasks", view: "inbox", action: "capture" });
expect(writePlannerLocation(new URL("https://app.test/?unknown=keep"), { destination: "review", view: "insights" }).searchParams.get("unknown")).toBe("keep");
```

Add preference fixtures proving calendar, habits, focus, and all other legacy pins survive; the current `mobilePlannerDestinations` list remains an accepted legacy alias catalog; raw v0 JSON is copied to the rollback key before a v1 value is written; current `personal-calander:rail-collapsed` remains readable; only exact `{destination, view}` duplicates collapse.

- [ ] **Step 2: Run and confirm missing-contract failure**

Run: `.\node_modules\.bin\vitest.cmd run server\phase4Navigation.test.ts server\mobileNavigation.test.ts`

Expected: the existing mobile test passes and the new six-destination/legacy-alias fixtures fail.

- [ ] **Step 3: Implement the six destinations and global actions**

```ts
export const phase4Destinations = [
  { id: "home", label: "Home", views: ["today", "overview"] },
  { id: "tasks", label: "Tasks", views: ["inbox", "list", "board", "saved", "archive"] },
  { id: "plan", label: "Plan", views: ["daily", "weekly", "calendar", "roadmap"] },
  { id: "intentions", label: "Projects & Goals", views: ["projects", "outcomes", "directions"] },
  { id: "habits", label: "Habits", views: ["due", "history"] },
  { id: "review", label: "Review", views: ["rituals", "insights", "history"] },
] as const;
export const globalPlannerActions = ["capture", "search", "focus"] as const;
```

Settings is an account utility, not a seventh primary destination. Phone defaults are Home, Tasks, Plan, Projects & Goals, More; customization can pin any destination/view or global Focus alias.

- [ ] **Step 4: Implement History/PopState integration**

`writePlannerLocation` uses `pushState` for user navigation and `replaceState` only to consume owned one-shot parameters. `usePlannerPreferences` writes the new version after backing up the legacy string; malformed values fall back without deleting them. Keep exporting/accepting the 14 old destination IDs as shortcut aliases while production navigation renders the six new groups.

- [ ] **Step 5: Run tests and TypeScript**

Expected: all alias, unknown-parameter, Back/Forward, query/filter, and preference fixtures pass.

- [ ] **Step 6: Commit**

```powershell
git add shared/phase4Navigation.ts shared/phase4Preferences.ts client/src/lib/plannerLocation.ts client/src/features/shell/usePlannerPreferences.ts server/phase4Navigation.test.ts server/mobileNavigation.test.ts
git commit -m "feat: preserve planner navigation compatibility"
```

**Rollback/data safety:** the original preference string remains at `personal-calander:mobile-preferences:${workspaceId}:phase4-backup`; rollback reads it without destroying v1.

---

### Task 7: Extract the stable shell and route-matched loading boundary

**Files:**
- Create: `client/src/features/shell/PlannerShell.tsx`
- Create: `client/src/features/shell/PlannerRail.tsx`
- Create: `client/src/features/shell/PhoneNavigation.tsx`
- Create: `client/src/features/shell/GlobalActions.tsx`
- Create: `client/src/features/shell/DestinationBoundary.tsx`
- Create: `client/src/features/shell/planner-shell.css`
- Create: `scripts/preview-phase4-product.py`
- Modify: `client/src/pages/Home.tsx`
- Modify: `client/src/App.tsx`
- Create: `server/phase4Shell.test.ts`

**Interfaces:**
- Produces: `PlannerShell({ location, onNavigate, syncStatus, children })` and stable lazy destination slots.
- Consumes: Task 5 tokens/sheet and Task 6 location/preferences.

- [ ] **Step 1: Write the failing source/browser contract**

Assert exactly one `AuthenticatedPlanner` in `App.tsx`, Home defaults to Today, desktop rail and content have independent scroll owners, phone has five visible controls including More, Capture/Search/Focus are global actions, and ordinary destination changes do not use `window.location.assign`.

- [ ] **Step 2: Run it and confirm the current 14-item shell fails**

Run: `.\node_modules\.bin\vitest.cmd run server\phase4Shell.test.ts server\authenticatedPlanner.test.ts server\mobileNavigation.test.ts`

Expected: auth/mobile baseline tests pass; shell test fails on the current 14-item rail and location-replacing navigation.

- [ ] **Step 3: Extract without moving data logic**

Move only rail/topbar/phone More/settings entry and destination loading JSX. Keep snapshot query, pending-operation overlay, conflict review, task/habit mutations, and all current workspaces in `Home.tsx` for this commit.

- [ ] **Step 4: Add route-matched loading and scoped read errors**

The authenticated shell remains mounted. `DestinationBoundary` shows the requested destination skeleton; a destination query error retains confirmed snapshot content and offers a scoped retry. Account/workspace failures remain owned by `AuthenticatedPlanner`.

- [ ] **Step 5: Add the incremental production browser harness**

Create `scripts/preview-phase4-product.py` with `--scenario`, `--widths`, `--url`, and `--output` arguments. Its initial `shell-navigation` scenario intercepts authenticated planner APIs, fixes the local date, disables remote traffic/service-worker interception, and reports runtime errors, console errors, current location, focus owner, and horizontal overflow. Later slices add named scenarios to this same harness.

- [ ] **Step 6: Run regression checks**

```powershell
.\node_modules\.bin\vitest.cmd run server\phase4Shell.test.ts server\authenticatedPlanner.test.ts server\taskBoardUrl.test.ts server\pwaEntry.test.ts
.\node_modules\.bin\tsc.cmd --noEmit
python scripts\preview-phase4-product.py --url http://127.0.0.1:14775 --scenario shell-navigation --widths 390,1440
```

Expected: automated checks pass; shell navigation preserves auth/snapshot context, Back/Forward restores the prior destination, and both widths have zero unexpected errors/overflow.

- [ ] **Step 7: Commit**

```powershell
git add client/src/features/shell client/src/pages/Home.tsx client/src/App.tsx server/phase4Shell.test.ts scripts/preview-phase4-product.py
git commit -m "refactor: extract stable phase4 planner shell"
```

**Rollback/data safety:** presentation-only extraction. If route continuity regresses, revert the shell commit; do not clear localStorage, IndexedDB, service-worker caches, or query caches as a repair.

---

### Task 8: Author and locally prove the additive Phase 4 schema migration

**Files:**
- Modify: `drizzle/schema.ts`
- Create: `supabase/migrations/0004_phase4_product_model.sql`
- Create: `supabase/migrations/meta/0004_snapshot.json`
- Modify: `supabase/migrations/meta/_journal.json`
- Create: `server/phase4ProductMigration.test.ts`

**Interfaces:**
- Produces: workspace accountability level, nullable goal intention metadata, project review/risk metadata, `commitmentResolutions`, and `projectDependencies`.
- Consumes: existing IDs, versions, daily-plan states, task occurrences, and project/task relations unchanged.

- [ ] **Step 1: Write the failing PGlite migration safety test**

Apply the baseline to an isolated database, insert existing goal/project/task/daily-plan records with fixed IDs and timestamps, apply `0004`, and assert:

```ts
expect(existingGoal).toMatchObject({ id: "goal-preserved", progressMode: "measure", progressValue: 42 });
expect(existingGoal.intentionKind).toBeNull();
expect(existingWorkspace.accountabilityLevel).toBe("structured");
expect(existingProject.riskLevel).toBe("none");
expect(await count("commitmentResolutions")).toBe(0);
expect(await count("projectDependencies")).toBe(0);
```

Also assert RLS on both new tables, unique `(workspaceId, operationId)`, unique `(projectId, dependsOnProjectId)`, nullable legacy compatibility, and no `DROP`, `TRUNCATE`, `DELETE`, or update/backfill statement in the migration.

- [ ] **Step 2: Run and verify failure before schema authoring**

Run: `.\node_modules\.bin\vitest.cmd run server\phase4ProductMigration.test.ts`

Expected: FAIL because `0004_phase4_product_model.sql` and its schema fields/tables do not exist.

- [ ] **Step 3: Add exact additive fields**

Add to `workspaces`: `accountabilityLevel: "gentle" | "structured" | "strict"` defaulting to `structured`. This is a workspace/domain choice, not a device-layout preference.

Add to `goals`: nullable `intentionKind: "outcome" | "direction"`, `successCriteria`, `standards`, nullable `reviewCadence: "weekly" | "monthly" | "quarterly" | "yearly"`, and `nextReviewLocalDate`.

Add to `projects`: `riskLevel: "none" | "watch" | "at_risk" | "blocked"` defaulting to `none`, nullable `riskNote`, and nullable `nextReviewLocalDate`.

Define:

```ts
export const commitmentResolutions = pgTable("commitmentResolutions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
  operationId: varchar("operationId", { length: 128 }).notNull(),
  dailyPlanItemId: varchar("dailyPlanItemId", { length: 64 }).notNull(),
  taskId: varchar("taskId", { length: 64 }).notNull(),
  occurrenceId: varchar("occurrenceId", { length: 64 }),
  action: enumText("action", ["done", "reschedule", "reduce", "pause", "abandon"]).notNull(),
  originalScope: text("originalScope").notNull(),
  revisedScope: text("revisedScope"),
  resolvedToLocalDate: varchar("resolvedToLocalDate", { length: 10 }),
  returnLocalDate: varchar("returnLocalDate", { length: 10 }),
  decisionNote: text("decisionNote"),
  timezone: varchar("timezone", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  version: integer("version").notNull().default(1),
}, table => [
  uniqueIndex("commitment_resolutions_workspace_operation_unique").on(table.workspaceId, table.operationId),
  index("commitment_resolutions_workspace_item_idx").on(table.workspaceId, table.dailyPlanItemId),
]);
```

Define `projectDependencies` with `id`, `workspaceId`, `projectId`, `dependsOnProjectId`, `dependencyType: "hard" | "soft"`, `createdAt`, `updatedAt`, and `version`; prohibit self-links in service validation rather than rewriting task dependencies.

- [ ] **Step 4: Generate the named migration offline and inspect it**

With the existing ignored local `SUPABASE_DB_URL` available only so Drizzle config loads:

```powershell
.\node_modules\.bin\drizzle-kit.cmd generate --name phase4_product_model
```

Expected: exactly `0004_phase4_product_model.sql`, `meta/0004_snapshot.json`, and one journal entry change. Do **not** run `drizzle-kit migrate`, `db:migrate`, or `db:push`.

- [ ] **Step 5: Run migration, schema, and full type tests**

```powershell
.\node_modules\.bin\vitest.cmd run server\phase4ProductMigration.test.ts server\sync.migration.test.ts server\independentOwnership.test.ts
.\node_modules\.bin\tsc.cmd --noEmit
```

Expected: PASS; preserved rows compare exactly; no existing row receives an inferred intention kind.

- [ ] **Step 6: Commit authoring only**

```powershell
git add drizzle/schema.ts supabase/migrations/0004_phase4_product_model.sql supabase/migrations/meta/0004_snapshot.json supabase/migrations/meta/_journal.json server/phase4ProductMigration.test.ts
git commit -m "feat: author additive phase4 product schema"
```

**Rollback/data safety:** authoring and isolated PGlite execution are authorized; live application is not. After eventual live application, rollback keeps additive columns/tables in place and rolls application traffic back to a compatible deployment—never drop history tables to roll back UI.

---

### Task 9: Prepare the guarded migration controller and stop for live approval

**Files:**
- Create: `scripts/apply-phase4-product-migration.mjs`
- Create: `scripts/phase4-product-migration.test.ts`
- Modify: `docs/PHASE4_SLICE_EVIDENCE.md`

**Interfaces:**
- Produces: a controller with read-only default and explicit `--apply` mode.
- Consumes: exact SHA-256 of `0004_phase4_product_model.sql`, exact project identity, fresh aggregate counts, and a verified backup reference supplied outside Git.

- [ ] **Step 1: Write the guard tests first**

Test refusal for missing `--apply`, wrong SQL hash, wrong project, missing preflight inventory, destructive SQL, an existing incompatible column/table shape, and any unexplained count/ID delta. Test that output never contains a connection string or secret.

- [ ] **Step 2: Run and verify missing-controller failure**

Run: `.\node_modules\.bin\vitest.cmd run scripts\phase4-product-migration.test.ts`

Expected: FAIL because the guarded controller does not exist.

- [ ] **Step 3: Implement read-only preflight and transactional apply**

Default mode prints only project fingerprint, schema compatibility booleans, migration hash, aggregate counts, and readiness. `--apply` must lock the migration scope, re-check the same facts, execute exactly the reviewed SQL in one transaction, compare `users`, `workspaces`, `tasks`, `goals`, `projects`, `habits`, `dailyPlans`, `dailyPlanItems`, and `taskOccurrences`, and roll back on any mismatch.

- [ ] **Step 4: Run controller unit tests and the read-only mode only**

Expected: tests pass; the live target is not mutated.

- [ ] **Step 5: Stop for explicit approval before external actions**

Present the migration hash, fresh read-only audit, recoverable backup/restore-test evidence, exact target project, before counts, compatibility result, and rollback routing plan. Do not execute `--apply`, deploy code that selects the new columns, or change Vercel configuration until the owner explicitly approves this exact migration operation.

- [ ] **Step 6: After approval, apply and record postflight**

Run only the reviewed controller command with local ignored credentials, then record before/after counts, unchanged IDs, new table RLS, and zero inferred kinds. Any discrepancy stops deployment and leaves traffic on the prior compatible build.

- [ ] **Step 7: Commit controller/evidence; never commit credentials or backups**

```powershell
git add scripts/apply-phase4-product-migration.mjs scripts/phase4-product-migration.test.ts docs/PHASE4_SLICE_EVIDENCE.md
git commit -m "chore: guard phase4 additive migration"
```

**Rollback/data safety:** code rollback is routing to the last compatible deployment. Preserve additive tables, rows, operation IDs, and resolution history. Database restoration requires separate reconciliation and approval.

---

### Task 10: Define one canonical Today/task projection

**Files:**
- Create: `shared/todayProjection.ts`
- Create: `shared/canonicalTask.ts`
- Create: `server/todayProjection.test.ts`
- Create: `server/canonicalTask.test.ts`

**Interfaces:**
- Produces: `projectToday(input): TodayProjection` and `canonicalTaskPresentation(task, context)`.
- Consumes: workspace, tasks, daily plans/items, occurrences, habits/check-ins, external events, availability exceptions, and resolution rows.

- [ ] **Step 1: Write failing projection tests**

Cover a reserved committed task appearing once in `timeline` and never again in `flexible`; due-today/unplanned attention; planned/no-time flexible work; earlier unresolved recovery; due habits as habit rows; appointments as read-only source rows; collapsed completion evidence; overlapping busy intervals counted once; and unestimated tasks reported as unknown rather than zero.

```ts
expect(result.timeline.filter(item => item.recordId === "task-reserved")).toHaveLength(1);
expect(result.flexible.some(item => item.recordId === "task-reserved")).toBe(false);
expect(result.capacity).toMatchObject({ knownDemandMinutes: 150, unestimatedTaskCount: 2, isCompleteEstimate: false });
```

- [ ] **Step 2: Run and see missing-module failures**

Run: `.\node_modules\.bin\vitest.cmd run server\todayProjection.test.ts server\canonicalTask.test.ts server\planningAvailability.test.ts server\planningForecast.test.ts`

Expected: current availability/forecast tests pass; new projection modules fail to resolve.

- [ ] **Step 3: Implement pure, stable selectors**

`canonicalTaskPresentation` returns identity, title, completion state, one key time/date label, up to two relevant metadata labels, one contextual primary action, and references to all secondary fields. It never mutates or clones a task into a new entity.

- [ ] **Step 4: Run focused tests**

Run: `.\node_modules\.bin\vitest.cmd run server\todayProjection.test.ts server\canonicalTask.test.ts server\planningAvailability.test.ts server\planningForecast.test.ts`

- [ ] **Step 5: Commit**

```powershell
git add shared/todayProjection.ts shared/canonicalTask.ts server/todayProjection.test.ts server/canonicalTask.test.ts
git commit -m "feat: define canonical today projection"
```

**Rollback/data safety:** pure projections only; no schema or records change.

---

### Task 11: Extract canonical Tasks, Inbox, Capture, and Search

**Files:**
- Create: `client/src/features/tasks/CanonicalTaskRow.tsx`
- Create: `client/src/features/tasks/TaskDetailSheet.tsx`
- Create: `client/src/features/tasks/TaskWorkspace.tsx`
- Create: `client/src/features/tasks/InboxTriage.tsx`
- Create: `client/src/features/tasks/CaptureSheet.tsx`
- Create: `client/src/features/tasks/task-workspace.css`
- Modify: `client/src/features/capture/NaturalLanguageCaptureWorkspace.tsx`
- Modify: `client/src/features/search/WorkspaceSearchWorkspace.tsx`
- Modify: `client/src/pages/Home.tsx`
- Modify: `scripts/preview-phase4-product.py`
- Create: `server/phase4TaskWorkspace.test.ts`
- Modify: `client/src/lib/offlineTaskSync.test.ts`

**Interfaces:**
- Consumes: Task 10 presentation plus existing `queueTaskCreate`, `queueTaskUpdate`, replay, board lanes, saved views, and tRPC task services.
- Produces: Inbox/List/Board/saved/archive views over the same task identities and one shared detail sheet.

- [ ] **Step 1: Add failing compatibility and offline tests**

Assert the row exposes completion, title, key date/time, limited metadata, one contextual action, and detail access; the detail exposes every ledger field/action; Board still has three lanes and phone one-lane tabs; gestures remain optional with equivalent visible menus; undo can restore completion/archive; PWA `create=task` and `surface=capture` open Capture; saved local capture survives refetch/reload; unsupported goal/habit capture retains draft and says reconnect required; AI-assisted drafts remain proposals that cannot save without review.

- [ ] **Step 2: Run the task-focused red suite**

```powershell
.\node_modules\.bin\vitest.cmd run server\phase4TaskWorkspace.test.ts server\taskBoard.test.ts server\taskBoardUrl.test.ts server\taskEditor.test.ts server\taskOrdering.test.ts server\mobileTaskGesture.test.ts client\src\lib\offlineTaskSync.test.ts
```

Expected: existing domain/offline tests pass; canonical Task workspace and deep-link assertions fail before extraction.

- [ ] **Step 3: Extract the row and detail without changing mutations**

Move the current TaskRow editor, recurrence, subtask, dependency, project/goal/category, lifecycle, conflict/version, reservation, estimate, priority, horizon, schedule mode, outcome, archive/restore, and ordering controls into the new files. Keep the exact `persistTaskPatch`, `queueTaskUpdate`, and tRPC call paths; no direct client database writes.

- [ ] **Step 4: Implement Inbox and global Capture semantics**

Inbox filters active unclarified/unscheduled existing tasks; it does not create an inbox table. Default Capture saves title-only to Inbox (`scheduledLocalDate: null`), while an explicit “Plan for today” choice sets Today. Natural-language chips label Deadline, Plan for, Reserved time, estimate, recurrence, and ambiguity separately before save. Preserve task/project/daily-plan starting points and AI drafts as review-first payloads; applying either remains an explicit action.

- [ ] **Step 5: Improve Search deep links**

Change `onOpenEntity(entity)` to `onOpenEntity({ entity, id })`. Opening a result writes selected record ID without deleting query/filter state; closing detail restores focus to that result and retains `q`. Empty results show a query reset only.

- [ ] **Step 6: Run focused tests, TypeScript, and 390px board flow**

Add a `task-capture-search` scenario to the browser harness, then run:

```powershell
.\node_modules\.bin\vitest.cmd run server\phase4TaskWorkspace.test.ts server\taskBoard.test.ts server\taskBoardUrl.test.ts server\taskEditor.test.ts server\taskOrdering.test.ts server\mobileTaskGesture.test.ts client\src\lib\offlineTaskSync.test.ts
.\node_modules\.bin\tsc.cmd --noEmit
python scripts\preview-phase4-product.py --url http://127.0.0.1:14775 --scenario task-capture-search --widths 390,1440
```

Expected: pass; dark lanes remain exact until the selected visual contract says otherwise; query/filter/detail focus survives; no horizontal page overflow.

- [ ] **Step 7: Commit**

```powershell
git add client/src/features/tasks client/src/features/capture/NaturalLanguageCaptureWorkspace.tsx client/src/features/search/WorkspaceSearchWorkspace.tsx client/src/pages/Home.tsx scripts/preview-phase4-product.py server/phase4TaskWorkspace.test.ts client/src/lib/offlineTaskSync.test.ts
git commit -m "refactor: unify task capture and presentation"
```

**Rollback/data safety:** all writes continue through existing version-safe services/offline queue. Undo creates the inverse supported task update; it does not erase history or receipts.

---

### Task 12: Replace the old dashboard-like Today canvas

**Files:**
- Create: `client/src/features/today/TodayWorkspace.tsx`
- Create: `client/src/features/today/TodayTimeline.tsx`
- Create: `client/src/features/today/TodayFlexibleWork.tsx`
- Create: `client/src/features/today/TodayHabits.tsx`
- Create: `client/src/features/today/today-workspace.css`
- Modify: `client/src/pages/Home.tsx`
- Modify: `scripts/preview-phase4-product.py`
- Create: `server/phase4TodayWorkspace.test.ts`

**Interfaces:**
- Consumes: `projectToday`, canonical task rows, existing habit check-ins, existing task queue/mutations, and navigation callbacks.
- Produces: Home/Today with compact summary, contextual primary action, canonical timeline, flexible commitments, habit facts, recovery entry, and collapsed completion evidence.

- [ ] **Step 1: Write the failing source and browser contract**

Assert order: summary → recovery when present → chronological fixed/reserved context → flexible work → due habits → contextual suggestions → collapsed completed evidence. Assert a reservation is rendered once, external appointments have source/read-only labels, and no Apple appointment appears when none exists.

- [ ] **Step 2: Run the red test**

Run: `.\node_modules\.bin\vitest.cmd run server\phase4TodayWorkspace.test.ts server\todayProjection.test.ts server\canonicalTask.test.ts`

Expected: selector tests pass; workspace source/interaction assertions fail because `TodayWorkspace.tsx` is absent.

- [ ] **Step 3: Implement the workspace from the projection**

Header chooses one primary action: Resolve remaining work when recovery exists; otherwise Plan today when no active plan; otherwise Start focus when an executable task is selected; Capture remains globally available. Suggestions name their source (“From Project X”, “Due habit”, “Waiting follow-up”) and provide one explicit action.

- [ ] **Step 4: Preserve offline and conflict states**

Pending task overlays use the same record ID/client request ID across Today and Tasks. Unsupported habit/focus/recovery writes show last confirmed state and reconnect guidance rather than optimistic success.

- [ ] **Step 5: Run tests and browser widths**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run server\phase4TodayWorkspace.test.ts server\todayProjection.test.ts server\canonicalTask.test.ts server\planningForecast.test.ts server\habitSchedule.test.ts server\offlineTaskCapture.test.ts
.\node_modules\.bin\tsc.cmd --noEmit
python scripts\preview-phase4-product.py --url http://127.0.0.1:14775 --scenario today --widths 320,390,768,1440
```

Expected: tests and TypeScript pass; the browser report shows one actionable presentation per task, zero page-level horizontal overflow, and no runtime errors at all four widths.

- [ ] **Step 6: Commit**

```powershell
git add client/src/features/today client/src/pages/Home.tsx scripts/preview-phase4-product.py server/phase4TodayWorkspace.test.ts
git commit -m "feat: deliver canonical home today"
```

**Rollback/data safety:** Today is a projection. Removing it reveals the previous workspace without moving, cloning, or deleting a task.

---

### Task 13: Implement transactional Strict recovery semantics

**Files:**
- Create: `shared/recovery.ts`
- Create: `server/recovery.test.ts`
- Create: `server/planning.recovery.test.ts`
- Modify: `server/planning.ts`
- Modify: `server/routers/planner.ts`
- Modify: `server/planner.router.test.ts`

**Interfaces:**
- Produces: `validateRecoveryDecision`, `recoveryProjection`, `resolveCommitment(scope, input)`, and `planner.recovery.resolve`.
- Consumes: applied Task 8 schema, existing daily-plan/task/occurrence version semantics, and `PlannerConflictError`.

- [ ] **Step 1: Write pure validation tests**

Done requires no extra field; Reschedule requires `resolvedToLocalDate`; Reduce requires non-empty `revisedScope` plus a concrete `resolvedToLocalDate`; Pause requires `returnLocalDate`; Abandon retains the task/history and is never completion. Every input requires `operationId`, item/task expected versions, and an occurrence expected version when occurrence-bound.

- [ ] **Step 2: Write failing transaction tests**

Test owned references, duplicate operation idempotency, atomic rollback, stale task/item/occurrence conflict, due date preservation, one occurrence rather than the series, and mappings:

```ts
const dailyPlanState = { done: "done", reschedule: "rescheduled", reduce: "deferred", pause: "deferred", abandon: "wont_do" } as const;
```

Reduce stores original title/scope before updating the task to revised scope and scheduling the next commitment. Pause clears current reservation/planned day and relies on the resolution return date for resurfacing. Abandon uses the existing recoverable intentional-noncompletion/archive semantics and writes the resolution row in the same transaction.

- [ ] **Step 3: Run the red suite**

Run: `.\node_modules\.bin\vitest.cmd run server\recovery.test.ts server\planning.recovery.test.ts server\dailyPlanResolution.test.ts server\planner.router.test.ts`

Expected: existing daily-plan/router assertions pass; recovery modules/procedures fail before implementation.

- [ ] **Step 4: Implement the pure contract, transaction, and router**

Use `db.transaction(async tx => { ... })`. Re-query all records within the transaction; validate workspace and exact versions; return the existing resolution on duplicate `(workspaceId, operationId)`; write task/occurrence, daily-plan item, and immutable resolution as one unit.

- [ ] **Step 5: Keep compound recovery online-only**

The router returns a stable “Reconnect to record this decision safely” error before mutation when the UI is offline. Do not add recovery to `syncTaskOperation`; a partial task-only queue cannot claim the history row is durable.

- [ ] **Step 6: Run tests and TypeScript**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run server\recovery.test.ts server\planning.recovery.test.ts server\dailyPlanResolution.test.ts server\planner.router.test.ts
.\node_modules\.bin\tsc.cmd --noEmit
```

Expected: all pass; a forced insert failure leaves task, occurrence, and daily-plan item unchanged.

- [ ] **Step 7: Commit**

```powershell
git add shared/recovery.ts server/recovery.test.ts server/planning.recovery.test.ts server/planning.ts server/routers/planner.ts server/planner.router.test.ts
git commit -m "feat: add transactional strict recovery"
```

**Rollback/data safety:** resolution rows are historical evidence and are never deleted on rollback. Old clients continue to read unchanged daily-plan state values.

---

### Task 14: Add resumable Recovery UI and accountability preferences

**Files:**
- Create: `client/src/features/recovery/RecoveryIndicator.tsx`
- Create: `client/src/features/recovery/RecoveryFlow.tsx`
- Create: `client/src/features/recovery/recovery.css`
- Modify: `client/src/features/today/TodayWorkspace.tsx`
- Modify: `client/src/features/planning/PlanWorkspace.tsx`
- Modify: `server/planning.ts`
- Modify: `server/routers/planner.ts`
- Modify: `server/planner.router.test.ts`
- Modify: `scripts/preview-phase4-product.py`
- Create: `server/phase4RecoveryUi.test.ts`

**Interfaces:**
- Consumes: `recoveryProjection`, `planner.recovery.resolve`, and the versioned workspace accountability setting.
- Produces: closeable/resumable flow with Gentle, Structured default, and Strict presentation.

- [ ] **Step 1: Write failing interaction/source tests**

Assert Structured is the persisted workspace default, changing levels uses `workspace.update` with `expectedVersion` and never changes stored outcomes, Strict count persists but never blocks unrelated navigation, multiple references to one task remain distinct commitments, and Recovery can close/resume at the same item.

- [ ] **Step 2: Run the red test**

Run: `.\node_modules\.bin\vitest.cmd run server\phase4RecoveryUi.test.ts server\recovery.test.ts server\planner.router.test.ts`

Expected: domain/router tests pass; UI source/interaction assertions fail before the recovery components exist.

- [ ] **Step 3: Implement decision forms**

Done confirms the exact task/occurrence; Reschedule asks only Plan for (deadline shown read-only unless separately edited); Reduce asks original scope, revised scope, and next planned day; Pause asks return/review date and optional note; Abandon uses deliberate noncompletion copy and a confirmation. Disable duplicate submission and announce server-confirmed success.

- [ ] **Step 4: Implement accountability presentation**

Gentle groups recovery into Review, Structured shows relevant Today/Plan attention, Strict persists the indicator and unresolved count. Persist changes through the existing owned/version-safe workspace update and keep the control disabled with reconnect guidance offline. No modal on navigation, lockout, shame copy, or notification escalation.

- [ ] **Step 5: Run focused tests and phone sheet flow**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run server\phase4RecoveryUi.test.ts server\recovery.test.ts server\planning.recovery.test.ts server\planner.router.test.ts
.\node_modules\.bin\tsc.cmd --noEmit
python scripts\preview-phase4-product.py --url http://127.0.0.1:14775 --scenario recovery-phone
```

Expected: tests pass; final actions remain reachable with keyboard open and safe areas; closing restores focus; unsupported offline decision retains all entered values.

- [ ] **Step 6: Commit**

```powershell
git add client/src/features/recovery client/src/features/today/TodayWorkspace.tsx client/src/features/planning/PlanWorkspace.tsx server/planning.ts server/routers/planner.ts server/planner.router.test.ts server/phase4RecoveryUi.test.ts scripts/preview-phase4-product.py
git commit -m "feat: add resumable recovery flow"
```

**Rollback/data safety:** old clients ignore the additive workspace field. Changing level never rewrites outcomes; confirmed resolution history remains readable even if the new flow is rolled back.

---

### Task 15: Upgrade Plan and Calendar without collapsing date semantics

**Files:**
- Create: `shared/calendarMovePreview.ts`
- Create: `server/calendarMovePreview.test.ts`
- Modify: `client/src/features/planning/PlanWorkspace.tsx`
- Modify: `client/src/features/calendar/CalendarExecutionWorkspace.tsx`
- Modify: `client/src/pages/CalendarExecution.tsx`
- Modify: `shared/planningAvailability.ts`
- Modify: `server/planningAvailability.test.ts`
- Modify: `server/scheduling.ts`
- Modify: `server/scheduling.test.ts`
- Modify: `scripts/preview-phase4-product.py`

**Interfaces:**
- Produces: daily/weekly planning sequence and `previewCalendarMutation` for move/resize/deadline separation.
- Consumes: existing daily plans/objectives, availability, proposals, reservations, external busy context, and recovery.

- [ ] **Step 1: Write failing date/capacity/proposal tests**

Cover planned-day move without deadline change, reservation move without due change, resize without focus change, collision names, DST non-existent/repeated times, overlapping interval de-duplication, unavailable days, unknown estimates, stale proposal rejection, and explicit Apply/undo.

- [ ] **Step 2: Run the red suite**

```powershell
.\node_modules\.bin\vitest.cmd run server\calendarMovePreview.test.ts server\planningAvailability.test.ts server\taskReservation.test.ts server\scheduling.test.ts server\planning.lifecycle.test.ts
```

Expected: existing availability/reservation/scheduling tests pass; the new preview and DST assertions fail before implementation.

- [ ] **Step 3: Implement the resumable planning sequence**

Use five explicit stages: unresolved/Inbox → fixed context/availability → commitments → reservations → confirmation. Preserve draft/active/closed/archived states, ordering, intention/reflection, reopening, weekly states/evidence/ancestry, morning rollover evidence, project/daily-plan templates, and saved Calendar views with their pin/order/version/workspace scope.

- [ ] **Step 4: Implement Calendar Day/Week/Month/Quarter/Year continuity**

Keep `/calendar` as a compatible direct entry into Plan/Calendar. Constrain horizontal scrolling to timeline containers. Provide buttons/menus for every drag/resize operation and label Deadline edits separately. Preview automatic repairs; invalidate stale source versions.

- [ ] **Step 5: Run focused/full browser scenarios**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run server\calendarMovePreview.test.ts server\planningAvailability.test.ts server\taskReservation.test.ts server\scheduling.test.ts server\planning.lifecycle.test.ts server\mobileCalendarGesture.test.ts server\plannerKeyboard.test.ts
.\node_modules\.bin\tsc.cmd --noEmit
python scripts\preview-phase4-product.py --url http://127.0.0.1:14775 --scenario plan-calendar --widths 320,390,768,1440
```

Expected: tests pass; touch, keyboard, and pointer alternatives reach the same outcomes; external events remain read-only/source-labelled; an absent incoming adapter produces no appointments.

- [ ] **Step 6: Commit**

```powershell
git add shared/calendarMovePreview.ts server/calendarMovePreview.test.ts client/src/features/planning/PlanWorkspace.tsx client/src/features/calendar/CalendarExecutionWorkspace.tsx client/src/pages/CalendarExecution.tsx shared/planningAvailability.ts server/planningAvailability.test.ts server/scheduling.ts server/scheduling.test.ts scripts/preview-phase4-product.py
git commit -m "feat: strengthen recovery-aware calendar planning"
```

**Rollback/data safety:** cancel previews performs no write. Undo restores only recorded prior schedule values; it never rewrites deadlines or focus history.

---

### Task 16: Add Outcome and Direction semantics without reinterpreting legacy goals

**Files:**
- Create: `shared/goalIntentions.ts`
- Create: `server/goalIntentions.test.ts`
- Create: `server/planning.goalIntentions.test.ts`
- Modify: `server/planning.ts`
- Modify: `server/routers/planner.ts`
- Modify: `server/planner.router.test.ts`
- Create: `client/src/features/goals/ProjectsGoalsWorkspace.tsx`
- Create: `client/src/features/goals/IntentionDetail.tsx`
- Create: `client/src/features/goals/intention.css`
- Modify: `client/src/pages/Home.tsx`

**Interfaces:**
- Produces: `intentionPresentation(goal)`, `previewIntentionKindChange(goal, kind)`, `updateGoal`, and Projects & Goals destination.
- Consumes: existing goal hierarchy/progress modes/milestones/task/project/habit links.

- [ ] **Step 1: Write failing null/legacy and conversion tests**

Assert null `intentionKind` renders legacy goal behavior; no title inference; Outcome shows success criteria/progress/target/milestone/next action; Direction omits forced percentage/date but retains stored progress configuration behind details; conversion preview lists presentation consequences and does not change dates, links, progress, timestamps, or history.

- [ ] **Step 2: Write version-safe service/router tests**

Test ownership, expected version, optional dates, nullable kind, review cadence/date, and exact preservation of parent/category/task/project/habit relationships.

- [ ] **Step 3: Run red tests**

Run: `.\node_modules\.bin\vitest.cmd run server\goalIntentions.test.ts server\planning.goalIntentions.test.ts server\planner.router.test.ts server\plannerRules.test.ts`

Expected: existing progress tests pass; new intention metadata/service assertions fail before implementation.

- [ ] **Step 4: Implement pure semantics and service contract**

Add `updateGoal(scope, { id, expectedVersion, patch })`; only allow intention metadata plus existing editable goal fields. Completion remains an explicit lifecycle mutation and never follows automatically from `progressValue`.

- [ ] **Step 5: Implement destination and detail**

Index tabs are Projects, Outcome goals, Directions. Detail shows Overview plus linked work, milestones, progress definition/evidence, risks/dependencies, and next review. Standalone records and direct links remain valid; Categories never become Directions. Saved Goal/Project views continue to open with their stored configuration, pin, order, version, and workspace scope.

- [ ] **Step 6: Run focused tests and TypeScript**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run server\goalIntentions.test.ts server\planning.goalIntentions.test.ts server\planner.router.test.ts server\plannerRules.test.ts server\goalHealthTriage.test.ts
.\node_modules\.bin\tsc.cmd --noEmit
```

Expected: PASS; the existing manual/task/measure/habit progress fixtures retain their prior values.

- [ ] **Step 7: Commit**

```powershell
git add shared/goalIntentions.ts server/goalIntentions.test.ts server/planning.goalIntentions.test.ts server/planning.ts server/routers/planner.ts server/planner.router.test.ts client/src/features/goals client/src/pages/Home.tsx
git commit -m "feat: distinguish outcomes and directions"
```

**Rollback/data safety:** nullable metadata is backward-compatible. Rollback hides new presentation but preserves every stored field and prior progress definition.

---

### Task 17: Deliver project views and the portfolio Roadmap

**Files:**
- Create: `shared/roadmap.ts`
- Create: `server/roadmap.test.ts`
- Create: `server/planning.roadmap.test.ts`
- Modify: `server/planning.ts`
- Modify: `server/routers/planner.ts`
- Modify: `client/src/features/projects/ProjectExecutionWorkspace.tsx`
- Create: `client/src/features/goals/ProjectDetail.tsx`
- Create: `client/src/features/goals/RoadmapWorkspace.tsx`
- Create: `client/src/features/goals/roadmap.css`
- Modify: `scripts/preview-phase4-product.py`

**Interfaces:**
- Produces: project Overview/List/Board/Timeline, `roadmapProjection`, `previewRoadmapMove`, project risk/review updates, and explicit project dependencies.
- Consumes: Task 8 project fields/table, existing task hard/soft dependencies, milestones, and project dates.

- [ ] **Step 1: Write failing projection tests**

Assert month/quarter/year resolution over the same project/milestone IDs; undated records appear under “Not yet dated”; tasks stay in drill-through; risk/stalled/gap flags are factual; project dependencies do not reuse task dependency rows; cyclic/self dependencies fail; and moving a bar returns exact changed/unchanged fields with no child-task cascade.

- [ ] **Step 2: Write service tests**

Add version-safe `updateProject`, `addProjectDependency`, and `removeProjectDependency` tests for ownership, conflicts, cycle detection, and snapshot inclusion.

- [ ] **Step 3: Run the red suite**

Run: `.\node_modules\.bin\vitest.cmd run server\roadmap.test.ts server\planning.roadmap.test.ts server\dependencyPolicy.test.ts server\planner.router.test.ts`

Expected: existing task dependency tests pass; project-level projection/service assertions fail before implementation.

- [ ] **Step 4: Implement server and pure contracts**

Use existing project/milestone dates. A move preview names project start/due changes, goal deadline unchanged, linked tasks unchanged, dependency conflicts, and milestone effects; Apply sends the exact reviewed versions. No implicit cascade exists.

- [ ] **Step 5: Implement desktop and phone views**

Mount the portfolio Roadmap at Plan → Roadmap; project detail retains its own Timeline tab under Projects & Goals. Desktop Roadmap is project/milestone level. Phone defaults to grouped periods and milestones; a focused horizontal/landscape timeline is optional. Every edit is available through date fields and preview sheet without dragging.

- [ ] **Step 6: Run tests and large-data browser evidence**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run server\roadmap.test.ts server\planning.roadmap.test.ts server\dependencyPolicy.test.ts server\planner.router.test.ts
.\node_modules\.bin\tsc.cmd --noEmit
python scripts\preview-phase4-product.py --url http://127.0.0.1:14775 --scenario roadmap-large-data --widths 320,390,768,1440
```

Expected: PASS with many projects, long titles, undated items, overlapping bars, keyboard-only date editing, and no fabricated task-level bars.

- [ ] **Step 7: Commit**

```powershell
git add shared/roadmap.ts server/roadmap.test.ts server/planning.roadmap.test.ts server/planning.ts server/routers/planner.ts client/src/features/projects/ProjectExecutionWorkspace.tsx client/src/features/goals scripts/preview-phase4-product.py
git commit -m "feat: add project portfolio roadmap"
```

**Rollback/data safety:** cancel is write-free. Applied project edits are ordinary versioned current-state changes; dependency rows and risk text are retained on UI rollback.

---

### Task 18: Reframe Habits around return and correction

**Files:**
- Create: `shared/habitRecovery.ts`
- Create: `server/habitRecovery.test.ts`
- Modify: `client/src/features/habits/HabitDisciplineWorkspace.tsx`
- Modify: `client/src/features/today/TodayHabits.tsx`
- Modify: `server/habitConsistency.test.ts`
- Modify: `server/habitSchedule.test.ts`
- Modify: `scripts/preview-phase4-product.py`

**Interfaces:**
- Produces: `habitReturnDecision(habit, checkIns, today)` and recovery-oriented practice UI.
- Consumes: existing daily/weekday/times-per-week/interval schedules and check-in correction services.

- [ ] **Step 1: Write failing state tests**

Cover completed/skipped/missed/not-yet-due, next opportunity, recent consistency, interrupted schedule, no unlimited backlog after ten days, corrected history, and times-per-week semantics without inventing a daily occurrence.

- [ ] **Step 2: Run red tests**

Run: `.\node_modules\.bin\vitest.cmd run server\habitRecovery.test.ts server\habitConsistency.test.ts server\habitSchedule.test.ts server\planning.habit.test.ts`

Expected: existing schedule/persistence tests pass; return-decision assertions fail before implementation.

- [ ] **Step 3: Implement pure return guidance**

Return choices are resume current schedule, revise schedule, or pause until a review point. Because habit writes remain online-only, offline forms retain edits and show reconnect guidance before save. Saved Habit views retain their configuration, pin, order, version, and workspace scope.

- [ ] **Step 4: Upgrade Today and Habits presentation**

Today renders only due practices, never duplicated task records. History keeps explicit corrections and notes. Streak remains optional evidence; return guidance and next opportunity are primary.

- [ ] **Step 5: Run tests and browser checks**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run server\habitRecovery.test.ts server\habitConsistency.test.ts server\habitSchedule.test.ts server\planning.habit.test.ts server\plannerRules.test.ts
.\node_modules\.bin\tsc.cmd --noEmit
python scripts\preview-phase4-product.py --url http://127.0.0.1:14775 --scenario habit-return
```

Expected: PASS; ten missed opportunities remain historical facts rather than ten mandatory recovery rows.

- [ ] **Step 6: Commit**

```powershell
git add shared/habitRecovery.ts server/habitRecovery.test.ts client/src/features/habits/HabitDisciplineWorkspace.tsx client/src/features/today/TodayHabits.tsx server/habitConsistency.test.ts server/habitSchedule.test.ts scripts/preview-phase4-product.py
git commit -m "feat: orient habits around consistent return"
```

**Rollback/data safety:** no check-in is rewritten to protect a streak. Corrections continue through the existing scoped/versioned service.

---

### Task 19: Make Focus persistent across navigation

**Files:**
- Create: `shared/focusClock.ts`
- Create: `server/focusClock.test.ts`
- Create: `client/src/features/focus/FocusPersistentControl.tsx`
- Modify: `client/src/features/focus/FocusWorkspace.tsx`
- Modify: `client/src/features/shell/PlannerShell.tsx`
- Modify: `server/focusMetrics.test.ts`
- Modify: `scripts/preview-phase4-product.py`

**Interfaces:**
- Produces: `confirmedActiveSeconds(session, now)` and a compact active/paused control in the shell.
- Consumes: existing focus start/pause/resume/finish services and confirmed snapshot state.

- [ ] **Step 1: Write failing clock/session tests**

Assert active seconds advance only from server-confirmed `lastResumedAt`, paused sessions do not advance, negative/system-clock jumps clamp safely, refresh does not duplicate elapsed time, reservations contribute zero actual focus, and unsupported offline actions never claim persistence.

- [ ] **Step 2: Run red tests**

Run: `.\node_modules\.bin\vitest.cmd run server\focusClock.test.ts server\focusMetrics.test.ts server\planner.router.test.ts`

Expected: existing focus metrics/router tests pass; focus clock assertions fail before implementation.

- [ ] **Step 3: Implement the clock and persistent control**

Show task/unlinked label, elapsed time, pause/resume, stop, and return to full Focus. All controls have keyboard/touch equivalents. If offline, show last confirmed state and explain that focus mutation requires reconnection.

- [ ] **Step 4: Keep finish outcomes unchanged**

Done, continue, adjust estimate, and stopped remain the only server outcomes. Completing a session does not complete a task unless Done is explicitly chosen.

- [ ] **Step 5: Run focused tests and route-continuity browser flow**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run server\focusClock.test.ts server\focusMetrics.test.ts server\planner.router.test.ts
.\node_modules\.bin\tsc.cmd --noEmit
python scripts\preview-phase4-product.py --url http://127.0.0.1:14775 --scenario focus-navigation
```

Expected: PASS; active/paused state remains visible through three destination changes and refresh does not manufacture time.

- [ ] **Step 6: Commit**

```powershell
git add shared/focusClock.ts server/focusClock.test.ts client/src/features/focus/FocusPersistentControl.tsx client/src/features/focus/FocusWorkspace.tsx client/src/features/shell/PlannerShell.tsx server/focusMetrics.test.ts scripts/preview-phase4-product.py
git commit -m "feat: keep active focus visible across navigation"
```

**Rollback/data safety:** the compact control is another view of existing focus rows. Never synthesize or rewrite `activeSeconds` during rollback.

---

### Task 20: Build bounded Home Overview modules

**Files:**
- Create: `shared/overview.ts`
- Create: `server/overview.test.ts`
- Create: `client/src/features/today/OverviewWorkspace.tsx`
- Create: `client/src/features/today/OverviewModule.tsx`
- Create: `client/src/features/today/overview.css`
- Modify: `client/src/features/shell/usePlannerPreferences.ts`
- Modify: `client/src/pages/Home.tsx`
- Modify: `scripts/preview-phase4-product.py`

**Interfaces:**
- Produces: seven bounded modules, device-local order/visibility/size, and record-level drill-through.
- Consumes: established dashboard facts, Today/recovery/habit/goal/project/roadmap/review projections.

- [ ] **Step 1: Write failing module tests**

For Needs attention, Time and capacity, Habits, Goals and directions, Projects at risk, Upcoming milestones, and Review, assert a decision question, visible period, source record IDs, one primary action, defined empty state, and canonical destination. Assert no productivity score and no duplicated records.

- [ ] **Step 2: Write preference tests**

Order/hide/bounded size are versioned device-local preferences. Hidden modules remain discoverable, and hiding Needs attention never resolves or hides the global Strict recovery indicator.

- [ ] **Step 3: Run red tests**

Run: `.\node_modules\.bin\vitest.cmd run server\overview.test.ts server\goalHealthTriage.test.ts server\planningForecast.test.ts server\plannerRules.test.ts`

Expected: existing factual selectors pass; bounded module/preference assertions fail before implementation.

- [ ] **Step 4: Implement desktop grid and phone briefing**

Desktop uses unequal emphasis based on deterministic module sizes. Phone uses the stored order with attention first when active. Empty modules explain what belongs there and offer one useful action.

- [ ] **Step 5: Run tests and responsive evidence**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run server\overview.test.ts server\goalHealthTriage.test.ts server\planningForecast.test.ts server\plannerRules.test.ts
.\node_modules\.bin\tsc.cmd --noEmit
python scripts\preview-phase4-product.py --url http://127.0.0.1:14775 --scenario overview --widths 320,390,768,1440
```

Expected: PASS; desktop uses a composed grid, phone uses an ordered briefing, and every populated or empty module has one decision/action.

- [ ] **Step 6: Commit**

```powershell
git add shared/overview.ts server/overview.test.ts client/src/features/today/OverviewWorkspace.tsx client/src/features/today/OverviewModule.tsx client/src/features/today/overview.css client/src/features/shell/usePlannerPreferences.ts client/src/pages/Home.tsx scripts/preview-phase4-product.py
git commit -m "feat: add decision-oriented home overview"
```

**Rollback/data safety:** Overview preferences are device-local and backed up. Modules are projections and never own planner records.

---

### Task 21: Consolidate Review, Insights, History, and Settings utilities

**Files:**
- Create: `client/src/features/review/ReviewWorkspace.tsx`
- Create: `client/src/features/review/ReviewHistory.tsx`
- Create: `client/src/features/settings/SettingsWorkspace.tsx`
- Create: `client/src/features/settings/SettingsGroup.tsx`
- Create: `client/src/features/settings/settings.css`
- Modify: `client/src/features/insights/PlanningInsightsWorkspace.tsx`
- Modify: `client/src/features/integrations/CalendarIntegrationWorkspace.tsx`
- Modify: `client/src/contexts/ThemeContext.tsx`
- Modify: `client/src/pages/Home.tsx`
- Modify: `scripts/preview-phase4-product.py`
- Create: `server/phase4ReviewSettings.test.ts`

**Interfaces:**
- Produces: Review/Rituals/Insights/History and grouped Settings rows.
- Consumes: existing review snapshots/checklists/history, sync/conflict/orphan controls, categories/recycle bin, PWA state, outgoing feed, a reserved Notifications settings row, theme/density/nav preferences, and account logout.

- [ ] **Step 1: Write failing reachability/state tests**

Assert daily through yearly review kinds; evidence → reflection → unresolved decisions → commitments; resumable sessions; historical snapshots unaffected by current edits; dated/source-backed insights; and all settings groups from the spec. Assert sign-out is pointer accessible above safe areas and says retained account cache is hidden, not deleted.

- [ ] **Step 2: Run red tests**

Run: `.\node_modules\.bin\vitest.cmd run server\phase4ReviewSettings.test.ts server\reviewChecklist.test.ts server\planner.router.test.ts client\src\lib\reminderDevicePresentation.test.ts`

Expected: existing review/router/device tests pass; consolidated route/reachability assertions fail before implementation.

- [ ] **Step 3: Implement Review tabs without new analytics**

Move existing daily/weekly/monthly/quarterly/yearly sessions, daily intention/reflection/energy/mood, weekly checklist, occurrence review, planning health, focus comparison, carryover, allocation, habit consistency, goal health, workload/deadline, and saved history. Do not add activity ledgers, inferred interruption patterns, correlations, forecasts, or generalized dashboards.

- [ ] **Step 4: Implement Settings groups**

Rows: Account/workspace; timezone/planning defaults; appearance/density/navigation/Overview; sync/pending/conflicts/orphans; Connections; Categories & Recycle Bin; PWA/device/update; Sign out. Appearance provides explicit Light, Dark, and Follow device choices through `setTheme`. Connections labels the outgoing private read-only Apple-compatible subscription and a separately unimplemented incoming-calendar boundary. Gmail remains future work.

- [ ] **Step 5: Run focused tests and phone keyboard/safe-area flow**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run server\phase4ReviewSettings.test.ts server\reviewChecklist.test.ts server\planner.router.test.ts server\auth.logout.test.ts client\src\lib\reminderDevicePresentation.test.ts
.\node_modules\.bin\tsc.cmd --noEmit
python scripts\preview-phase4-product.py --url http://127.0.0.1:14775 --scenario review-settings-phone
```

Expected: PASS; Review state resumes, historical snapshot text stays unchanged, and Settings/sign-out final actions are pointer-accessible above the phone safe area.

- [ ] **Step 6: Commit**

```powershell
git add client/src/features/review client/src/features/settings client/src/features/insights/PlanningInsightsWorkspace.tsx client/src/features/integrations/CalendarIntegrationWorkspace.tsx client/src/contexts/ThemeContext.tsx client/src/pages/Home.tsx server/phase4ReviewSettings.test.ts scripts/preview-phase4-product.py
git commit -m "feat: consolidate review and settings"
```

**Rollback/data safety:** Settings changes access paths only. Sign-out still clears mounted private state and hides account-scoped cache; it never deletes planner or queued data.

---

### Task 22: Complete accessibility, large-data, and measured performance work

**Files:**
- Modify: `scripts/preview-phase4-product.py`
- Create: `server/phase4Accessibility.test.ts`
- Create: `server/phase4Bundle.test.ts`
- Modify: `client/src/pages/Home.tsx`
- Modify: `client/src/index.css`
- Modify: `docs/PHASE4_SLICE_EVIDENCE.md`

**Interfaces:**
- Consumes: all production slices except notifications.
- Produces: integrated evidence and a materially smaller initial bundle with lazy destination chunks.

- [ ] **Step 1: Write automated accessibility/source contracts**

Assert landmarks, focus-visible rules, dialog names/trap/restoration, live regions for saves/conflicts, non-color statuses, 44px phone targets in both densities, 200% reflow, reduced motion, and keyboard/menu alternatives for drag/swipe/timeline actions.

- [ ] **Step 2: Write bundle budget test against the baseline**

Parse Vite manifest/build output. Require Home’s initial chunk to exclude Recharts, Roadmap, Calendar execution, Review history, and full Focus workspace; record raw/gzip sizes and require a measured initial gzip reduction from the 371.09 kB baseline. If environment hashing changes, compare module membership and bytes, not filenames.

- [ ] **Step 3: Run red checks before final extraction**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run server\phase4Accessibility.test.ts server\phase4Bundle.test.ts
.\node_modules\.bin\vite.cmd build
```

Expected: accessibility/source failures identify remaining ownership gaps; the bundle test reports heavy modules still reachable from the initial Home chunk.

- [ ] **Step 4: Finish shrinking `Home.tsx`**

Move remaining Task, Goal, Habit, Settings, Calendar, composer, and sync-review presentation into their feature owners. Keep Home responsible only for scope, snapshot/offline overlay, sync orchestration, selected location, top-level mutation adapters, and lazy destination composition. Remove superseded CSS blocks instead of appending stronger overrides.

- [ ] **Step 5: Run the 15 research scenarios**

At 320, 390, phone landscape, 768, and 1440, cover ordinary day, interruption, low capacity, ten-day return, waiting-for, missing next action, Direction, Roadmap move/cancel, recurrence boundary, offline task/unsupported entity/conflict, large data, keyboard/sheet/safe area, accessibility alternatives, empty state, and archived linked restore. Use synthetic data labels and record that this is not physical-device proof.

- [ ] **Step 6: Run the full local gate**

```powershell
.\node_modules\.bin\tsc.cmd --noEmit
.\node_modules\.bin\vitest.cmd run
.\node_modules\.bin\vite.cmd build
node scripts\build-pwa.mjs
.\node_modules\.bin\esbuild.cmd server\_core\vercelApp.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/server/planner-app.mjs
python scripts\preview-phase4-product.py --url http://127.0.0.1:14775 --output "$env:TEMP\personal-calendar-phase4-product"
```

Expected: all tests/builds pass, 20-file PWA public shell contains no API/private data, no unexpected runtime/console errors, zero page-level horizontal overflow, and the evidence file contains exact measured bundle results.

- [ ] **Step 7: Commit**

```powershell
git add scripts/preview-phase4-product.py server/phase4Accessibility.test.ts server/phase4Bundle.test.ts client/src/pages/Home.tsx client/src/index.css docs/PHASE4_SLICE_EVIDENCE.md
git commit -m "perf: verify phase4 accessibility and loading"
```

**Rollback/data safety:** performance rollback restores code splitting only. Never clear service-worker/IndexedDB data to make a bundle or browser test pass; use controlled worker activation that preserves queued work.

---

### Task 23: Integrate notifications last and prepare Preview handoff

**Files:**
- Create: `client/src/features/settings/NotificationSettings.tsx`
- Create: `server/phase4NotificationSettings.test.ts`
- Modify: `client/src/features/settings/SettingsWorkspace.tsx`
- Modify: `client/src/lib/reminderDevicePresentation.ts`
- Modify: `client/src/lib/reminderDevicePresentation.test.ts`
- Modify: `docs/PHASE4_SLICE_EVIDENCE.md`
- Modify: `docs/INDEPENDENT_STACK_HANDOFF.md`
- Modify: `docs/AGENT_FLOW.md`

**Interfaces:**
- Consumes: existing device subscription, test delivery, approved cadence, pause/opt-out, scheduler, timezone, and sync-ready contracts.
- Produces: final Settings integration and explicit engineering-versus-device evidence.

- [ ] **Step 1: Write failing notification UI contract tests**

Cover explicit opt-in, installed/supported state, default/denied/dismissed permission, exact-device identity, test delivery, cadence in workspace timezone, opt-out, expired subscription recovery, offline/pending/conflict gate, and no notification escalation from Strict mode.

- [ ] **Step 2: Run notification/reminder regression tests**

```powershell
.\node_modules\.bin\vitest.cmd run server\phase4NotificationSettings.test.ts client\src\lib\reminderDevicePresentation.test.ts server\planning.push.test.ts server\planning.reminder.test.ts server\reminderSchedule.test.ts server\reminderEndpoint.test.ts server\vapidConfig.test.ts
```

Expected before implementation: the new UI contract fails; existing delivery/scheduler tests pass.

- [ ] **Step 3: Implement the grouped notification settings row**

Show permission outcome, current device label, last tested/sent confirmation, test action, daily/weekly cadence, timezone, and disable action. “Subscribed” and “scheduler succeeded” remain distinct from “received on this iPhone.” Do not add autonomous escalation.

- [ ] **Step 4: Run the complete local gate again**

Use the exact Task 22 commands. Record test counts, build/PWA release, bundle sizes, and synthetic browser evidence.

- [ ] **Step 5: Revalidate independent infrastructure before Preview**

Run the existing legacy-provider scan, serverless entrypoint packaging tests, auth/ownership boundary tests, PWA cache exclusions, sync migration tests, reminder endpoint tests, and a fresh read-only live audit. Confirm the Task 9 migration postflight and target identity. If infrastructure is not clean, stop before Vercel.

- [ ] **Step 6: Stop for explicit branch push/Preview authorization**

Present the commit range, local gate, migration evidence, rollback deployment, and remaining physical-iPhone checks. Do not push, deploy, merge `main`, promote Production, enable/replace scheduler state, or change environment values without the corresponding explicit authorization.

- [ ] **Step 7: After Preview authorization, verify Preview only**

Verify root/health/manifest/worker/planner functions, actual sign-in/workspace, record counts/identities, legacy URLs/preferences, task offline queue, conflict review, Apple-compatible outgoing feed labeling, notification settings, and synthetic widths. Do not describe Preview or scheduler success as phone delivery.

- [ ] **Step 8: Hand physical-iPhone evidence to the user**

Checklist: installed standalone launch/update, offline capture/edit/relaunch/reconnect, notification permission, test receipt, cadence receipt, opt-out, safe areas, keyboard/sheets, landscape Roadmap, and sign-out. Record pass/fail separately; never manufacture this evidence.

- [ ] **Step 9: Commit final documentation**

```powershell
git add client/src/features/settings/NotificationSettings.tsx client/src/features/settings/SettingsWorkspace.tsx client/src/lib/reminderDevicePresentation.ts client/src/lib/reminderDevicePresentation.test.ts server/phase4NotificationSettings.test.ts docs/PHASE4_SLICE_EVIDENCE.md docs/INDEPENDENT_STACK_HANDOFF.md docs/AGENT_FLOW.md
git commit -m "feat: finish phase4 notification settings"
```

**Rollback/data safety:** route traffic to the prior compatible deployment. Preserve VAPID keys, push subscriptions, reminder rules, delivery history, additive schema, planner records, IndexedDB operations, and service-worker ownership boundaries.

---

## Feature-parity self-review matrix

| Ledger family | Primary task coverage | Mandatory regression evidence |
| --- | --- | --- |
| Tasks/occurrences | 10–13, 15 | Identity, every field/action, recurrence/occurrence separation, archive/restore, conflicts |
| Daily plans/check-ins | 12–15 | States, ordering, intention/reflection, reopen/close, outcomes, rollover evidence |
| Weekly planning | 15, 21 | Linked/standalone objectives, evidence, states, ancestry, local dates |
| Goals/milestones/projects | 16–17 | Flexible links, nested goals, progress modes, dates optional, history retained |
| Long-term views/Roadmap | 17 | Same records, undated group, risk/dependency/gap, preview/cancel/no cascade |
| Habits | 12, 18 | Four schedules, reminder, links, all check-in facts, correction/history/recovery |
| Focus | 19 | Linked/unlinked, lifecycle, target/actual, outcome, estimate update, suspension honesty |
| Scheduling/availability | 10, 15 | Defaults/exceptions, collision, timezone/DST, proposal states, explicit apply/undo |
| Capture/templates | 11 | Inbox title-only, editable parse, task/project/daily templates, review-first, offline idempotency |
| Search/filters/saved views | 6, 11 | URL/query/filter retention, record deep links, pin/order/version/workspace |
| Reviews/Insights | 20–21 | Five periods, snapshots, allocation/carryover/focus/habit/goal/planning evidence |
| Auth/sync/offline | 7, 11–14, 21–23 | Owned scope, cached reads, supported queue, unsupported honesty, conflict/orphan, sign-out isolation |
| Categories/archive/recycle bin | 11, 21 | Ordering/links, restore, indefinite retention, separately confirmed permanent category deletion |
| PWA/appearance/device | 5–7, 22 | Manifest/shortcuts/cache/update, themes/density/pins/rail, safe areas, reduced motion |
| Connections/notifications/files | 21, 23 | Outgoing read-only feed truth, notification final slice, deferred storage truth |

## Data mutation and compatibility summary

- Existing tables receive a default-safe Structured workspace accountability field, nullable goal metadata, and default-safe project risk fields. No existing goal is classified automatically.
- New resolution/dependency rows use new IDs and workspace ownership; existing entity IDs are referenced, never replaced.
- Strict compound decisions are transactional and online-only. Existing supported task-only offline operations stay unchanged.
- Daily-plan state values remain unchanged for old clients; explicit Reduce/Pause meaning lives in `commitmentResolutions`.
- Task, goal, project, milestone, habit, focus, review, saved-view, sync, and notification calculations keep their current definitions.
- URL and preference adapters are reversible. Unknown URL parameters and original preference JSON are preserved.
- Migration authoring/local proof is Task 8; controller preparation/read-only audit and explicit approval/application are Task 9. These are intentionally separate.

## Final completion gate

Phase 4 is complete only when all ledger rows are reachable, full automated/build/PWA checks pass, slice evidence has no unexplained record-count/identity/history change, initial-load reduction is measured, all required synthetic widths and accessibility flows pass, Preview is verified under explicit authorization, and physical-iPhone gaps are named accurately. `main` remains the frozen reference unless the user separately authorizes a merge.
