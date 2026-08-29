# Deploy `dev/personal-calendar-workbench` to Vercel

This guide is for deploying the Personal Calendar workbench from the isolated development branch. It does not merge, push, or modify protected `main`.

## What is already configured

The repository contains a `vercel.json` that uses the repository build command, emits the Vite client to `dist/public`, bundles the server adapter to `dist/server/planner-app.mjs`, routes `/api/trpc/*` to the Vercel function, and sends non-API browser routes to `index.html`. The verified build command is:

```text
rm -rf dist node_modules/.vite && pnpm build:client
```

The application uses the existing Vercel adapter at `server/_core/vercelApp.ts`. Do not replace this with a static-only deployment: the planner needs its server function, database, authentication, and storage/notification helpers.

## Before you deploy

1. Confirm the repository is connected to the correct GitHub repository: `yashrastogi069-dev/personal-Calander`.
2. Confirm the Vercel project’s **Production Branch** remains whatever you intentionally use for production. For a safe branch preview, do not change production branch to `dev/personal-calendar-workbench`; deploy this branch as a Preview deployment first.
3. Confirm the GitHub branch exists exactly as `dev/personal-calendar-workbench`. The spelling and slash matter.
4. Confirm the branch has the latest pushed checkpoint. The current verified branch checkpoint for this guide is `ddd6784d` or newer when continuing from the phone-first work.
5. Ensure the production database is not used for disposable browser tests. Use the project’s intended database, and never run destructive SQL against production without a separate backup and explicit approval.

## Vercel project settings

Open **Vercel → the Personal Calendar project → Settings → General** and verify the following values.

| Setting | Value |
|---|---|
| Framework Preset | `Other` or `None` (the committed `vercel.json` is authoritative) |
| Root Directory | Repository root, not `client/` |
| Build Command | `rm -rf dist node_modules/.vite && pnpm build:client` |
| Output Directory | `dist/public` |
| Install Command | `pnpm install --frozen-lockfile` if Vercel allows a custom install command; otherwise keep the detected pnpm install |
| Node.js Version | Node 22.x, matching the verified sandbox runtime |
| Production Branch | Leave unchanged while testing this branch |
|

Do not set the Root Directory to `client`. Doing so hides `server/`, `drizzle/`, `vercel.json`, and the server bundle from the build.

## Environment variables

Open **Settings → Environment Variables**. Add the variables for the environments in which the deployment will run. For a safe preview, select **Preview** first. Select **Production** only when you intentionally want this configuration available to the production deployment.

The application requires the existing Manus/database environment set supplied by the project. Copy values from the working project configuration or the connected Vercel project; never commit them to GitHub and never paste them into source files.

| Variable group | Variables | Visibility |
|---|---|---|
| Database and session | `DATABASE_URL`, `JWT_SECRET` | Server-only secret |
| Manus authentication | `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `OWNER_OPEN_ID`, `OWNER_NAME` | Keep server credentials secret; `VITE_*` values are client-visible config, not secrets |
| Built-in server services | `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` | Server-only secret |
| Built-in client services | `VITE_FRONTEND_FORGE_API_URL`, `VITE_FRONTEND_FORGE_API_KEY` | Client-visible config; use Vercel **Configuration**, not Secret, for public-prefixed values |
| App identity | `VITE_APP_TITLE`, `VITE_APP_LOGO`, `VITE_APP_ID` | Client-visible config |
| Analytics | `VITE_ANALYTICS_ENDPOINT`, `VITE_ANALYTICS_WEBSITE_ID` | Client-visible config; optional only if analytics is intentionally disabled and the script is adjusted accordingly |
| Push readiness | `VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Public key is client-visible config; private key and subject are server-side values |
| OAuth/session support | `OAUTH_SERVER_URL`, `JWT_SECRET` | Server-only secret/config |
| Optional external calendar readiness | `PERSONAL_CALENDAR_ICS_OVERLAY_URL` | Server-only secret; do not add to client, logs, database payloads, screenshots, or public config |

