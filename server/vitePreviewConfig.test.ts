import { describe, expect, it } from "vitest";
import {
  createManagedPreviewViteServerOptions,
  getReactResolutionAliases,
  getManagedPreviewHmrClientPort,
  shouldInjectManusRuntime,
  shouldUseViteDevelopmentServer,
} from "./_core/vitePreviewConfig";

describe("managed preview Vite configuration", () => {
  it("uses the HTTPS proxy port by default and keeps HMR on the shared server", () => {
    expect(getManagedPreviewHmrClientPort(undefined)).toBe(443);

    const httpServer = {} as Parameters<typeof createManagedPreviewViteServerOptions>[0];
    const options = createManagedPreviewViteServerOptions(httpServer);

    expect(options.middlewareMode).toBe(true);
    expect(options.hmr.server).toBe(httpServer);
    expect(options.hmr.clientPort).toBe(443);
  });

  it("accepts a valid explicit client port and rejects invalid configuration", () => {
    expect(getManagedPreviewHmrClientPort("8443")).toBe(8443);
    expect(getManagedPreviewHmrClientPort("0")).toBe(443);
    expect(getManagedPreviewHmrClientPort("not-a-port")).toBe(443);
  });

  it("keeps the bundled visual-editor runtime out of the live development client", () => {
    expect(shouldInjectManusRuntime("serve")).toBe(false);
    expect(shouldInjectManusRuntime("build")).toBe(true);
  });

  it("pins React runtime imports to the project installation", () => {
    expect(getReactResolutionAliases("/workspace/project")).toEqual({
      react: "/workspace/project/node_modules/react",
      "react-dom": "/workspace/project/node_modules/react-dom",
      "react/jsx-runtime": "/workspace/project/node_modules/react/jsx-runtime.js",
      "react/jsx-dev-runtime": "/workspace/project/node_modules/react/jsx-dev-runtime.js",
      "@trpc/react-query": "/workspace/project/node_modules/@trpc/react-query/dist/index.mjs",
    });
  });

  it("uses the stable static bundle for the managed preview while preserving opt-in Vite debugging", () => {
    expect(shouldUseViteDevelopmentServer({ NODE_ENV: "development" })).toBe(true);
    expect(shouldUseViteDevelopmentServer({ NODE_ENV: "development", MANUS_STABLE_PREVIEW: "1" })).toBe(false);
    expect(shouldUseViteDevelopmentServer({ NODE_ENV: "production" })).toBe(false);
  });
});
