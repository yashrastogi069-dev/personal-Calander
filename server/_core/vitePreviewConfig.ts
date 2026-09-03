import type { Server } from "http";
import type { ServerOptions } from "vite";

const DEFAULT_PREVIEW_HMR_PORT = 443;

export function getManagedPreviewHmrClientPort(value = process.env.VITE_HMR_CLIENT_PORT): number {
  if (!value) return DEFAULT_PREVIEW_HMR_PORT;

  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65_535
    ? port
    : DEFAULT_PREVIEW_HMR_PORT;
}

export function shouldUseViteDevelopmentServer(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment.NODE_ENV === "development";
}

export function createManagedPreviewViteServerOptions(server: Server): ServerOptions {
  return {
    middlewareMode: true as const,
    hmr: {
      server,
      clientPort: getManagedPreviewHmrClientPort(),
    },
    allowedHosts: ["personal-calander.vercel.app", "localhost", "127.0.0.1"],
  };
}
