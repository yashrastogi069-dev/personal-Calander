# Independent Ownership Migration Plan

**Scope:** Remove the current Manus OAuth and Manus-owned runtime dependencies from Personal Calendar. This document is an architecture decision record, not an authorization to delete the working path or migrate user data.

## Executive conclusion

The current app is not a static Vite site. Its authenticated planner depends on a server session, a relational database, server-side helpers, and browser configuration. The blank Vercel deployment exposed this dependency clearly: the client shell loaded, but protected planner queries returned 500 because the current auth session was missing.

The recommended user-controlled replacement is a **Supabase project owned by the user**, paired with Vercel hosting owned by the user. Supabase can provide managed PostgreSQL, email/password or magic-link authentication, row-level security, Storage, and Realtime in one account. Its official documentation also supports self-hosting with Docker for a later phase when the user wants to operate the infrastructure themselves. [1] [2] [3]

This recommendation does not mean that Supabase is owned by Manus or an AI service. It is a separate provider. However, a hosted Supabase project is still a third-party cloud service. Full infrastructure ownership would require self-hosting PostgreSQL, the auth service, storage, and realtime components on a server the user administers.

## Current dependency inventory

| Current dependency | Evidence in this repository | Replacement target |
|---|---|---|
| Manus OAuth login and callback | `/api/oauth/callback`, `server/_core/oauth.ts`, `server/_core/sdk.ts`, `client/src/_core/hooks/useAuth.ts`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `VITE_APP_ID` | Supabase Auth with an application-owned email/password or magic-link flow. Social login is optional and must be explicitly enabled by the user. |
| Manus session identity | `ctx.user`, `sdk.authenticateRequest`, `protectedProcedure`, `users` table | Supabase Auth user ID validated server-side; application profile row linked to `auth.users.id`. |
| MySQL/TiDB persistence | `mysql2`, Drizzle schema, `DATABASE_URL`, `server/db.ts` | Supabase PostgreSQL. Schema and SQL types must be migrated deliberately; no destructive conversion in a Vercel build. |
| Manus built-in server API | `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`, server helpers | Explicit service interfaces or user-selected providers. Do not replace with hidden proxy calls. |
| Manus browser API | `VITE_FRONTEND_FORGE_API_URL`, `VITE_FRONTEND_FORGE_API_KEY` | Remove unless a user-owned public service is actually required. |
| Manus storage proxy/S3 helper | `server/storage.ts`, `storagePut`, `storageGet`, `storageProxy` | Supabase Storage or an S3-compatible bucket owned by the user. Existing file metadata must be migrated separately if any files exist. |
| Manus owner notifications | `server/_core/notification.ts`, `BUILT_IN_FORGE_API_*` | Web Push using the user’s VAPID keys; email is optional and requires a user-owned provider. |
| Manus analytics configuration | `VITE_ANALYTICS_ENDPOINT`, `VITE_ANALYTICS_WEBSITE_ID` | User-owned analytics property, self-hosted analytics, or no analytics. |
| Manus project identity/config | `OWNER_OPEN_ID`, `OWNER_NAME`, several pre-injected system variables | Local application profile and explicit user-owned environment values. |
| Manus framework assumptions | `server/_core/context.ts`, `trpc`, Vercel adapter imports | Keep Express/tRPC/Drizzle only where useful, but remove Manus-specific auth/runtime calls behind explicit owned interfaces. |

## TiDB comparison and revised decision rule

TiDB Cloud Starter must be considered seriously because the current application uses MySQL-compatible Drizzle and `mysql2`. TiDB is highly compatible with MySQL 5.7/8.0 and the MySQL protocol, so it can preserve the existing database driver, much of the current schema, and the server query layer with substantially less database migration risk than moving to PostgreSQL. [6] This directly addresses the user’s requirement that the frontend and existing feature behavior remain unchanged.

TiDB Cloud Starter currently provides a free quota of **5 GiB row storage, 5 GiB columnar storage, and 50 million Request Units per month per instance**, with up to five free-quota instances in an organization. When a Free instance exhausts its quota, TiDB states that new connection attempts are denied or throttled until the monthly reset or a quota change. [7] This is a different failure mode from Supabase Free, where inactivity pausing is the main concern. TiDB’s free database capacity is materially larger for this personal planner than Supabase’s 500 MB database allowance.

