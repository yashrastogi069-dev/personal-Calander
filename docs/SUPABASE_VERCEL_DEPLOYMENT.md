# Supabase and Vercel deployment checklist

Deploy only `dev/personal-calendar-workbench` to the user's Vercel project. Do not merge or modify main. The connected database contains real planner data; use the [current handoff](INDEPENDENT_STACK_HANDOFF.md) for backup/audit and additive migration gates.

## Exact environment mapping

| Application variable | Value | Exposure |
|---|---|---|
| `VITE_SUPABASE_URL` | This project's HTTPS URL, also used by the server admin client | Public; required before Vite build |
| `VITE_SUPABASE_ANON_KEY` | Modern `sb_publishable_...` key, or the project's still-enabled legacy anon key | Public; required before build |
| `SUPABASE_SERVICE_ROLE_KEY` | Modern `sb_secret_...` key, or the project's still-enabled legacy service_role key | Server-only secret |
| `SUPABASE_DB_URL` | PostgreSQL Session Pooler URI from this project's Connect panel | Server-only secret |
| `VITE_VAPID_PUBLIC_KEY` | Existing VAPID public key | Public; required before build for enrolled devices |
| `VAPID_PRIVATE_KEY` | Matching existing VAPID private key | Server-only secret |
| `VAPID_SUBJECT` | Contact URI controlled by the user | Server-only configuration |
| `APP_ORIGIN` | Deployed HTTPS origin without a path | Server-only scheduler configuration |
| `REMINDER_CRON_SECRET` | Long random bearer secret matching the Vault value | Server-only secret |
| `OPENAI_BASE_URL` | Optional explicit OpenAI-compatible endpoint | Server-only configuration |
| `OPENAI_API_KEY` or `OPENROUTER_API_KEY` | Optional key for that explicitly selected provider | Server-only secret |
| `PERSONAL_CALENDAR_ICS_OVERLAY_URL` | Optional private read-only calendar URL | Server-only secret |

The variable names remain compatible with this codebase; they do not require legacy JWT-format API keys. Supabase's modern publishable keys belong in browser clients, while secret keys have elevated access and must stay on the backend. The installed Supabase SDK recognizes both formats. Creating modern keys does not itself revoke legacy keys. See [Supabase API key guidance](https://supabase.com/docs/guides/getting-started/api-keys).

Use the IPv4 Session Pooler connection supplied by Supabase, with its TLS configuration. A database URI is not an HTTPS REST URL. Never place database/admin/private-VAPID/cron secrets in `VITE_` variables, screenshots, source, or chat. Enter them locally in ignored `.env` or through the hosting dashboard. No extra external storage account is required.

## Schema, data and private files

1. Confirm the exact project, schema, journal and real row inventory. Take a recoverable database backup and preserve existing objects before changes.
2. Reconcile journal/schema history. On supported populated baseline tables, apply only reviewed `0001_independent_ownership.sql`, then `0002_private_planner_files.sql`. Never replay the baseline on this populated project.
3. Verify nullable UUID `users.authUserId`, preserved `legacyExternalId`, and nullable integer `workspaces.ownerUserId`. Sign-in creates/updates the durable profile; ownership assignment is a separate reviewed operation.
4. Verify `planner-files` is private, limited to 20971520 bytes, and allows PDF/text/JSON/JPEG/PNG/WebP. Inspect all existing policies for broader access. The four new Storage object policies restrict authenticated access to the user's first path segment; the server adds workspace ownership checks.
5. Preserve cancelled/failed file metadata so recurring reconciliation can remove late uploads. Download links last 300 seconds. Any existing legacy objects need an explicit inventory and separate reviewed transfer; creating the bucket does not migrate external objects automatically.

## Google OAuth and email

The app supports both Google and email/password. In Supabase Authentication, enable the desired providers and choose whether email confirmation is required. Email confirmation must be completed before login when enabled.

For Google, create a Web application OAuth client in the Google Auth Platform console. Add the app origins to its authorized JavaScript origins. Put the Supabase callback URL shown in the Google provider panel (normally `https://<project-ref>.supabase.co/auth/v1/callback`) in Google's authorized redirect URIs. Enter the resulting client ID/secret in Supabase's Google provider settings, not browser environment variables. Configure the consent audience/test users as appropriate. See [Supabase Google sign-in setup](https://supabase.com/docs/guides/auth/social-login/auth-google).

In Supabase Authentication URL Configuration, set Site URL to the intended deployment origin. Add the exact local/preview origins used by this app, for example `http://localhost:14772`, `http://localhost:14773`, and the actual Vercel preview origin. The app supplies `window.location.origin` as `redirectTo`; it must match the allowlist. Prefer explicit preview URLs rather than unnecessarily broad wildcards. See [redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls).

After signing in, an unlinked account should see the workspace connection message. Verify the Supabase UUID, durable integer user ID, and intended existing workspace before assigning ownership. Do not treat this state as permission to create or claim arbitrary workspaces.

## Vercel setup

Use a separate project, repository root, and the committed `vercel.json`: `pnpm run build:client`, `dist/public`, and the server adapter bundle. Add values for Preview first, redeploy after public build-time values change, and preserve the existing main project's settings. Preview branch deployment does not require a main merge.

Enable Web Analytics in this Vercel project. The application mounts Analytics once, strips query/fragment/private path data from page URLs, and sends no custom planner events. Existing private planner analytics continue to use the user's records.

## Scheduled reminders and file cleanup

Configure `APP_ORIGIN` and `REMINDER_CRON_SECRET` on the server. In Supabase Vault create:

- `personal_calendar_reminder_url`: the HTTPS deployment URL ending `/api/scheduled/reminder`.
- `personal_calendar_reminder_secret`: exactly the same bearer secret.

Review/install `supabase/cron/reminder_sweep.sql` only after the deployment and migrations are verified. It requires available pg_cron/pg_net/Vault, rejects missing values, and replaces only `personal-calendar-reminder-sweep`. It runs every five minutes. Existing rule times and per-device delivery idempotency remain unchanged; arbitrary non-five-minute rule times need a separate cadence/window decision.

The endpoint accepts GET/POST with `Authorization: Bearer <secret>`, rejects other methods, returns 503 for missing configuration and 401 for invalid credentials, and never derives links from request Host headers. Success includes `reminders` and `storageCleanup`; failures return a generic 500. Cleanup runs independently of push success and repeats on later sweeps. Verify any Vercel deployment protection permits the configured automation to reach this endpoint.

Pause reminder rules in the app to stop notifications while preserving cleanup. Unscheduling the shared job also stops automatic file reconciliation. Keep the existing VAPID pair to avoid breaking enrolled devices.

## Verification and rollback

Local 2026-09-06 verification: TypeScript passed, **200 tests / 48 files** passed, and the Vercel client/server build passed with the known large-client-chunk warning. Preview scripts use intercepted synthetic data and do not prove live login, ownership assignment, service access, or scheduled delivery.

After the live upgrade, compare real record counts and verify Google/email login, reload, Home/Calendar, sign-out and cross-account denial. Use named disposable records only for authorized write checks. Confirm a manual device push, Cron HTTP outcome, and later a real scheduled delivery before relying on reminders.

If rollout fails, stop new writes and use a known compatible deployment. Preserve additive schema, auth mappings, metadata, real planner records and the VAPID pair. Do not reset the database or drop columns/buckets as a rollback shortcut. Review any restore against post-backup writes first. Keep main untouched throughout.
