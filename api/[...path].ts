import { createPlannerApp } from "../server/_core/app";

/** Vercel catches every /api/* path with this exported Express application. */
export default createPlannerApp();