TiDB is a **database**, not a complete application backend. It does not replace authentication, session management, private file storage, web-push delivery, or analytics. A TiDB-first independent architecture would therefore require an application-owned authentication implementation plus separate user-controlled storage and notification choices. This adds more components and more security work than Supabase, even though it reduces database compatibility risk.

| Decision criterion | Supabase Free | TiDB Cloud Starter Free |
|---|---|---|
| Current schema/driver compatibility | Requires MySQL-to-PostgreSQL migration and review of types, enums, timestamps, indexes, and queries | Strongest match for the current MySQL-compatible Drizzle/`mysql2` stack |
| Authentication | Included through Supabase Auth | Not included; must be implemented and operated by the application or a separate provider |
| Storage | Included private Storage allocation | Not an application file-storage service; add a separate bucket or remove file features |
| Realtime | Included ecosystem capability, but should remain optional | Database platform; realtime delivery must be added separately |
| Free capacity | 500 MB database, 1 GB file storage, 5 GB egress, 50,000 MAU | 5 GiB row, 5 GiB columnar, 50M RUs per month per free-quota instance |
| Free-plan risk | Possible pause after one week of inactivity | Quota exhaustion can deny new connections until reset |
| Best match | Fewest services and easiest independent auth/backend bundle | Lowest risk of changing existing planner persistence behavior |

**Revised recommendation:** because the user’s highest priority is “nothing in the application should change or break,” do not approve a Supabase migration yet. First prototype the authentication boundary independently while retaining the current MySQL-compatible data contract, then test the app against TiDB Cloud Starter using a disposable database. If the TiDB route passes the full regression suite, it is the safer first database destination. Supabase remains a valid fallback if the user values one integrated platform more than minimizing database changes.

## Target architecture

The frontend remains React/Vite and the existing tRPC contract remains the application boundary during the first migration. This reduces UI risk. The server context changes from Manus session discovery to a Supabase server client that validates the bearer/cookie session and resolves the application profile. Protected procedures continue to reject unauthenticated calls with a normal `UNAUTHORIZED` response rather than allowing the app to hang.

The database should move from MySQL/TiDB to PostgreSQL through a schema-first migration. The existing planner vocabulary—tasks, goals, projects, habits, reviews, reservations, and audit records—must remain intact. Migration work must include a dry-run schema comparison, a disposable test database, explicit timestamp and enum mapping, and a user-approved data migration plan before production records are copied.

| Layer | User-controlled target | Required boundary |
|---|---|---|
| Hosting | User-owned Vercel account/project | Production branch set only to `dev/personal-calendar-workbench` until the user explicitly promotes it. |
| Authentication | Supabase Auth in the user’s project | Email/password or magic link first; callback URLs limited to user-owned domains. |
| Database | Supabase PostgreSQL in the user’s project | RLS or server-only access; no production migration until backup and dry run. |
| Files | Supabase Storage bucket or user-owned S3/R2 bucket | Private buckets by default; signed URLs; metadata and authorization separate from bytes. |
| Push | Existing user-owned VAPID key pair | Private key server-only; subscription records scoped to the authenticated user. |
| Analytics | User-owned provider or disabled | No analytics value copied from the Manus-backed project unless user owns that account. |
| External calendar | Optional read-only ICS | Server-only secret URL, SSRF controls, no external writes. |

## What must not happen

Do not delete Manus framework files before the replacement auth path works. Do not point a new independent app at the existing production database unless the user explicitly wants shared records. Do not invent OAuth URLs, user IDs, database URLs, or API keys. Do not run schema migration commands against an important database as part of a Vercel build. Do not place database credentials, private VAPID keys, or calendar feed URLs in `VITE_` variables.

The migration also must not silently remove features that currently use the Manus built-in API. Each call site must be classified as required, replaceable, or removable. If a feature has no user-owned replacement, it should fail with a clear local explanation—not a blank screen.

## Free-tier decision

For the first independent release, use **Supabase Free** as the single backend platform. This is the best fit for this personal, phone-first planner because it avoids stitching together separate authentication, database, storage, and realtime providers. The current official Free plan includes unlimited API requests, 50,000 monthly active users, a 500 MB PostgreSQL database, 5 GB egress, 5 GB cached egress, 1 GB file storage, and a limit of two active projects. A Free project may pause after one week of inactivity, so the app must tolerate a cold start and the user should open the project periodically during development. [4]

