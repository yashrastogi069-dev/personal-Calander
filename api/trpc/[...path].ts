import { createPlannerApp } from "../../server/_core/app";

/** Vercel maps only `/api/trpc/*` here; the Express app retains the full request path. */
export default createPlannerApp();
