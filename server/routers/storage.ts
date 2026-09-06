import { z } from "zod";
import { router } from "../_core/trpc";
import { workspaceProcedure } from "../workspaceProcedure";
import { storageService, uploadInput } from "../storage";

const fileInput = z.object({ fileId: z.string().min(1).max(64) });
export const storageRouter = router({
  createUpload: workspaceProcedure.input(uploadInput).mutation(({ ctx, input }) => storageService.createUpload(ctx.user, input)),
  completeUpload: workspaceProcedure.input(fileInput).mutation(({ ctx, input }) => storageService.completeUpload(ctx.user, input)),
  listFiles: workspaceProcedure.query(({ ctx, input }) => storageService.listFiles(ctx.user, input)),
  createDownloadUrl: workspaceProcedure.input(fileInput).mutation(({ ctx, input }) => storageService.createDownloadUrl(ctx.user, input)),
  deleteFile: workspaceProcedure.input(fileInput).mutation(({ ctx, input }) => storageService.deleteFile(ctx.user, input)),
});
