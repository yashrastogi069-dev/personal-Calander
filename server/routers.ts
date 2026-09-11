import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getAccountWorkspace } from "./workspaceOwnership";
import { plannerRouter } from "./routers/planner";
import { storageRouter } from "./routers/storage";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => {
      if (opts.ctx.authError) throw opts.ctx.authError;
      return opts.ctx.user;
    }),
    workspace: protectedProcedure.query(opts => getAccountWorkspace(opts.ctx.user.id)),
    logout: publicProcedure.mutation(() => ({
      success: true,
    } as const)),
  }),
  planner: plannerRouter,
  storage: storageRouter,
});

export type AppRouter = typeof appRouter;
