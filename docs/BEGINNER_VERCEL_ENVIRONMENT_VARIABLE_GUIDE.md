# Beginner Guide: Vercel Environment Variables for Personal Calendar

**Purpose:** This guide explains what each variable means, where it comes from, what you personally need to create, and exactly where to enter it in Vercel. It is written for the separate Vercel project that will use `dev/personal-calendar-workbench`.

> Important: owning the Vercel project does not automatically mean the application is independent of Manus. The current Personal Calendar code uses Manus authentication and Manus built-in services. You can deploy it using those existing services, or you can later authorize a larger migration to services that you own. Do not replace a variable with a random value unless this guide says it is safe to generate one.

## Part 1 — Decide which setup you want

There are two different setups. Choose deliberately before entering values.

| Setup | What it means | What you need to do |
|---|---|---|
| **Current architecture** | Your Vercel project is yours, but the application still uses the existing Manus auth/service contracts. | Copy the matching values from the working main Vercel project or its project configuration. Do not copy its database if you do not want shared data. |
| **Fully independent architecture** | Vercel hosts your app, but authentication, database, storage, notifications, and optional analytics are all owned by you. | This requires a later code migration. It cannot be achieved by changing environment-variable text alone. Do not enter invented replacement values into the current codebase. |

For the current branch, the safest immediate deployment is **a separate Vercel project using the current architecture**, with a database and credentials that you personally control. The existing main Vercel project remains untouched.

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

### A. Database and sessions

| Key | Plain-English meaning | Where to get it | Visibility |
|---|---|---|---|
| `DATABASE_URL` | The private connection address for the database where tasks, goals, habits, and reviews are stored. | From the database provider you personally own, or from the working project’s database settings if you intentionally want that database. A new independent project should use a new database or a deliberately separate database. | Secret/Sensitive |
| `JWT_SECRET` | A private signing key used to protect login sessions. | For an independent project, generate a new random value. You can use a password manager’s 32-byte random generator. A terminal alternative is `openssl rand -base64 32`. Do not use your name, a normal password, or the word `secret`. | Secret/Sensitive |

**Do not test `DATABASE_URL` by pasting it into a browser.** It is not a web address for a normal browser. Paste it only into Vercel’s value field.

### B. Current Manus authentication

These values belong to the current Manus authentication integration. They are not values you can safely invent.

| Key | Meaning | Where to get it | Visibility |
|---|---|---|---|
| `VITE_APP_ID` | Identifies the Manus application used by the frontend and auth flow. | Copy from the working main Vercel project, or from the application configuration that created it. | Configuration |
| `OAUTH_SERVER_URL` | The server endpoint that handles the current OAuth flow. | Copy from the working main project. | Secret/Config; server-side use |
| `VITE_OAUTH_PORTAL_URL` | The browser login portal URL. | Copy from the working main project. | Configuration |
| `OWNER_OPEN_ID` | Identifies the owner account used by the current application. | Copy from the working main project configuration. | Secret/Config |
| `OWNER_NAME` | Owner display name used by the current project. | Copy the value from the working main project, or use your own display name if the current configuration permits it. | Config |

If you do not want any Manus dependency, do **not** replace these with fake URLs. The application needs a code migration to your own auth provider first.

### C. Current Manus built-in services

| Key | Meaning | Where to get it | Visibility |
|---|---|---|---|
| `BUILT_IN_FORGE_API_URL` | Server URL for the current built-in API helpers. | Copy from the working main project configuration. | Secret/Config; server-side |
| `BUILT_IN_FORGE_API_KEY` | Private server credential for those helpers. | Copy from the working main project or the connected service configuration. | Secret/Sensitive |
| `VITE_FRONTEND_FORGE_API_URL` | Browser-safe URL for frontend helpers. | Copy from the working main project. | Configuration |
| `VITE_FRONTEND_FORGE_API_KEY` | Browser-exposed client key used by the current frontend helper. | Copy only if you intentionally continue using the current Manus-backed architecture. | Configuration; never Secret in Vercel |

A `VITE_` key is not automatically private. Treat its value as visible to a website visitor.

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

## Part 8 — The most important safety rules

Never commit a `.env` file to GitHub. Never post a secret in chat, screenshots, browser console output, or a support ticket. Never use the main project’s database accidentally. Never put `DATABASE_URL`, `JWT_SECRET`, `BUILT_IN_FORGE_API_KEY`, `VAPID_PRIVATE_KEY`, or an ICS URL in a `VITE_` variable. Never change the GitHub `main` branch for this setup.

The separate Vercel project can be yours while still using Vercel as the hosting provider. If your requirement is that no part of the application depends on Manus, pause after deployment configuration and request the independent architecture migration; that is a separate engineering project involving auth, database, storage, notification, and possibly analytics replacements.

## References

[1]: https://vercel.com/docs/deployments/git "Vercel Documentation — Deploying Git repositories"
[2]: https://vercel.com/docs/environment-variables "Vercel Documentation — Environment variables"
[3]: https://vercel.com/docs/project-configuration/project-settings "Vercel Documentation — Project settings"
