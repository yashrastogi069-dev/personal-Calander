# Reliable PWA, Sync, and Notifications Roadmap

Status: approved product direction; Phase 1 implemented and locally verified, Preview/device gates pending.

Last updated: 2026-09-12

## Product principles

1. The planner must remain useful online and offline.
2. Synchronization must never silently discard a local or server value.
3. Non-overlapping field changes merge automatically. Overlapping changes remain available for explicit review.
4. Delete moves a record to an indefinite recycle bin. Permanent deletion requires a separate, explicit in-app confirmation.
5. Signing out preserves account-scoped cached data and pending work on the device, but the signed-out UI and other accounts cannot display it.
6. Reliability and continuity take priority, while privacy controls should remain low-friction.
7. Notifications and integrations cannot activate until identity, authorization, and synchronization are healthy.
8. Each phase includes its own UI/UX and accessibility acceptance criteria. A final polish phase reviews the experience as a whole.

## Phase 1: installable and reliable PWA shell

Deliver a complete manifest and icon set, iPhone standalone metadata, deterministic app-shell precaching, safe runtime cache strategies, controlled service-worker updates, offline fallback, and clear install/offline/update/reconnected states.

Authenticated API responses are never stored in Cache Storage. Phase 1 makes the application shell reliably available offline; Phase 2 owns offline account data.

Detailed design: `docs/superpowers/specs/2026-09-12-reliable-pwa-foundation-design.md`.

Local implementation evidence (2026-09-12): deterministic release `a5f1f2018fa6b158`, 20 public shell files, full TypeScript/test/build gate, cached offline relaunch at desktop and 390x844, honest cold-offline behavior, explicit waiting-update activation, preservation of unrelated caches, and no API/private Cache Storage entries. Vercel Preview and real-iPhone installation remain required before Phase 1 is release-complete.

## Phase 2: lean secure synchronization

Use account-scoped IndexedDB storage for the latest workspace snapshot and an immutable queue of pending operations. Continue using existing backend ownership checks and record versions. Reconnect by replaying idempotent operations, resolving safe field merges, retaining overlapping conflicts for review, then downloading a fresh complete workspace snapshot.

The first release intentionally excludes CRDTs, real-time collaborative editing, complex incremental feeds, device administration, and diagnostic export. A separate design and implementation plan will define exact schemas and supported offline mutations after Phase 1 passes its production gate.

## Phase 3: phone notifications, reminders, and calendar bridges

Notifications are device-specific and opt-in. Reminder rules are account data and synchronize through the backend. Activation requires a linked identity, healthy sync, a compatible installed PWA, an explicit user gesture, and a valid device subscription.

The Apple Calendar bridge remains standards-based: a private revocable outbound calendar subscription, a read-only inbound ICS availability overlay, and one-off `.ics` export. Native EventKit and credential-based Apple account access are outside a web PWA and remain deferred.

## Phase 4: holistic phone UI/UX polish

Review install/onboarding, sync status, conflict review, recycle bin, offline and slow-network states, notification readiness, integration health, safe-area behavior, gestures and visible alternatives, large text, reduced motion, dark mode, account actions, and recovery paths as one coherent iPhone experience.

## Release gates

Each phase requires passing TypeScript, automated tests, production build, offline browser scenarios, 390×844 iPhone layout checks, accessibility checks, deployment verification, and an updated handoff record. Phase 3 additionally requires a real installed-iPhone notification test. No database reset, baseline replay, or record-ID replacement is permitted.
