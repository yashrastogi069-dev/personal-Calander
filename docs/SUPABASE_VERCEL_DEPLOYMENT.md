# Supabase Free + Vercel Deployment Checklist

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

The repository contains the generated schema at `supabase/migrations/0000_loving_madrox.sql`. In the Supabase dashboard, open **SQL Editor**, create a new query, paste the complete file contents, and click **Run**. This creates the 30 planner tables and the `updatedAt` trigger function. The project has no important user data to import, so this is a new empty database setup.

After the query completes, open **Table Editor** and confirm that tables such as `users`, `workspaces`, `tasks`, `goals`, `projects`, `habits`, `habitCheckIns`, `dailyPlans`, `reviewSessions`, and `pushSubscriptions` exist.

## Configure Supabase Auth

Open **Authentication → Providers** and enable **Email**. For the first private deployment, email/password is the simplest path. In **Authentication → URL Configuration**, set **Site URL** to the Vercel production URL and add the Vercel preview URL pattern if preview testing is required. Email confirmation may remain enabled; if it is enabled, a new account must confirm its email before the first sign-in.

## Vercel project setup

Import the GitHub repository `yashrastogi069-dev/personal-Calander`, select the branch `dev/personal-calendar-workbench` after import, and use the repository root. Add all variables above to **Preview** and **Production** as appropriate. Redeploy after adding or changing variables because `VITE_` values are embedded during the client build.

The first deployment should be tested in this order: open the site, create an account, confirm the email if required, sign in, create a disposable task, refresh, move it between task lanes, open Calendar, create a time block, open Habits, complete and undo a check-in, sign out, and sign in again. Remove only the disposable records after validation.

## User-owned service boundaries

The core planner currently does not upload avatars, attachments, or generated media, so **no R2 or storage credential is required for this release**. If a future feature needs files, use a private Supabase Storage bucket first and add a separate bucket provider only after an explicit decision. Never place storage service keys in `VITE_` variables.

Analytics is intentionally disabled in the independent build. No Manus analytics endpoint or website ID should be added to Vercel. If analytics is wanted later, choose a separate account or self-hosted service and add it as an explicit, documented feature.

This migration does not enable scheduled reminders automatically. The scheduled route returns a clear not-configured response until a user-owned Vercel Cron secret and delivery policy are approved. Push delivery continues to use the user’s VAPID keys. The optional AI companion still requires a separate user-owned OpenAI-compatible provider decision; no Manus AI key should be added to this Vercel project.
