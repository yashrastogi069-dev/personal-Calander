import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");
let server: ViteDevServer;
let origin: string;

describe("Phase 4 prototype rendered interactions", () => {
  beforeAll(async () => {
    server = await createServer({
      logLevel: "silent",
      server: { host: "127.0.0.1", port: 0 },
    });
    await server.listen();
    origin = server.resolvedUrls?.local[0]?.replace(/\/$/, "") ?? "";
    expect(origin).not.toBe("");
  }, 30_000);

  afterAll(async () => {
    await server?.close();
  });

  it("invokes phone capture, viewport, and selected-task handlers through the rendered UI", async () => {
    const script = path.join(import.meta.dirname, "phase4PrototypeInteraction.browser.py");
    const { stdout, stderr } = await execFileAsync("python", ["-B", script, origin], {
      cwd: root,
      timeout: 60_000,
      windowsHide: true,
    });

    expect(stderr).toBe("");
    expect(JSON.parse(stdout)).toEqual({
      capture: true,
      viewportRoundTrip: true,
      selectedTask: true,
    });
  }, 70_000);
});
