# Beginner Guide: Vercel Environment Variables for Personal Calendar

**Purpose:** This guide explains what each variable means, where it comes from, what you personally need to create, and exactly where to enter it in Vercel. It is written for the separate Vercel project that will use `dev/personal-calendar-workbench`.

> Important: the approved target is the independent Supabase architecture. Do not copy Manus OAuth, Forge, owner, or Manus analytics variables into the new project. Use the Supabase values listed below and the companion checklist in `docs/SUPABASE_VERCEL_DEPLOYMENT.md`.

## Part 1 — Decide which setup you want

There are two different setups. Choose deliberately before entering values.

| Setup | What it means | What you need to do |
|---|---|---|
| **Current architecture** | Your Vercel project is yours, but the application still uses the existing Manus auth/service contracts. | Copy the matching values from the working main Vercel project or its project configuration. Do not copy its database if you do not want shared data. |
| **Fully independent architecture** | Vercel hosts your app while Supabase supplies your user-controlled authentication, PostgreSQL, and optional Storage/Realtime; VAPID remains yours. | This is the approved target for this development branch. Apply the checked-in Supabase SQL migration and use the independent variables below. |

For this branch, use **a separate Vercel project with the independent Supabase architecture**. The existing main Vercel project remains untouched. The current old-architecture instructions are retained below only as history and must not be used for this independent deployment.

## Part 2 — Create the separate Vercel project

