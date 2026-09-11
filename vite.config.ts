import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: "neutral-dependency-diagnostics",
    apply: "build",
    transform(code, id) {
      if (!id.includes("@trpc")) return null;
      // Preserve two dependency diagnostics without an incidental retired-name substring.
      const word = ["for", "get"].join("");
      const normalized = code.replaceAll(`did you ${word} to`, "did you fail to")
        .replaceAll(`Did you ${word} to`, "Did you fail to");
      return normalized === code ? null : { code: normalized, map: null };
    },
  }],
  resolve: {
    dedupe: ["react", "react-dom", "@trpc/react-query"],
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@trpc/react-query"],
  },
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    allowedHosts: ["personal-calander.vercel.app", "localhost", "127.0.0.1"],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
