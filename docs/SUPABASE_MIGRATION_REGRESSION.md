# Supabase Migration Regression Contract

The migration is accepted only when the application’s user-facing product remains behaviorally equivalent. The React/Vite frontend, Mineral Verdigris theme, typography, routes, navigation, task lanes, goals, projects, habits, reviews, calendar views, time blocks, drag-and-drop, recurrence, filters, analytics, offline capture, optimistic writes, keyboard commands, swipe gestures, and long-press actions are treated as frozen contracts.

The server contract is also frozen. Existing tRPC procedure names, input validation, returned field names, version-conflict behavior, workspace scoping, date/timezone rules, task-owned calendar reservations, habit completion/skip/undo semantics, review persistence, and push-subscription records must continue to behave the same after the provider change.

A release candidate must pass `pnpm check`, the complete Vitest suite, `pnpm run build:client`, the Supabase credential validation, an authenticated CRUD smoke test, an unauthenticated sign-in-gate test, a phone-width browser review, and a Vercel preview deployment. The authenticated smoke test must create and remove only clearly named disposable records and confirm persistence after refresh.

Rollback means restoring the last development-branch checkpoint, not running a destructive SQL reversal. The old database is not modified by the migration, the new Supabase project starts empty, and the Supabase SQL file remains versioned. If authentication, workspace isolation, a core CRUD flow, offline capture, calendar scheduling, habit tracking, or the Vercel runtime fails, the independent release is not promoted and the previous checkpoint remains the recovery target.

No external service is enabled implicitly. Supabase Auth and PostgreSQL are required for the independent path. Supabase Storage is used only for actual file features. VAPID push remains user-controlled and opt-in. AI/image generation requires a separately configured user-owned OpenAI-compatible provider; without one, the existing disclosed fallback is used. Scheduled reminders remain disabled until a user-owned scheduler secret and policy are configured.

## Pre-deployment service decisions

### VAPID and iPhone web push

Web Push remains user-owned through the VAPID key pair and the existing `web-push` server implementation. Apple documents that iOS 16.4 and later support web push for Home Screen web apps and that permission must be requested from a direct user gesture. The user must add the HTTPS site to the iPhone Home Screen, open it from that icon, tap the app’s enable-notifications control, allow notifications, and use the in-app test-device action. The service worker must display a notification immediately when Safari delivers a push; invisible pushes are not supported by Safari. [8] [9]

Required deployment variables are `VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`. The private key and subject remain server-only. No Apple Developer account is required for standards-based web push. Real delivery still requires a physical iPhone test after the HTTPS deployment exists.

### Analytics

The user approved Vercel Web Analytics for deployment traffic. Its React integration is mounted once without custom events or planner record fields. Existing user-facing analytics and planning insights continue to use private planner records. No retired analytics endpoint or website identifier is part of the independent build.

### Supabase Realtime

Realtime is intentionally deferred until authenticated CRUD and offline conflict behavior are proven. Supabase’s current Free limits list 200 concurrent connections and 100 messages per second. [10] A single-person planner does not need continuous database subscriptions to function because optimistic local writes and targeted query invalidation already provide immediate feedback. Enabling broad table subscriptions before row-level security is defined could leak records or duplicate optimistic updates. A later Realtime phase should enable only selected task/calendar channels, add row-level security policies, add the relevant tables to the `supabase_realtime` publication, and reconcile incoming changes by version rather than blindly replacing local state. [11]

### Authentication timing

Supabase Auth must be configured before deployment verification, not postponed until after deployment. The email provider should be enabled, the local development URL can be added for testing, and the final Vercel URL must be added to Site URL and Redirect URLs before a production sign-in test. The application’s existing planner UI remains unchanged; only the identity/session provider is replaced.

[8]: https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers "Apple — Sending web push notifications in web apps and browsers"
[9]: https://developer.mozilla.org/en-US/docs/Web/API/Push_API "MDN — Push API"
[10]: https://supabase.com/docs/guides/realtime/limits "Supabase — Realtime Limits"
[11]: https://supabase.com/docs/guides/realtime/postgres-changes "Supabase — Postgres Changes"

## Independent-stack identity and runtime audit

The active durable application identity is the integer `users.id`, linked to validated Supabase Auth through nullable UUID `users.authUserId`. Prior external identifiers are retained as provenance in `users.legacyExternalId`. The reviewed additive migration is `supabase/migrations/0001_independent_ownership.sql`; it preserves rows and leaves existing workspaces unclaimed until explicit assignment. The older `drizzle/0013_supabase_identity.sql` rename remains provenance and must not be applied as the current identity migration.

The active database adapter uses `drizzle-orm/node-postgres` with `pg`, reads only `SUPABASE_DB_URL`, and the Drizzle config uses PostgreSQL. Historical MySQL SQL and metadata remain migration provenance; application and Vercel runtime code do not import them. Retired OAuth, proxy-service, debug, and runtime integrations have been removed. Vercel Web Analytics provides deployment traffic analytics; scheduled notifications use the existing user-controlled VAPID sender. The dead owner-notification compatibility route has been removed.