Open [Vercel](https://vercel.com) and select the correct team. Choose **Add New → Project**, then import `yashrastogi069-dev/personal-Calander`. If the import page only shows `main`, that is acceptable for creating the separate project; do not change the existing main-backed Vercel project.

Use a new project name such as `personal-calendar-workbench`. Keep **Root Directory** as `./`, which means the repository root. Do not use `client/`. The repository’s committed `vercel.json` supplies the build and output configuration.

After the project is created, open the new project and go to **Settings → Git**. Set **Production Branch** to exactly:

```text
dev/personal-calendar-workbench
```

Then go to **Settings → Environment Variables**. Add the variables described below. For each one, choose **Preview** and **Production** as the environments, unless you intentionally want to test Preview first and add Production later.

## Part 3 — The three boxes Vercel asks you to fill

Every Vercel variable has three important fields.

| Vercel field | What to enter |
|---|---|
| **Key** | The variable name exactly as written below, including capital letters and underscores. |
| **Value** | The actual value from your service/account. Never type the explanatory text. |
| **Environment** | Select **Preview** and **Production** for the separate project. |

If Vercel asks for visibility, use **Configuration** for names beginning with `VITE_`. Do not choose Secret for a `VITE_` variable; Vercel rejects that combination because Vite embeds public-prefixed values into browser code. Use Secret/Sensitive only for server-only values.

## Part 4 — Variables you need and where to get them

### A. Supabase database and sessions

| Key | Plain-English meaning | Where to get it | Visibility |
|---|---|---|---|
| `SUPABASE_DB_URL` | The private PostgreSQL connection address for tasks, goals, habits, reviews, and calendar data. | Supabase Project Settings → Database → Connect → Session Pooler URI. Keep `?sslmode=require` at the end. | Secret/Sensitive |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key used to validate the authenticated Supabase user and resolve the application profile. | Supabase Project Settings → API → service_role key. | Secret/Sensitive |

**Do not test `SUPABASE_DB_URL` by pasting it into a browser.** It is not a web address for a normal browser. Paste it only into Vercel’s value field.

### B. Supabase authentication

These values belong to the user-controlled Supabase authentication integration. They must come from your own Supabase project.

| Key | Meaning | Where to get it | Visibility |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Identifies your Supabase project. | Supabase Project Settings → API → Project URL. | Configuration |
| `VITE_SUPABASE_ANON_KEY` | Browser-safe key for your Supabase project. | Supabase Project Settings → API → Publishable/anon public key. | Configuration |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key used to validate Supabase sessions. | Supabase Project Settings → API → service_role key. | Secret/Sensitive |
| `SUPABASE_DB_URL` | Server-only PostgreSQL connection using the IPv4 Session Pooler. | Supabase Project Settings → Database → Connect → Session Pooler URI, retaining `?sslmode=require`. | Secret/Sensitive |
| `VITE_VAPID_PUBLIC_KEY` | Browser-safe public key for your own web-push subscription. | Your existing VAPID credentials. | Configuration |

Do not add `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `OWNER_OPEN_ID`, or `OWNER_NAME` to the independent project. The independent branch no longer actively uses the Manus OAuth route.

### C. Optional user-owned services

| Key | Meaning | Where to get it | Visibility |
|---|---|---|---|
| `OPENAI_BASE_URL` | Optional OpenAI-compatible endpoint for the AI companion. | Add only if you explicitly choose a user-owned AI provider; otherwise leave unset. | Secret/Config |
| `OPENAI_API_KEY` or `OPENROUTER_API_KEY` | Optional server-only key for that provider. | Add only if you explicitly choose that provider; never copy a Manus key. | Secret/Sensitive |
| `PERSONAL_CALENDAR_ICS_OVERLAY_URL` | Optional private read-only calendar feed. | Add only if you intentionally configure the ICS overlay. | Secret/Sensitive |
| `VITE_APP_TITLE` | Optional title override. | Use `Personal Calendar` or your preferred name. | Configuration |

A `VITE_` key is not automatically private. Treat its value as visible to a website visitor. Do not add any `BUILT_IN_FORGE_*` or `VITE_FRONTEND_FORGE_*` variables to the independent project.

### D. App name and logo

| Key | Meaning | Where to get it | Visibility |
|---|---|---|---|
| `VITE_APP_TITLE` | The title shown by the application. | Type `Personal Calendar`, or your preferred name. | Configuration |
| `VITE_APP_LOGO` | Logo URL or configured logo value used by the app. | Use the value already used by the working project, or a public image URL you own. Do not paste a local computer path. | Configuration |

### E. Analytics

| Key | Meaning | Where to get it | Visibility |
|---|---|---|---|
| `VITE_ANALYTICS_ENDPOINT` | Address of your analytics service. | Copy from the analytics provider account you own, or copy the working project only if intentionally sharing analytics. | Configuration |
| `VITE_ANALYTICS_WEBSITE_ID` | The site/property identifier in that analytics account. | Create a website/property in your analytics account and copy its ID. | Configuration |

If you do not want analytics, leave these unset only if the application has been configured to disable analytics. Do not enter random values.

### F. Push notifications

You said you have VAPID credentials. They are normally three values created for the same notification application.

| Key | What to paste |
|---|---|
| `VITE_VAPID_PUBLIC_KEY` | Your VAPID public key. This may be visible in browser code. |
| `VAPID_PRIVATE_KEY` | Your VAPID private key. Keep it secret. |
| `VAPID_SUBJECT` | A contact identifier for the notification sender, usually a `mailto:you@example.com` address or an HTTPS URL that you control. |

Do not swap the public and private keys. Do not put the private key in a `VITE_` variable. If you generated the keys yourself, reuse them for this project only if you know where they are stored and you control the associated subject.

### G. Optional external calendar overlay

| Key | When to add it |
|---|---|
| `PERSONAL_CALENDAR_ICS_OVERLAY_URL` | Leave this empty for now. Add it only if you intentionally configure the optional read-only ICS overlay and understand that the URL is sensitive. Never add it as a `VITE_` value, expose it to the browser, or paste it into a screenshot or chat. |

## Part 5 — What to copy from the working main project

If you choose the current architecture, open the **working main Vercel project** in another browser tab. Go to **Settings → Environment Variables**. You may see secret values hidden. That is expected. Vercel normally does not show a secret’s original plaintext again.

For a visible configuration value, copy the value exactly. For a hidden secret, do not guess and do not paste asterisks. Get the original value from the service/account that created it, or create a new value when this guide explicitly says that is safe, such as a new `JWT_SECRET`.

Do not copy `DATABASE_URL` from main if you do not want the new app to read or change the same personal planning data. Connecting both projects to the same database means both deployments can read and write the same tasks and goals.

## Part 6 — Exact order for adding the variables

Start with the new Vercel project, not the existing main project.

1. Open **Settings → Environment Variables**.
2. Click **Add New**.
3. Enter one Key exactly.
4. Paste its Value into the value field.
5. Select **Preview** and **Production**.
6. Choose **Configuration** for `VITE_*` values and Secret/Sensitive for server-only secrets.
7. Save the variable.
8. Repeat until all required values are added.
9. Look through the list for duplicate keys. If a key appears twice, remove the incorrect duplicate rather than hoping Vercel chooses the right one.
10. Go to **Settings → Git** and set Production Branch to `dev/personal-calendar-workbench`.
11. Go to **Deployments** and deploy/redeploy the dev branch.

## Part 7 — First deployment checks

After the deployment says **Ready**, open its deployment URL. Confirm the deployment source is `dev/personal-calendar-workbench`, not `main`. Then open these paths:

| Path | Expected result |
|---|---|
| `/` | The Personal Calendar shell loads, then shows login or the authenticated workspace. |
| `/calendar` | The task execution Calendar loads after authentication. |
| `/api/health` | A health response appears if this project exposes the health route. |
| Login | The login flow redirects to the configured auth portal and returns to this project’s domain. |

If you see a blank page and the Vercel logs say `Auth Missing session cookie`, the build succeeded but the app is not authenticated. First check the new project’s auth variables and auth callback/domain configuration. Do not “fix” it by putting secrets in frontend code.

If you see an error about a `VITE_` value using Secret visibility, edit that variable and change visibility to **Configuration**. If you see a database connection error, check `DATABASE_URL`, database availability, SSL requirements, and network access.

## Part 8 — Independent Supabase deployment note

Before deploying, run `supabase/migrations/0000_loving_madrox.sql` once in your Supabase SQL Editor. Then configure Supabase Authentication → URL Configuration with the Vercel Site URL and redirect URLs. The independent app uses Supabase email/password authentication and forwards the access token to the server; it does not use the old Manus OAuth callback.

For the independent project, the required variables are `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, and the VAPID values if push is enabled. R2 is not required by the current core product. Supabase Storage is the default if a future file feature is activated. The optional AI companion requires a separately chosen user-owned provider and may remain unavailable without one.

## Part 9 — The most important safety rules

Never commit a `.env` file to GitHub. Never post a secret in chat, screenshots, browser console output, or a support ticket. Never use the main project’s database accidentally. Never put `DATABASE_URL`, `JWT_SECRET`, `BUILT_IN_FORGE_API_KEY`, `VAPID_PRIVATE_KEY`, or an ICS URL in a `VITE_` variable. Never change the GitHub `main` branch for this setup.

The separate Vercel project can be yours while still using Vercel as the hosting provider. The independent architecture migration is the approved path for this branch. Complete the Supabase SQL setup and use only the user-owned variables listed in Part 8.

## References

[1]: https://vercel.com/docs/deployments/git "Vercel Documentation — Deploying Git repositories"
[2]: https://vercel.com/docs/environment-variables "Vercel Documentation — Environment variables"
[3]: https://vercel.com/docs/project-configuration/project-settings "Vercel Documentation — Project settings"
