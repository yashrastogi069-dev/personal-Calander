import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStorageService, type FileRecord, type FileRepository } from "./storage";

const actor = { id: 7, authUserId: "11111111-1111-4111-8111-111111111111" };
const scope = { workspaceId: "workspace-owned-1", timezone: "UTC" };
const input = { ...scope, requestId: "request-0001", fileName: "../../My notes?.pdf", mimeType: "application/pdf", sizeBytes: 42 };
let rows: FileRecord[];
const owner = vi.fn();
const bucket = { createSignedUploadUrl: vi.fn(), info: vi.fn(), createSignedUrl: vi.fn(), remove: vi.fn() };
const admin = vi.fn(() => ({ storage: { from: vi.fn(() => bucket) } }));
const repo: FileRepository = {
  reserve: async row => { const existing = rows.find(r => r.workspaceId === row.workspaceId && r.requestId === row.requestId); if (existing) return existing; rows.push(row); return row; },
  find: async (workspaceId, id) => rows.find(r => r.workspaceId === workspaceId && r.id === id) ?? null,
  ready: async workspaceId => rows.filter(r => r.workspaceId === workspaceId && r.status === "ready"),
  cleanupCandidates: async afterId => rows.filter(r => (r.status === "deleted" || r.status === "failed") && r.id > afterId).sort((a, b) => a.id.localeCompare(b.id)).map(file => ({ file, authUserId: actor.authUserId })),
  update: async (row, patch) => { Object.assign(row, patch); return row; },
};
const service = createStorageService({ repository: repo, requireOwner: owner, getAdmin: admin as never });

beforeEach(() => {
  rows = []; vi.clearAllMocks(); owner.mockResolvedValue(undefined);
  bucket.createSignedUploadUrl.mockResolvedValue({ data: { signedUrl: "https://storage.test/upload?token=secret" }, error: null });
  bucket.info.mockResolvedValue({ data: { size: 42, contentType: "application/pdf" }, error: null });
  bucket.createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://storage.test/download?token=secret" }, error: null });
  bucket.remove.mockReset().mockResolvedValue({ data: [], error: null });
});

