# Supabase Migration Regression Contract

The migration is accepted only when the application’s user-facing product remains behaviorally equivalent. The React/Vite frontend, Mineral Verdigris theme, typography, routes, navigation, task lanes, goals, projects, habits, reviews, calendar views, time blocks, drag-and-drop, recurrence, filters, analytics, offline capture, optimistic writes, keyboard commands, swipe gestures, and long-press actions are treated as frozen contracts.

The server contract is also frozen. Existing tRPC procedure names, input validation, returned field names, version-conflict behavior, workspace scoping, date/timezone rules, task-owned calendar reservations, habit completion/skip/undo semantics, review persistence, and push-subscription records must continue to behave the same after the provider change.

A release candidate must pass `pnpm check`, the complete Vitest suite, `pnpm run build:client`, the Supabase credential validation, an authenticated CRUD smoke test, an unauthenticated sign-in-gate test, a phone-width browser review, and a Vercel preview deployment. The authenticated smoke test must create and remove only clearly named disposable records and confirm persistence after refresh.

Rollback means restoring the last development-branch checkpoint, not running a destructive SQL reversal. The old database is not modified by the migration, the new Supabase project starts empty, and the Supabase SQL file remains versioned. If authentication, workspace isolation, a core CRUD flow, offline capture, calendar scheduling, habit tracking, or the Vercel runtime fails, the independent release is not promoted and the previous checkpoint remains the recovery target.

No external service is enabled implicitly. Supabase Auth and PostgreSQL are required for the independent path. Supabase Storage is used only for actual file features. VAPID push remains user-controlled and opt-in. AI/image generation requires a separately configured user-owned OpenAI-compatible provider; without one, the existing disclosed fallback is used. Scheduled reminders remain disabled until a user-owned scheduler secret and policy are configured.
