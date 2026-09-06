import { z } from "zod";
import { protectedProcedure } from "./_core/trpc";
import { requireWorkspaceOwner } from "./workspaceOwnership";

export const workspaceScope = z.object({
  workspaceId: z.string().min(12).max(64),
  timezone: z.string().min(1).max(64),
});

export const workspaceProcedure = protectedProcedure
  .input(workspaceScope)
  .use(async ({ ctx, input, next }) => {
    await requireWorkspaceOwner(ctx.user.id, input.workspaceId);
    return next();
  });
