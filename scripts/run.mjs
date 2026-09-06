import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const mode = process.argv[2];
if (mode !== "development" && mode !== "production") throw new Error("Choose development or production.");
const child = spawn(process.execPath, mode === "development"
  ? ["--import", "tsx", "--watch", "server/_core/index.ts"]
  : ["dist/index.js"], {
  cwd: fileURLToPath(new URL("../", import.meta.url)),
  env: { ...process.env, NODE_ENV: mode }, stdio: "inherit",
});
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
