# Reliable PWA Foundation Design

Status: proposed for user review

Date: 2026-09-12

## Purpose

Make Personal Calendar installable and reliably launchable as a standalone iPhone and desktop PWA. This phase hardens the application shell, install metadata, icons, update lifecycle, and offline/reconnection presentation without attempting to solve offline account-data synchronization prematurely.

## Scope boundary

Phase 1 owns static application delivery:

- Web App Manifest and platform metadata.
- Complete app-icon set.
- Deterministic app-shell precaching.
- Safe runtime caching for public static resources.
- Offline navigation fallback.
- Service-worker update lifecycle.
- Install, offline, reconnected, and update-ready UI.
- Automated cache, upgrade, security, accessibility, and iPhone checks.

Phase 1 does not cache authenticated API responses, introduce a database migration, implement the complete IndexedDB planner snapshot, replay all mutations offline, or activate reminder delivery. The existing limited quick-capture queue may continue to work, but the UI must not imply that all planner editing is offline-capable until Phase 2 ships.

## Existing foundation

The repository already includes `client/public/manifest.webmanifest`, `client/public/icon.svg`, `client/public/sw.js`, a manifest link in `client/index.html`, service-worker registration in `client/src/main.tsx`, an account-backed planner API, a limited local quick-capture queue, and push event handlers. The current worker uses a manually named `personal-calander-shell-v2` cache, caches `/` during installation, lazily caches same-origin GET resources, and activates immediately.

The implementation must evolve these files without registering a second worker, duplicating notification handlers, caching API data, or breaking current push subscriptions.

## Manifest and standalone behavior

The manifest will define a stable `id` and `/` scope; a `/?source=pwa` start URL; standalone display with a conservative display override; product name, description, language, direction, categories, theme and background colors; portrait-primary orientation without blocking landscape; Today and New Task shortcuts; raster 192x192 and 512x512 icons; and dedicated maskable versions with safe padding.

`client/index.html` will include the 180x180 Apple touch icon, theme color, Apple standalone capability, Apple status-bar preference, and an application title. Metadata must not depend on JavaScript execution.

The SVG remains the editable source. Generated PNGs are committed so installation does not depend on runtime conversion. Icons must remain recognizable under iOS rounded-square cropping, Android maskable cropping, small notification presentation, and light or dark wallpaper.

## Build-integrated app shell

The service worker must precache the exact current build output instead of guessing hashed filenames. A small supported build integration or repository-owned manifest-generation step will produce one release identifier and an explicit list containing the deployed HTML, fingerprinted initial JavaScript/CSS, manifest, committed icons, offline fallback, and essential local assets.

Installation succeeds atomically: a partially downloaded release never replaces the active release. Failed precaching leaves the previous worker and cache usable. Cache names use the generated release identifier rather than a manually incremented number.

## Runtime cache policy

| Request | Strategy | Reason |
| --- | --- | --- |
| Document navigation | Network first with a short timeout, then cached shell | Prefer fresh deployments while keeping offline launch reliable. |
| Fingerprinted first-party JS/CSS | Cache first | Filenames are immutable release content. |
| Manifest and icons | Stale while revalidate | Installation metadata remains available and refreshes safely. |
| Approved first-party images/fonts | Stale while revalidate with entry and age limits | Improve repeat use without unbounded storage. |
| `/api/**`, Supabase, authenticated or mutation requests | Network only; never Cache Storage | Account data belongs to Phase 2 synchronization. |
| Unknown cross-origin requests | Network only | Prevent opaque-response storage and uncontrolled growth. |

Only successful expected response types enter runtime caches. Redirected error pages, authentication failures, partial responses, and non-GET requests are excluded. Cleanup deletes only caches owned by this application.

## Update lifecycle

The current unconditional `skipWaiting()` behavior becomes controlled:

