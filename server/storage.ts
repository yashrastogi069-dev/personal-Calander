import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { plannerFiles, users } from "../drizzle/schema";
import { getDb } from "./db";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { requireWorkspaceOwner } from "./workspaceOwnership";

export const uploadInput = z.object({
  requestId: z.string().min(1).max(128),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(["application/pdf", "text/plain", "application/json", "image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().min(1).max(20 * 1024 * 1024),
});
type Actor = { id: number; authUserId: string | null };
type Scope = { workspaceId: string; timezone: string };
type FileInput = Scope & { fileId: string };
export type FileRecord = typeof plannerFiles.$inferSelect;
export type FileRepository = {
  reserve(row: FileRecord): Promise<FileRecord>;
  find(workspaceId: string, id: string): Promise<FileRecord | null>;
  ready(workspaceId: string): Promise<FileRecord[]>;
  cleanupCandidates(afterId: string): Promise<Array<{ file: FileRecord; authUserId: string | null }>>;
  update(row: FileRecord, patch: Partial<Pick<FileRecord, "status" | "updatedAt" | "deletedAt" | "failureReason">>): Promise<FileRecord>;
};

async function database() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The planner database is not configured." });
  return db;
}
const repository: FileRepository = {
  async reserve(row) {
    const db = await database();
    const [inserted] = await db.insert(plannerFiles).values(row).onConflictDoNothing({ target: [plannerFiles.workspaceId, plannerFiles.requestId] }).returning();
    if (inserted) return inserted;
    const [existing] = await db.select().from(plannerFiles).where(and(eq(plannerFiles.workspaceId, row.workspaceId), eq(plannerFiles.requestId, row.requestId))).limit(1);
    if (!existing) throw new TRPCError({ code: "CONFLICT", message: "Please retry the upload request." });
    return existing;
  },
  async find(workspaceId, id) {
    const [row] = await (await database()).select().from(plannerFiles).where(and(eq(plannerFiles.workspaceId, workspaceId), eq(plannerFiles.id, id))).limit(1);
    return row ?? null;
  },
  async ready(workspaceId) {
    return (await database()).select().from(plannerFiles).where(and(eq(plannerFiles.workspaceId, workspaceId), eq(plannerFiles.status, "ready"))).orderBy(desc(plannerFiles.createdAt));
  },
  async cleanupCandidates(afterId) {
    return (await database()).select({ file: plannerFiles, authUserId: users.authUserId })
      .from(plannerFiles).innerJoin(users, eq(plannerFiles.ownerUserId, users.id))
      .where(and(inArray(plannerFiles.status, ["deleted", "failed"]), gt(plannerFiles.id, afterId)))
      .orderBy(asc(plannerFiles.id)).limit(100);
  },
  async update(row, patch) {
    const [updated] = await (await database()).update(plannerFiles).set(patch).where(and(eq(plannerFiles.id, row.id), eq(plannerFiles.workspaceId, row.workspaceId), eq(plannerFiles.status, row.status))).returning();
    if (!updated) throw new TRPCError({ code: "CONFLICT", message: "File changed. Refresh and try again." });
    return updated;
  },
};

function publicFile(row: FileRecord) {
  return { id: row.id, workspaceId: row.workspaceId, requestId: row.requestId, fileName: row.fileName,
    mimeType: row.mimeType, sizeBytes: row.sizeBytes, status: row.status,
    createdAt: row.createdAt, updatedAt: row.updatedAt, deletedAt: row.deletedAt };
}
function safeFileName(value: string) {
  return value.split(/[\\/]/).pop()!.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+(?=\.)/g, "").replace(/^[.-]+|[.-]+$/g, "").slice(0, 120) || "file";
}
function storageError() {
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "File storage is unavailable. Please retry or check the server configuration." });
}

