# Reliable PWA Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Personal Calendar installable with production-grade icons and metadata, atomically cache its exact application shell, recover cleanly offline, and present safe install/connectivity/update states without caching private API data.

**Architecture:** Keep one repository-owned service worker and inject the exact Vite output manifest into it after each production build. Separate pure cache/update/connectivity policy from browser wiring, mount one small PWA status component above authenticated routing, and leave account data synchronization to Phase 2.

**Tech Stack:** React 19, TypeScript, Vite 7, Vitest 2, repository-owned JavaScript service worker, Web App Manifest, Playwright browser verification.

**Spec:** `docs/superpowers/specs/2026-09-12-reliable-pwa-foundation-design.md`

## Global Constraints

- Work on `dev/personal-calendar-workbench`; never merge into `main` without explicit user instruction.
- Never cache `/api/**`, Supabase traffic, authorization/session data, planner snapshots, mutations, or attachments in Cache Storage.
- Keep one service worker and preserve existing push, notification-click, and subscription-change behavior.
- Never reset databases, replay baseline migrations, replace record IDs, or clear IndexedDB/auth/pending captures during PWA rollback.
- A new worker activates only from an allowlisted user-triggered message after pending offline work is durably stored.
- All phone controls are at least 44pt and respect safe areas, reduced motion, large text, and visible non-color status labels.
- Phase 1 provides reliable shell launch; it must not claim full offline planner editing before Phase 2.

---

### Task 1: Manifest, platform metadata, and complete icon set

**Files:**
- Modify: `client/public/manifest.webmanifest`
- Modify: `client/index.html`
- Modify: `client/public/icon.svg`
- Create: `client/public/icons/apple-touch-icon-180.png`
- Create: `client/public/icons/icon-192.png`
- Create: `client/public/icons/icon-512.png`
- Create: `client/public/icons/icon-maskable-192.png`
- Create: `client/public/icons/icon-maskable-512.png`
- Create: `server/pwaManifest.test.ts`

**Interfaces:**
- Produces: manifest shortcuts `/?surface=today&source=pwa-shortcut` and `/?compose=task&source=pwa-shortcut` for Task 4 to consume.
- Produces: raster asset paths consumed by the manifest, HTML metadata, service worker, and build-manifest generator.

- [ ] **Step 1: Write a failing manifest and icon contract test**

Create `server/pwaManifest.test.ts` that reads `client/public/manifest.webmanifest` and the five PNG files. Assert `id === "/"`, `scope === "/"`, `start_url === "/?source=pwa"`, `display === "standalone"`, `display_override` contains `"standalone"`, `orientation === "any"`, the two exact shortcut URLs exist, and icon declarations include 192, 512, and maskable 192/512 entries. Read each PNG header and assert the IHDR width/height equals its declared size.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm vitest run server/pwaManifest.test.ts`

Expected: FAIL because stable ID, shortcuts, and raster icons are missing.

- [ ] **Step 3: Implement metadata and icons**

Update the manifest with the exact fields in Step 1 plus `lang: "en"`, `dir: "ltr"`, categories `productivity` and `utilities`, and the existing theme/background palette. Add the Apple touch icon and Apple standalone meta tags to `client/index.html`. Preserve `viewport-fit=cover`.

Generate committed raster icons from `client/public/icon.svg`. The maskable images must keep the recognizable mark inside the central 80% safe zone. Standard and Apple icons may use the full rounded-square canvas.

- [ ] **Step 4: Run the focused test**

Run: `pnpm vitest run server/pwaManifest.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add client/public/manifest.webmanifest client/index.html client/public/icon.svg client/public/icons server/pwaManifest.test.ts
git commit -m "feat: complete PWA install metadata"
```

### Task 2: Deterministic production shell generation and cache policy

**Files:**
- Create: `scripts/build-pwa.mjs`
- Create: `scripts/build-pwa.test.ts`
- Modify: `client/public/sw.js`
- Create: `client/public/offline.html`
- Modify: `package.json`

**Interfaces:**
- Produces: `collectPrecacheFiles(outputDirectory): Promise<string[]>` returning sorted root-relative public URLs.
- Produces: `injectPwaBuild({ template, release, precache }): string` replacing the single `/*__PERSONAL_CALENDAR_PWA_BUILD__*/` marker.
- Produces in `dist/public/sw.js`: `self.__PERSONAL_CALENDAR_PWA_BUILD__ = { release, precache }` before worker logic.
- Consumes: manifest/icon paths from Task 1.

- [ ] **Step 1: Write failing build-manifest tests**

In `scripts/build-pwa.test.ts`, create an isolated temporary build directory containing `index.html`, `offline.html`, `manifest.webmanifest`, two icon files, and fingerprinted JS/CSS. Assert `collectPrecacheFiles` returns those public URLs but excludes `sw.js`, source maps, and arbitrary non-shell files. Assert `injectPwaBuild` throws when the marker is missing or duplicated and emits a stable release hash for identical sorted content. Temporary paths come from `mkdtemp` and are removed in `afterEach`.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm vitest run scripts/build-pwa.test.ts`