1. A new worker downloads and validates its shell while the current release continues serving the app.
2. The page detects a waiting worker and shows a compact “Update ready” action.
3. Before activation, the page asks an offline-work adapter whether pending work is durably stored. Phase 1 supports the quick-capture queue; Phase 2 implements the same interface for the operation log.
4. Secured work allows an immediate user-triggered update. Otherwise the current page remains active and explains what must finish.
5. The page sends an allowlisted activation message. The new worker activates, claims clients, and the page reloads once under the new release.
6. A loop guard prevents repeated activation reloads.

Phase 1 does not introduce forced updates.

## Offline and reconnection UX

A single controller provides semantic states rather than relying only on `navigator.onLine`: `online`, `checking`, `offline`, `reconnected`, and `update-ready`. A lightweight backend request verifies real connectivity and detects captive portals or false online signals.

The UI uses one quiet status surface rather than repeated toasts. Offline copy states exactly what remains available; queued captures show their count. “Try again” performs a bounded health check. Reconnected feedback disappears automatically but remains announced accessibly long enough to be understood.

Install guidance is contextual. Supporting browsers receive a user-triggered install action. iPhone Safari receives concise Add to Home Screen instructions. Standalone mode hides installation promotion. Dismissal is remembered locally and reversible in Settings.

## Security and privacy invariants

- No authenticated API body, authorization header, session, Supabase token, planner snapshot, or attachment enters Cache Storage.
- Offline shell responses never impersonate successful API responses.
- The worker handles only its own origin and expected routes.
- Notification destinations are normalized to same-origin routes before navigation.
- Update and worker messages use a small allowlisted schema.
- Cache keys ignore unsafe user-specific query parameters except explicitly designed public entry routes.
- Sign-out remains owned by authentication/synchronization, not shell caching.

## Failure handling

- First install while offline fails honestly; offline readiness is never claimed before one successful install.
- Precache failure retains the previous active worker/cache and retries later.
- A missing cached asset tries the network and otherwise shows the offline fallback instead of a blank screen.
- A corrupt or incompatible cache removes only the affected owned release cache.
- Quota pressure preserves the minimal shell and prunes optional runtime entries.
- Unsupported workers fall back to an ordinary web app and hide unsupported controls.
- Backend verification, not `navigator.onLine`, drives connectivity state.
- Updates never reload an active form without explicit activation.
- Push received during upgrade preserves current visible-notification and click behavior.

## Accessibility and premium UI requirements

- Status never relies on color alone.
- Install, retry, dismiss, and update controls meet 44pt phone targets.
- Announcements use restrained status semantics; only actionable failures use alerts.
- Reduced motion removes nonessential transitions.
- Text supports large type and long labels.
- Surfaces respect iPhone safe areas, portrait/landscape, and fixed navigation.
- Update prompts cannot obstruct account actions or trap focus.
- Loading, offline, update, and installed states follow the mineral/verdigris visual system.

## Verification strategy

Automated checks prove manifest fields and icon validity; generated precache/build agreement; API and sensitive-data cache exclusion; offline navigation after one online visit; honest cold-offline failure; failed-release rollback; explicit worker activation; scoped cache cleanup; unchanged push handlers; and stable online/offline/checking/reconnected transitions.

Browser acceptance covers desktop Chromium and 390x844 iPhone emulation: metadata, online first load, reload, offline reload, update-ready interaction, overflow, console errors, and Cache Storage inspection. A real iPhone Home Screen installation remains required because emulation cannot prove iOS icon cropping, standalone chrome, or OS cache behavior.

## Rollout and rollback

Release first to the workbench preview. Capture current production asset and worker identifiers. Verify Preview online, offline after a successful load, and through one worker upgrade. Promote only after automated and real-device checks pass.

Rollback returns routing to the last compatible deployment without clearing IndexedDB, quick captures, authentication, push subscriptions, planner records, or unrelated caches. A rollback worker removes only failed-release caches after the known-good shell installs successfully.

## Completion gate

Phase 1 completes only when manifest/icons install correctly, the production build owns a deterministic atomic shell cache, offline launch works after an online visit, API data remains outside Cache Storage, updates cannot destroy pending work, push handlers remain intact, automated checks pass, a real iPhone installation is reviewed, and handoff documents record exact evidence.
