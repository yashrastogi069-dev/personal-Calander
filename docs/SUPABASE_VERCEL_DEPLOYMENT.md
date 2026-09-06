# Supabase Free + Vercel Deployment Checklist

**Current migration instructions:** [Independent stack handoff](INDEPENDENT_STACK_HANDOFF.md). The database contains real planner data. Do not replay the baseline or assume it is empty.

This guide deploys the `dev/personal-calendar-workbench` branch to a Vercel project owned by the user. The frontend, planner routes, visual system, and phone behavior are not changed by this setup. The Supabase project supplies the account system and PostgreSQL database.

## Required Vercel variables

| Variable | Visibility | Source | Purpose |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Public configuration | Supabase Project Settings → API → Project URL | Browser client endpoint. |
| `VITE_SUPABASE_ANON_KEY` | Public configuration | Supabase Project Settings → API → Publishable/anon public key | Browser-safe Supabase Auth key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Supabase Project Settings → API → service_role key | Server-only user validation and privileged planner access. Never expose it in client code. |
| `SUPABASE_DB_URL` | Secret | Supabase Project Settings → Database → Connect → Session Pooler URI | Server-side Drizzle PostgreSQL connection. Keep `?sslmode=require`. |
| `VITE_VAPID_PUBLIC_KEY` | Public configuration | User’s existing VAPID key pair | Browser push subscription. |
| `VAPID_PRIVATE_KEY` | Secret | User’s existing VAPID key pair | Server-side push signing. |
| `VAPID_SUBJECT` | Secret/configuration | A `mailto:` address controlled by the user | Web Push contact identity. |

The database URI should use the IPv4 Session Pooler form supplied by Supabase. Do not use `/rest/v1/` in the database URI. Do not place the database URI, service-role key, or private VAPID key in a variable beginning with `VITE_`.

## Apply the schema

The repository contains the baseline at `supabase/migrations/0000_loving_madrox.sql` and the additive upgrade at `supabase/migrations/0001_independent_ownership.sql`. Existing populated databases require inspection and only the applicable upgrade, followed by explicit workspace ownership assignment. Use the current handoff above. The baseline is only for a verified empty database.

After the query completes, open **Table Editor** and confirm that tables such as `users`, `workspaces`, `tasks`, `goals`, `projects`, `habits`, `habitCheckIns`, `dailyPlans`, `reviewSessions`, and `pushSubscriptions` exist.

## Configure Supabase Auth

Open **Authentication → Providers** and enable **Email**. For the first private deployment, email/password is the simplest path. In **Authentication → URL Configuration**, set **Site URL** to the Vercel production URL and add the Vercel preview URL pattern if preview testing is required. Email confirmation may remain enabled; if it is enabled, a new account must confirm its email before the first sign-in.

## Vercel project setup

Import the GitHub repository `yashrastogi069-dev/personal-Calander`, select the branch `dev/personal-calendar-workbench` after import, and use the repository root. Add all variables above to **Preview** and **Production** as appropriate. Redeploy after adding or changing variables because `VITE_` values are embedded during the client build.

The first deployment should be tested in this order: open the site, create an account, confirm the email if required, sign in, create a disposable task, refresh, move it between task lanes, open Calendar, create a time block, open Habits, complete and undo a check-in, sign out, and sign in again. Remove only the disposable records after validation.

## User-owned service boundaries

The core planner currently does not upload avatars, attachments, or generated media, so **no R2 or storage credential is required for this release**. If a future feature needs files, use a private Supabase Storage bucket first and add a separate bucket provider only after an explicit decision. Never place storage service keys in `VITE_` variables.

Vercel Web Analytics is mounted once at the application root. Enable Web Analytics in the user-owned Vercel project. No custom events or planner record fields are sent; the existing private planner insights remain unchanged. Do not copy retired analytics endpoints or website identifiers into the new project.

Scheduled reminders and cancelled-file cleanup use the shared authenticated `/api/scheduled/reminder` handler. Configure server-only `APP_ORIGIN` and `REMINDER_CRON_SECRET`, matching Supabase Vault values, and the reviewed five-minute Cron job before relying on scheduled delivery. Push uses the existing VAPID pair. The optional AI companion requires explicitly configured user-owned endpoint/key values; never copy retired AI service credentials.