export function createStorageService(deps: { repository: FileRepository; requireOwner: typeof requireWorkspaceOwner; getAdmin: typeof getSupabaseAdmin }) {
  async function authorize(actor: Actor, scope: Scope) {
    await deps.requireOwner(actor.id, scope.workspaceId);
    if (!actor.authUserId || !z.uuid().safeParse(actor.authUserId).success) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in again to access files." });
    // Workspace identifiers become a single object-path segment.
    if (!/^[a-zA-Z0-9_-]{12,64}$/.test(scope.workspaceId)) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid workspace identifier." });
  }
  async function bucket(actor: Actor, scope: Scope) {
    await authorize(actor, scope);
    try { return deps.getAdmin().storage.from("planner-files"); } catch { throw storageError(); }
  }
  async function find(actor: Actor, input: FileInput) {
    await authorize(actor, input);
    const row = await deps.repository.find(input.workspaceId, input.fileId);
    if (!row || row.ownerUserId !== actor.id || !row.objectPath.startsWith(`${actor.authUserId}/${input.workspaceId}/${row.id}-`)) {
      throw new TRPCError({ code: "NOT_FOUND", message: "File not found." });
    }
    return row;
  }
  async function markFailed(actor: Actor, scope: Scope, row: FileRecord) {
    // Persist cleanup intent before I/O so failures and late arrivals remain retryable.
    await deps.repository.update(row, { status: "failed", failureReason: "Uploaded file size or type did not match.", updatedAt: new Date() });
    const removed = await (await bucket(actor, scope)).remove([row.objectPath]);
    if (removed.error) throw storageError();
  }
  return {
    async createUpload(actor: Actor, input: Scope & z.infer<typeof uploadInput>) {
      const parsed = uploadInput.safeParse(input);
      if (!parsed.success) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a supported file between 1 byte and 20 MiB with a filename." });
      await authorize(actor, input);
      const id = randomUUID(); const now = new Date();
      const row = await deps.repository.reserve({ ...parsed.data, id, workspaceId: input.workspaceId, ownerUserId: actor.id,
        objectPath: `${actor.authUserId}/${input.workspaceId}/${id}-${safeFileName(parsed.data.fileName)}`,
        status: "uploading", createdAt: now, updatedAt: now, deletedAt: null, failureReason: null });
      if (row.ownerUserId !== actor.id || !row.objectPath.startsWith(`${actor.authUserId}/${input.workspaceId}/${row.id}-`) || row.fileName !== parsed.data.fileName || row.mimeType !== input.mimeType || row.sizeBytes !== input.sizeBytes) {
        throw new TRPCError({ code: "CONFLICT", message: "That request ID already belongs to another upload." });
      }
      if (row.status === "ready") return { file: publicFile(row), uploadUrl: null };
      if (row.status !== "uploading") throw new TRPCError({ code: "CONFLICT", message: "Start a new upload with a new request ID." });
      const result = await (await bucket(actor, input)).createSignedUploadUrl(row.objectPath, { upsert: false });
      if (result.error || !result.data) throw storageError();
      return { file: publicFile(row), uploadUrl: result.data.signedUrl };
    },
    async completeUpload(actor: Actor, input: FileInput) {
      const row = await find(actor, input);
      if (row.status === "ready") return publicFile(row);
      if (row.status !== "uploading") throw new TRPCError({ code: "CONFLICT", message: "This upload is no longer active." });
      const result = await (await bucket(actor, input)).info(row.objectPath);
      if (result.error || !result.data) {
        const error = result.error as { status?: number | string; statusCode?: number | string } | null;
        if (Number(error?.status ?? error?.statusCode) === 404) throw new TRPCError({ code: "NOT_FOUND", message: "The upload has not arrived yet. Finish uploading and retry." });
        throw storageError();
      }
      if (result.data.size !== row.sizeBytes || result.data.contentType?.split(";")[0].trim().toLowerCase() !== row.mimeType) {
        await markFailed(actor, input, row);
        throw new TRPCError({ code: "BAD_REQUEST", message: "The uploaded file did not match its expected size or type. Start a new upload." });
      }
      return publicFile(await deps.repository.update(row, { status: "ready", updatedAt: new Date() }));
    },
    async listFiles(actor: Actor, input: Scope) {
      await authorize(actor, input);
      return (await deps.repository.ready(input.workspaceId)).map(publicFile);
    },
    async createDownloadUrl(actor: Actor, input: FileInput) {
      const row = await find(actor, input);
      if (row.status !== "ready") throw new TRPCError({ code: "CONFLICT", message: "This file is not ready for download." });
      const result = await (await bucket(actor, input)).createSignedUrl(row.objectPath, 300);
      if (result.error || !result.data) throw storageError();
      return { file: publicFile(row), downloadUrl: result.data.signedUrl, expiresIn: 300 };
    },
    async deleteFile(actor: Actor, input: FileInput) {
      const row = await find(actor, input);
      const deleted = row.status === "deleted" ? row : await deps.repository.update(row, { status: "deleted", deletedAt: new Date(), updatedAt: new Date() });
      const result = await (await bucket(actor, input)).remove([row.objectPath]);
      if (result.error) throw storageError();
      return publicFile(deleted);
    },
    async reconcileCancelledUploads() {
      const result = { removed: 0, failed: 0 };
      let afterId = "";
      for (;;) {
        const candidates = await deps.repository.cleanupCandidates(afterId);
        if (!candidates.length) return result;
        for (const { file, authUserId } of candidates) {
          afterId = file.id;
          try {
            const actor = { id: file.ownerUserId, authUserId };
            const input = { workspaceId: file.workspaceId, timezone: "UTC", fileId: file.id };
            const current = await find(actor, input);
            if (current.status !== "deleted" && current.status !== "failed") continue;
            const removed = await (await bucket(actor, input)).remove([current.objectPath]);
            if (removed.error) throw storageError();
            result.removed++;
          } catch {
            result.failed++;
          }
        }
        // Keep tombstones eligible forever: even a successful removal cannot
        // prove that an issued signed upload will not finish arriving later.
      }
    },
  };
}
export const storageService = createStorageService({ repository, requireOwner: requireWorkspaceOwner, getAdmin: getSupabaseAdmin });
// Called by the authenticated scheduled worker; never exposed as a public tRPC procedure.
export const reconcileCancelledStorageUploads = () => storageService.reconcileCancelledUploads();
