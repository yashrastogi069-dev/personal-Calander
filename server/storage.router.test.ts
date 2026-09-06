import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
const mocks = vi.hoisted(() => ({ owner: vi.fn(), createUpload: vi.fn(), completeUpload: vi.fn(), listFiles: vi.fn(), createDownloadUrl: vi.fn(), deleteFile: vi.fn() }));
vi.mock("./workspaceOwnership", () => ({ requireWorkspaceOwner: mocks.owner }));
vi.mock("./storage", async original => ({ ...await original<typeof import("./storage")>(), storageService: mocks }));
import { storageRouter } from "./routers/storage";
import type { TrpcContext } from "./_core/context";
const user = { id: 7, authUserId: "11111111-1111-4111-8111-111111111111" } as TrpcContext["user"];
const context = { user, req: {}, res: {} } as TrpcContext;
const scope = { workspaceId: "workspace-owned-1", timezone: "UTC" };
const input = { ...scope, requestId: "request-0001", fileName: "report.pdf", mimeType: "application/pdf", sizeBytes: 42 };
beforeEach(() => { vi.clearAllMocks(); mocks.owner.mockResolvedValue(undefined); });
describe("storage ownership boundary", () => {
  it("requires authentication", async () => {
    await expect(storageRouter.createCaller({ ...context, user: null }).createUpload(input)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.createUpload).not.toHaveBeenCalled();
  });
  it("passes the authenticated durable identity to storage", async () => {
    await storageRouter.createCaller(context).createUpload(input);
    expect(mocks.createUpload).toHaveBeenCalledWith(user, input);
  });
  it("denies foreign workspaces on all five procedures", async () => {
    mocks.owner.mockRejectedValue(new TRPCError({ code: "FORBIDDEN" }));
    const caller = storageRouter.createCaller(context);
    for (const promise of [caller.createUpload(input), caller.completeUpload({ ...scope, fileId: "file-1" }), caller.listFiles(scope), caller.createDownloadUrl({ ...scope, fileId: "file-1" }), caller.deleteFile({ ...scope, fileId: "file-1" })]) {
      await expect(promise).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    for (const name of ["createUpload", "completeUpload", "listFiles", "createDownloadUrl", "deleteFile"] as const) expect(mocks[name]).not.toHaveBeenCalled();
  });
  it("rejects invalid size before storage calls", async () => {
    await expect(storageRouter.createCaller(context).createUpload({ ...input, sizeBytes: 20971521 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.createUpload).not.toHaveBeenCalled();
  });
});