Expected: FAIL because `scripts/build-pwa.mjs` does not exist.

- [ ] **Step 3: Implement the post-build generator**

Export the two interfaces above from `scripts/build-pwa.mjs`. Build the release ID from SHA-256 hashes of the sorted shell files, truncated to 16 hexadecimal characters. When invoked as a CLI, read `client/public/sw.js`, inspect `dist/public`, inject the build record, and atomically replace `dist/public/sw.js` through a sibling temporary file.

Change `build:client` to run `vite build`, then `node scripts/build-pwa.mjs`, then the existing Vercel server bundle. Keep `build` consistent by running the PWA generator after its Vite step too.

- [ ] **Step 4: Implement the service-worker cache policy**

Use a source fallback build record `{ release: "development", precache: ["/", "/offline.html", "/manifest.webmanifest", "/icon.svg"] }`. Name shell/runtime caches with an owned `personal-calander-` prefix and generated release. During install, fetch every precache URL with `cache: "reload"`, accept only successful basic same-origin responses, and do not call `skipWaiting()`.

Implement these request strategies exactly: network-first navigation with a 3-second abort and cached `/` then `/offline.html` fallback; cache-first fingerprinted `/assets/`; bounded stale-while-revalidate for manifest, icons, and approved same-origin static media. Return early for non-GET, `/api/`, and any cross-origin request. Never turn a failed API request into the offline document.

Retain push, notification-click, and subscription-change handlers. Normalize notification destinations with `new URL(candidate, self.location.origin)` and fall back to `/` when the origin differs.

- [ ] **Step 5: Run focused tests and a production build**

Run:

```powershell
pnpm vitest run scripts/build-pwa.test.ts server/pwaManifest.test.ts
pnpm run build:client
```

Expected: tests PASS; build PASS; `dist/public/sw.js` contains the generated release and current fingerprinted JS/CSS paths.

- [ ] **Step 6: Commit**

Run:

```powershell
git add scripts/build-pwa.mjs scripts/build-pwa.test.ts client/public/sw.js client/public/offline.html package.json pnpm-lock.yaml
git commit -m "feat: generate atomic PWA shell cache"
```

### Task 3: Controlled worker registration and update lifecycle

**Files:**
- Create: `client/src/lib/pwaLifecycle.ts`
- Create: `client/src/lib/pwaLifecycle.test.ts`
- Create: `client/src/contexts/PwaContext.tsx`
- Modify: `client/src/main.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Produces: `PwaState = { support: "supported" | "unsupported"; display: "browser" | "standalone"; update: "idle" | "checking" | "ready" | "activating" | "error"; connectivity: "online" | "checking" | "offline" | "reconnected"; install: "unavailable" | "available" | "dismissed"; message: string | null }`.
- Produces: `PwaActions = { install(): Promise<void>; dismissInstall(): void; retryConnection(): Promise<void>; activateUpdate(): Promise<void> }`.
- Produces: `hasDurablePendingWork(): boolean`, initially backed by the existing offline quick-capture storage.
- Consumes: worker message `{ type: "personal-calendar:activate-update" }` handled by Task 2.

- [ ] **Step 1: Write failing pure lifecycle tests**

Test standalone detection, iPhone install-guidance eligibility, remembered dismissal, waiting-worker detection, one-reload controller-change guard, same-origin update messages, and `hasDurablePendingWork()` with empty/non-empty quick-capture storage.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm vitest run client/src/lib/pwaLifecycle.test.ts`