The exact values are connector/project-specific. If a variable already exists in Vercel, edit the environment selection rather than creating a duplicate with a slightly different name. For a variable beginning with `VITE_`, Vercel rejects Secret visibility; choose **Configuration**. Do not expose `DATABASE_URL`, `JWT_SECRET`, `BUILT_IN_FORGE_API_KEY`, `VAPID_PRIVATE_KEY`, or the ICS URL to the browser.

## Safe deployment steps

1. Open the Vercel project and select **Deployments**.
2. Choose **Create Deployment** or the Git integration’s branch deployment control.
3. Select the repository `yashrastogi069-dev/personal-Calander`.
4. Select the branch `dev/personal-calendar-workbench`.
5. Confirm the Root Directory is the repository root.
6. Confirm the build command and output directory match the table above.
7. Confirm the required **Preview** environment variables are present for this deployment.
8. Start the deployment.
9. Wait for **Building** to become **Ready**. A successful “deployment completed” message is not enough if the build logs contain TypeScript errors; open the complete build log and check that the build command exits with code 0.
10. Open the generated Preview URL in a private browser window or a separate profile. Do not test the preview by changing production settings.
11. Visit `/`, `/calendar`, and `/api/health` if the project exposes the health route. Confirm the first page loads, authentication can complete, the Calendar route loads, and the browser console has no new runtime errors.
12. Test one non-destructive flow: open Add task, dismiss it, open Calendar, move between nearby days, and return to Today. Do not create disposable records unless you have a targeted cleanup plan.
13. If the preview is correct, copy its URL and use that URL for phone testing. An isolated branch Preview URL is separate from the production domain.

## Database and first-login checks

Vercel functions need access to the same database and auth configuration intended for the preview. If the deployment returns an unauthorized loop, first verify the OAuth portal/callback configuration and cookie domain behavior, then inspect the function logs. If it returns a database connection error, verify `DATABASE_URL`, SSL requirements, and database network access. Do not solve either issue by putting credentials in client code.

The deployment does not automatically make schema changes. If a migration is needed, apply it through the project’s controlled schema-first process before relying on a new procedure. Do not run `drizzle-kit migrate` against an important database as an improvised Vercel build step.

## If Vercel reports the earlier TypeScript errors

Ensure Vercel is building the latest branch commit and the Root Directory is the repository root. The current branch’s verified checks are:

```bash
pnpm check
pnpm test
pnpm build:client
```

If the log still references old `server/_core/cookies.ts` or `server/_core/sdk.ts` types, the deployment is building an old commit or a different branch. Check the deployment’s source commit SHA before editing Vercel settings. Do not add `skipLibCheck` or ignore the build errors as a first response.

## Rollback

If the preview is bad, simply leave the preview deployment untouched and redeploy the previous known-good development checkpoint. If a production deployment was intentionally made and must be rolled back, use **Vercel → Deployments → the known-good deployment → Promote to Production**. Do not force-push or reset `main` to fix a preview problem. The project checkpoint/version history is the primary application rollback record.

## Branch safety checklist

Before and after deployment, verify:

```bash
git branch --show-current
git status --short
git ls-remote github refs/heads/main refs/heads/dev/personal-calendar-workbench
```

Only `dev/personal-calendar-workbench` may be pushed for this work. Protected `main` must remain unchanged at its approved SHA until the user explicitly authorizes a future merge or push.

## References

[1]: https://vercel.com/docs/deployments/git "Vercel Documentation — Deploying Git repositories"
[2]: https://vercel.com/docs/project-configuration/project-settings "Vercel Documentation — Project settings"
[3]: https://vercel.com/docs/environment-variables "Vercel Documentation — Environment variables"
[4]: https://vercel.com/docs/functions/configuring-functions "Vercel Documentation — Configuring Functions"
