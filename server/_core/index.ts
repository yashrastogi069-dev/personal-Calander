import "dotenv/config";
import { createServer } from "http";
import net from "net";
import { createPlannerApp } from "./app";
import { serveStatic, setupVite } from "./vite";
import { shouldUseViteDevelopmentServer } from "./vitePreviewConfig";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = createPlannerApp();
  const server = createServer(app);
  // The managed preview serves the current production bundle by default when
  // NODE_ENV is not development. Local development uses the Vite middleware so
  // the same application entrypoint remains available in both environments.
  if (shouldUseViteDevelopmentServer()) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