Expected: FAIL because the lifecycle module does not exist.

- [ ] **Step 3: Implement registration and context**

Move worker registration out of the top-level block in `main.tsx` into `PwaContext`. Register `/sw.js` with `updateViaCache: "none"`, detect `registration.waiting` plus `updatefound`, check for an update after window load and when the document becomes visible, and never throw when unsupported.

Capture `beforeinstallprompt` without automatically prompting. Store install dismissal under `personal-calander:pwa-install-dismissed:v1`. On explicit update, first call `hasDurablePendingWork()`, then post the allowlisted activation message. Reload once after controller change using `sessionStorage` key `personal-calander:pwa-reload:v1`.

- [ ] **Step 4: Implement connectivity verification**

Combine online/offline events, visibility return, and a bounded credentials-included `GET /api/health` check. Online signals transition through `checking`; a successful response yields `reconnected` then `online`; network/timeout failures yield `offline`. Do not repeatedly poll while offline.

- [ ] **Step 5: Run focused tests and TypeScript**

Run:

```powershell
pnpm vitest run client/src/lib/pwaLifecycle.test.ts
pnpm run check
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add client/src/lib/pwaLifecycle.ts client/src/lib/pwaLifecycle.test.ts client/src/contexts/PwaContext.tsx client/src/main.tsx client/src/App.tsx
git commit -m "feat: control PWA updates and connectivity"
```

### Task 4: Premium install, connectivity, and update UI

**Files:**
- Create: `client/src/components/PwaStatus.tsx`
- Create: `client/src/components/PwaStatus.test.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/index.css`
- Modify: `client/src/pages/Home.tsx`

**Interfaces:**
- Consumes: `PwaState` and `PwaActions` from Task 3.
- Consumes: manifest shortcut query parameters and routes them through existing surface/composer state.
- Produces: one global `.pwa-status-layer` with accessible install guidance, offline/checking/reconnected status, retry action, and update-ready action.

- [ ] **Step 1: Write failing component-state tests**

Render the presentational `PwaStatus` with `react-dom/server` for each state. Assert online/idle renders nothing; offline renders one `role="status"` surface and a “Try again” button; update-ready renders an “Update now” button; standalone mode hides install guidance; iPhone guidance says “Share, then Add to Home Screen”; dismissed guidance is absent; and reconnected uses a polite live region rather than an alert. CSS assertions separately require `min-height:44px` on interactive status controls.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm vitest run client/src/components/PwaStatus.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the component and styling**

Mount `PwaStatus` once inside the PWA provider and outside authenticated routing so install/update recovery also works at sign-in. Use existing mineral/verdigris tokens, phone safe-area offsets, 44pt buttons, visible text plus icon, restrained elevation, and reduced-motion rules. Do not cover the phone bottom navigation or account controls.

Use one quiet status surface; never emit repeated toasts for connectivity. Include exact capability copy so Phase 1 says quick captures may be queued but full offline editing is not yet available.

- [ ] **Step 4: Wire manifest shortcuts**

At Home initialization, consume `surface=today` and `compose=task` only when values are allowlisted, open the existing destination/composer, then remove only those handled parameters with `history.replaceState`. Preserve unrelated query parameters.

- [ ] **Step 5: Run focused tests, existing mobile tests, and TypeScript**

Run:

```powershell
pnpm vitest run client/src/components/PwaStatus.test.tsx server/mobileNavigation.test.ts server/mobileTaskGesture.test.ts
pnpm run check
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add client/src/components/PwaStatus.tsx client/src/components/PwaStatus.test.tsx client/src/App.tsx client/src/index.css client/src/pages/Home.tsx
git commit -m "feat: add calm PWA status experience"
```

### Task 5: Offline and upgrade browser regression suite

**Files:**
- Create: `scripts/preview-pwa.py`
- Modify: `scripts/preview-linked-planner.py`

**Interfaces:**
- Produces: JSON evidence and screenshots for desktop 1440x1000 and phone 390x844.
- Consumes: the compiled `dist/public` preview and synthetic authenticated API interception already used by `preview-linked-planner.py`.

