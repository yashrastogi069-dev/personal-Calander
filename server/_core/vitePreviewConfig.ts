import type { Server } from "http";
import path from "node:path";

const DEFAULT_MANAGED_PREVIEW_HMR_PORT = 443;

export function getManagedPreviewHmrClientPort(value = process.env.MANUS_VITE_HMR_CLIENT_PORT): number {
  if (!value) return DEFAULT_MANAGED_PREVIEW_HMR_PORT;

  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65_535
    ? port
    : DEFAULT_MANAGED_PREVIEW_HMR_PORT;
}

export function shouldInjectManusRuntime(command: string): boolean {
  return command === "build";
}

export function shouldUseViteDevelopmentServer(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment.NODE_ENV === "development" && environment.MANUS_STABLE_PREVIEW !== "1";
}

export function getReactResolutionAliases(projectRoot: string) {
  const reactRoot = path.join(projectRoot, "node_modules", "react");

  return {
    react: reactRoot,
    "react-dom": path.join(projectRoot, "node_modules", "react-dom"),
    "react/jsx-runtime": path.join(reactRoot, "jsx-runtime.js"),
    "react/jsx-dev-runtime": path.join(reactRoot, "jsx-dev-runtime.js"),
    "@trpc/react-query": path.join(projectRoot, "node_modules", "@trpc", "react-query", "dist", "index.mjs"),
  };
}

export function createManagedPreviewViteServerOptions(server: Server) {
  return {
    middlewareMode: true as const,
    hmr: {
      server,
      clientPort: getManagedPreviewHmrClientPort(),
    },
    allowedHosts: true as const,
  };
}
