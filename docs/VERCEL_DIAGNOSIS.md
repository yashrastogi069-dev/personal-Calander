# Vercel Deployment Diagnosis

**Inspected URL:** <https://personal-calander.vercel.app/> on 2026-08-24.

The live root URL does not serve the planner’s HTML shell. It returns the bundled server entry instead: the response begins with compiled `server/_core/index.ts` code, imports Express, and embeds the Drizzle schema. That explains why the Vercel deployment can report no visible build error while the browser has no usable planner output.

The repository is a combined Vite frontend and Express/tRPC backend. Its `build` command creates both Vite static assets and `dist/index.js`, while the server entry starts an HTTP listener itself. This is not a Vercel serverless entry shape. A Vercel deployment therefore needs an adapter that **exports** the Express application as a function, serves the Vite `dist/public` assets, and routes client-side SPA paths without forwarding them to the compiled server bundle.

The next remediation is to introduce a Vercel-specific function entry and routing configuration, plus production environment values for the database and any retained OAuth/storage integrations. The static Vite assets must be served at `/`; tRPC, the calendar feed, and other backend endpoints must be served under `/api/*`.

## Verified production recovery

The GitHub integration created the production deployment for commit `390df1c` in the `yashnew869-2746s-projects/personal-calander` Vercel project. That revision corrected the remaining API-function failure by compiling `server/_core/vercelApp.ts` to `dist/server/planner-app.mjs` during `pnpm build:client`, then importing that bundle through the supported `api/trpc/[...path].mjs` Function entry. This deliberately prevents Vercel’s API Function TypeScript checker from traversing the Express application’s type surface, which had reported incompatible Express declaration errors even though the local compiler passed.

The Function then returned correct responses for `GET /api/health` and the typed `system.health` tRPC procedure. The first database-backed `planner.workspace.snapshot` request still returned the application’s safe “Planning data is temporarily unavailable” error. An environment audit showed that the Vercel project had no Production variables. The existing managed `DATABASE_URL` was therefore added to Vercel **Production** as a sensitive secret without revealing its value, and the successful `390df1c` deployment was rebuilt. The production alias now points to `personal-calander-p8c7xh3ok-yashnew869-2746s-projects.vercel.app`.

| Verification | Result |
|---|---|
| `GET /api/health` | `200` JSON `{ "status": "ok" }` |
| Typed tRPC procedure | `GET /api/trpc/system.health` with a valid timestamp returned `200` and `{ "ok": true }` |
| Database-backed snapshot | `GET /api/trpc/planner.workspace.snapshot` returned `200` with the expected anonymous workspace snapshot |
| Browser root | The public alias rendered the usable Today dashboard, task capture, calendar canvas, goal, habit, and notification-readiness surfaces rather than a loading skeleton |

The authenticated Vercel project console remains available at <https://vercel.com/yashnew869-2746s-projects/personal-calander>. For any future Vercel deployment or environment migration, retain the production `DATABASE_URL`; VAPID credentials are intentionally not configured until the user supplies them.

## Verified Vercel production configuration

| Setting | Verified value |
|---|---|
| Repository and branch | `yashrastogi069-dev/personal-Calander`, branch `main` |
| Vercel project | `yashnew869-2746s-projects/personal-calander` (`prj_1LDL8LPGI7Nv8styrNljWflHzqZg`) |
| Root directory | Repository root (`.`) |
| Runtime | Node.js `24.x` |
| Build command | `pnpm build:client`, defined in `vercel.json` and therefore overriding the dashboard default |
| Build output | `dist/public` |
| API Functions | `api/health.ts`, `api/calendar/[token].ics.ts`, and `api/trpc/[...path].mjs` |
| Frontend routing | The SPA rewrite applies only to non-`/api/*` paths, preserving Function routing |
| Required Production secret | `DATABASE_URL`, stored in Vercel as a sensitive secret; no value is recorded in this repository |
| Latest code revision | GitHub commit `390df1c` |
| Current production alias | `https://personal-calander.vercel.app/` → `personal-calander-p8c7xh3ok-yashnew869-2746s-projects.vercel.app` |

The project’s direct configuration audit reported `ssoProtection: null`; an unauthenticated command-line request to the public alias returned `200` from both the health Function and the database-backed planner procedure. Together, those checks establish that SSO deployment protection is not blocking the intended public production app. The audit also reports `gitForkProtection: true` and `protectedSourcemaps: true`; those settings do not prevent ordinary public access to the production alias.

## Interaction release verification — 2026-08-24

The validated interaction release was pushed to GitHub `main` at revision `83eb780814c0c8a56344ddb9d1217eb4b53e661b`. Vercel created production deployment `dpl_DmkQfZKNDHK7MXH5kz9sqPWomeeh`, which reached **Ready** and assigned the public alias to `https://personal-calander-ezfdsagmp-yashnew869-2746s-projects.vercel.app`.

| Verification | Observed result |
| --- | --- |
| Public health | `GET /api/health` returned `200` and `{ "status": "ok" }`. |
| Typed health | `system.health` with a valid timestamp returned `200` and `{ "ok": true }`. |
| Database-backed planner | `planner.workspace.snapshot` created and returned an isolated anonymous workspace snapshot with the expected planning collections. |
| Public root | `https://personal-calander.vercel.app/` rendered the full Today planner, including categories, task capture, task calendar, goal/habit entry points, private iPhone Calendar control, and notification-readiness copy. |

The public alias is therefore serving the current functional interaction release rather than a stale shell. Live Web Push remains intentionally inactive: no VAPID values, device subscriptions, sender, or scheduled delivery process have been configured.

> **Operational sequence.** After modifying a Production environment variable, redeploy the latest production deployment. Vercel injects environment variables into a new deployment build; changing the value alone does not repair an already-running Function.

## Sources

The live checks above were run directly against the public Vercel alias and immutable deployment. The implementation follows Vercel’s documented Function, Express, Vite, and rewrite models. [1] [2] [3] [4]

[1]: https://vercel.com/docs/functions "Vercel Functions documentation"
[2]: https://vercel.com/docs/frameworks/backend/express "Vercel Express guide"
[3]: https://vercel.com/docs/frameworks/frontend/vite "Vite on Vercel"
[4]: https://vercel.com/docs/routing/rewrites "Vercel rewrites documentation"