- [ ] **Step 1: Write the browser scenarios**

Implement scenarios for signed-out production-shell rendering, linked synthetic rendering, first online load followed by offline reload, cold offline visit without a prior cache, no `/api/**` entries in Cache Storage, worker update waiting/activation, and cache cleanup preserving an unrelated sentinel cache. Assert phone scroll width does not exceed 390px and capture offline/update states.

- [ ] **Step 2: Run against the pre-change build and verify useful failure**

Run a production preview on port 14777, then:

`python scripts/preview-pwa.py --url http://127.0.0.1:14777 --output "C:/Users/win 10/AppData/Local/Temp/personal-calander-pwa-verification"`

Expected: every scenario passes against the implementation from Tasks 1–4. If it fails, preserve the failing evidence, correct the smallest responsible implementation unit, and rerun this command.

- [ ] **Step 3: Complete test hooks without weakening production behavior**

Add only observable release/status messages needed by the test. Do not expose tokens, account data, internal error objects, or mutation payloads. Do not add environment-specific bypasses to production code.

- [ ] **Step 4: Run the complete browser suite**

Expected: every desktop/phone scenario passes; runtime errors are empty; Cache Storage contains only public shell/static URLs; screenshots show usable offline and update-ready states.

- [ ] **Step 5: Commit**

Run:

```powershell
git add scripts/preview-pwa.py scripts/preview-linked-planner.py
git commit -m "test: verify PWA offline and upgrade behavior"
```

### Task 6: Integrated verification, documentation, preview, and iPhone gate

**Files:**
- Modify: `docs/AGENT_FLOW.md`
- Modify: `docs/INDEPENDENT_STACK_HANDOFF.md`
- Modify: `docs/PWA_SYNC_NOTIFICATIONS_ROADMAP.md`
- Modify: `docs/superpowers/specs/2026-09-12-reliable-pwa-foundation-design.md`

**Interfaces:**
- Consumes: exact test/build/browser evidence from Tasks 1–5.
- Produces: current handoff state and explicit remaining Phase 2/3/4 work.

- [ ] **Step 1: Run the integrated local gate**

Run:

```powershell
pnpm run check
pnpm test
pnpm run build:client
```

Expected: TypeScript PASS; all tests PASS with only documented skips; build PASS with no new warning beyond the existing large-chunk warning.

- [ ] **Step 2: Inspect generated output and rendered screenshots**

Confirm the generated worker release matches built assets, API paths are absent from Cache Storage, icons are not clipped, phone status surfaces do not overlap navigation/account controls, and offline copy does not claim full synchronization.

- [ ] **Step 3: Update the four documents**

Record exact commit, test counts, build asset names, cache release, browser sizes/scenarios, known limitations, rollback route, and remaining real-iPhone checks. Change the design status only to “implemented locally” until Preview and device evidence exist.

- [ ] **Step 4: Commit the verified local phase**

Run:

```powershell
git add docs/AGENT_FLOW.md docs/INDEPENDENT_STACK_HANDOFF.md docs/PWA_SYNC_NOTIFICATIONS_ROADMAP.md docs/superpowers/specs/2026-09-12-reliable-pwa-foundation-design.md
git commit -m "docs: record PWA foundation verification"
```

- [ ] **Step 5: Push only the workbench branch and verify Preview**

Push `dev/personal-calendar-workbench` only after confirming the exact Git remote. Verify the branch deployment health, generated asset/worker release, online load, cached offline reload, and no private Cache Storage entries. Do not merge `main` without a new explicit instruction.

- [ ] **Step 6: Complete the real-iPhone gate**

Install or refresh the Preview from Safari, inspect the Home Screen icon and standalone chrome, open once online, relaunch without connectivity, reconnect, activate a waiting update, and confirm pending quick captures survive. Record device/iOS version and results. Phase 1 remains “Preview verified; device gate pending” until this step is performed.

---

## Execution choice

The user requested continuous execution in this session. Use inline execution with `superpowers:executing-plans`; do not delegate tasks unless the user later explicitly requests agents. Stop only for a genuine authorization boundary, destructive action, unavailable real-device step, or failed safety gate.
