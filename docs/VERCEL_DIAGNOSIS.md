# Vercel Deployment Diagnosis

**Inspected URL:** <https://personal-calander.vercel.app/> on 2026-08-24.

The live root URL does not serve the planner’s HTML shell. It returns the bundled server entry instead: the response begins with compiled `server/_core/index.ts` code, imports Express, and embeds the Drizzle schema. That explains why the Vercel deployment can report no visible build error while the browser has no usable planner output.

The repository is a combined Vite frontend and Express/tRPC backend. Its `build` command creates both Vite static assets and `dist/index.js`, while the server entry starts an HTTP listener itself. This is not a Vercel serverless entry shape. A Vercel deployment therefore needs an adapter that **exports** the Express application as a function, serves the Vite `dist/public` assets, and routes client-side SPA paths without forwarding them to the compiled server bundle.

The next remediation is to introduce a Vercel-specific function entry and routing configuration, plus production environment values for the database and any retained OAuth/storage integrations. The static Vite assets must be served at `/`; tRPC, the calendar feed, and other backend endpoints must be served under `/api/*`.

## Source

The response was retrieved directly from <https://personal-calander.vercel.app/>. Official deployment references used for the remediation are [Vercel’s Express guide](https://vercel.com/docs/frameworks/backend/express), [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), and [Vercel rewrites](https://vercel.com/docs/routing/rewrites).