describe("private planner storage", () => {
  it("creates owner-scoped normalized paths while exposing only metadata and the upload URL", async () => {
    const result = await service.createUpload(actor, input);
    expect(rows[0].objectPath).toMatch(/^11111111-1111-4111-8111-111111111111\/workspace-owned-1\/[\w-]+-My-notes.pdf$/);
    expect(result.file).toMatchObject({ fileName: input.fileName, status: "uploading", sizeBytes: 42 });
    expect(result.file).not.toHaveProperty("objectPath");
    expect(result.file).not.toHaveProperty("ownerUserId");
    expect(result.uploadUrl).toContain("https://storage.test/upload");
    expect(owner).toHaveBeenCalledWith(actor.id, scope.workspaceId);
    expect(bucket.createSignedUploadUrl).toHaveBeenCalledWith(rows[0].objectPath, { upsert: false });
  });
  it("denies foreign workspaces before any admin call", async () => {
    owner.mockRejectedValue(new Error("forbidden"));
    await expect(service.createUpload(actor, input)).rejects.toThrow("forbidden");
    expect(admin).not.toHaveBeenCalled(); expect(rows).toHaveLength(0);
  });
  it.each([{ mimeType: "text/html" }, { sizeBytes: 20971521 }, { sizeBytes: -1 }, { fileName: "" }])("rejects invalid upload input %j", async patch => {
    await expect(service.createUpload(actor, { ...input, ...patch })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(admin).not.toHaveBeenCalled();
  });
  it("reserves one object for retries and refuses changed request details", async () => {
    const [first, retry] = await Promise.all([service.createUpload(actor, input), service.createUpload(actor, input)]);
    expect(first.file.id).toBe(retry.file.id); expect(rows).toHaveLength(1);
    await expect(service.createUpload(actor, { ...input, sizeBytes: 43 })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("lists only finalized files and issues 300-second download URLs", async () => {
    const created = await service.createUpload(actor, input);
    expect(await service.listFiles(actor, scope)).toEqual([]);
    await expect(service.createDownloadUrl(actor, { ...scope, fileId: created.file.id })).rejects.toMatchObject({ code: "CONFLICT" });
    await service.completeUpload(actor, { ...scope, fileId: created.file.id });
    expect(await service.listFiles(actor, scope)).toHaveLength(1);
    expect(await service.createDownloadUrl(actor, { ...scope, fileId: created.file.id })).toMatchObject({ expiresIn: 300 });
    expect(bucket.createSignedUrl).toHaveBeenCalledWith(rows[0].objectPath, 300);
  });
  it("records deletion intent, removes the object, and rechecks repeated deletion", async () => {
    const { file } = await service.createUpload(actor, input);
    await service.completeUpload(actor, { ...scope, fileId: file.id });
    await service.deleteFile(actor, { ...scope, fileId: file.id });
    await service.deleteFile(actor, { ...scope, fileId: file.id });
    expect(bucket.remove).toHaveBeenCalledTimes(2); expect(rows[0].status).toBe("deleted");
    expect(await service.listFiles(actor, scope)).toEqual([]);
  });
  it("cleans up objects whose actual metadata differs from the reservation", async () => {
    const { file } = await service.createUpload(actor, input);
    bucket.info.mockResolvedValue({ data: { size: 100, contentType: "text/html" }, error: null });
    await expect(service.completeUpload(actor, { ...scope, fileId: file.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(bucket.remove).toHaveBeenCalledWith([rows[0].objectPath]); expect(rows[0].status).toBe("failed");
  });
  it("keeps missing uploads retryable and records cleanup intent when object deletion fails", async () => {
    const { file } = await service.createUpload(actor, input);
    bucket.info.mockResolvedValue({ data: null, error: { status: 404 } });
    await expect(service.completeUpload(actor, { ...scope, fileId: file.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(rows[0].status).toBe("uploading");
    bucket.remove.mockResolvedValue({ data: null, error: new Error("unavailable") });
    await expect(service.deleteFile(actor, { ...scope, fileId: file.id })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(rows[0].status).toBe("deleted");
  });
  it.each(["deleted", "failed"] as const)("reconciles an upload arriving after %s cancellation and retries cleanup failure", async status => {
    const { file } = await service.createUpload(actor, input);
    if (status === "deleted") await service.deleteFile(actor, { ...scope, fileId: file.id });
    else {
      bucket.info.mockResolvedValueOnce({ data: { size: 99, contentType: "text/html" }, error: null });
      await expect(service.completeUpload(actor, { ...scope, fileId: file.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    // A signed upload already in flight lands after the first removal completed.
    let objectExists = true;
    bucket.remove.mockResolvedValueOnce({ error: new Error("temporary failure") }).mockImplementation(async () => { objectExists = false; return { data: [], error: null }; });
    expect(await service.reconcileCancelledUploads()).toEqual({ removed: 0, failed: 1 });
    expect(objectExists).toBe(true);
    expect(await service.reconcileCancelledUploads()).toEqual({ removed: 1, failed: 0 });
    expect(objectExists).toBe(false);
    expect(rows[0].status).toBe(status);
    // Tombstones remain eligible: another late arrival cannot evade future sweeps.
    objectExists = true;
    await service.reconcileCancelledUploads();
    expect(objectExists).toBe(false);
  });
  it("revalidates ownership before finalization, download, and deletion", async () => {
    const { file } = await service.createUpload(actor, input); vi.clearAllMocks(); owner.mockRejectedValue(new Error("forbidden"));
    for (const operation of [service.completeUpload, service.createDownloadUrl, service.deleteFile]) {
      await expect(operation(actor, { ...scope, fileId: file.id })).rejects.toThrow("forbidden");
    }
    expect(admin).not.toHaveBeenCalled();
  });
  it("keeps cleanup queued without touching Storage when workspace ownership is revoked", async () => {
    const { file } = await service.createUpload(actor, input);
    await service.deleteFile(actor, { ...scope, fileId: file.id });
    vi.clearAllMocks(); owner.mockRejectedValue(new Error("forbidden"));
    expect(await service.reconcileCancelledUploads()).toEqual({ removed: 0, failed: 1 });
    expect(admin).not.toHaveBeenCalled(); expect(rows[0].status).toBe("deleted");
  });
  it("does not reveal files from another workspace even if the actor owns both", async () => {
    const { file } = await service.createUpload(actor, input); vi.clearAllMocks();
    await expect(service.completeUpload(actor, { ...scope, workspaceId: "workspace-owned-2", fileId: file.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(admin).not.toHaveBeenCalled();
  });
  it("returns a typed configuration error without leaking server credentials", async () => {
    admin.mockImplementationOnce(() => { throw new Error("secret-key"); });
    await expect(service.createUpload(actor, input)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: expect.not.stringContaining("secret-key") });
    expect(rows[0].status).toBe("uploading");
    expect((await service.createUpload(actor, input)).file.id).toBe(rows[0].id);
  });
});