This capacity is more than sufficient for one personal account and normal planner data. Tasks, goals, projects, habits, reviews, time blocks, and analytics summaries are text-and-number records and should remain far below 500 MB for a long time. The 1 GB file limit is also ample if the app stores only small attachments or avatars. To avoid accidental charges, do not add a paid plan or paid add-ons, do not enable unnecessary phone MFA, and do not create extra Supabase projects beyond the two-project Free limit.

The free tier does not provide the same operational guarantees as a paid production plan: the pricing table lists no included automatic backups for Free, and inactivity pausing is possible. Therefore, the migration must include an exportable backup procedure and the app must retain its offline queue. Supabase is the recommended **free managed option**, not a claim that the user owns the physical infrastructure. If absolute infrastructure ownership is required later, self-hosted Supabase on a user-controlled server is the next option, but the user then owns patching, security, backups, uptime, and disaster recovery. [5]

| Requirement | Free-tier choice | Decision |
|---|---|---|
| Auth | Supabase Auth email/password or magic link | Use first; avoid social providers and paid phone MFA initially. |
| Planner database | Supabase PostgreSQL | Use the 500 MB allocation with RLS and an export backup routine. |
| Realtime | Supabase Realtime only for narrowly scoped planner changes | Keep optional; local optimistic writes remain the primary phone experience. |
| Files | Supabase Storage, private bucket | Use only when the product actually needs files; keep the 1 GB allocation in mind. |
| Push notifications | User’s VAPID keys with the existing web-push implementation | No Manus notification service. |
| Hosting | User-owned Vercel Hobby project | Separate project and environment variables from the Manus-backed deployment. |
| Analytics | Disabled initially or a separate user-owned free analytics property | Never retain Manus analytics configuration by default. |

## Credentials required from the user before implementation

The user must first create or choose a Supabase project in an account they control and decide whether the database should be new or a deliberate import. The minimum values needed for the first auth/database scaffold are:

| Value | Purpose | Where it comes from |
|---|---|---|
| Supabase project URL | Server and client project address | Supabase Project Settings → API |
| Supabase publishable/anon key | Browser-safe client access governed by RLS | Supabase Project Settings → API |
| Supabase service-role key | Server-only admin operations, only if strictly required | Supabase Project Settings → API; never expose it |
| New database connection string | Drizzle/Postgres migration and server access | Supabase Project Settings → Database |
| Site URL and redirect URLs | Auth callback allowlist | Supabase Auth → URL Configuration and the user’s Vercel domains |
| Email delivery choice | Password reset/magic-link delivery | Supabase built-in email for testing or a user-owned SMTP provider for production |

No secret should be sent in ordinary chat. It should be entered through the project’s secure secret configuration when the user is ready.

## Migration phases

The safe order is: first create a user-owned Supabase project and disposable database; second add an ownership-neutral auth adapter alongside the existing Manus adapter; third add a user-owned login screen and explicit unauthenticated state; fourth port the schema and tests to PostgreSQL; fifth migrate storage and push subscriptions; sixth remove Manus imports and environment variables only after a dependency scan and production-like acceptance; and finally deploy the independent project to a separate Vercel project.

At every phase, `main` remains untouched. The development branch receives a checkpoint, the complete tests run, and the old working path remains available until the replacement has passed authentication, data isolation, CRUD, calendar reservation, habit tracking, offline capture, and phone acceptance tests.

## References

[1]: https://supabase.com/docs/guides/auth "Supabase Docs — Auth"
[2]: https://supabase.com/docs/guides/database/overview "Supabase Docs — Database overview"
[3]: https://supabase.com/docs/guides/self-hosting "Supabase Docs — Self-hosting"
[4]: https://supabase.com/pricing "Supabase Pricing — Free plan limits"
[5]: https://supabase.com/docs/guides/self-hosting "Supabase Docs — self-hosting responsibilities"
[6]: https://docs.pingcap.com/tidb/stable/mysql-compatibility/ "TiDB Docs — MySQL compatibility"
[7]: https://docs.pingcap.com/tidbcloud/select-cluster-tier/ "TiDB Cloud Docs — Starter free quota and limits"
