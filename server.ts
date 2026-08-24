import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPlannerApp } from "./server/_core/app";

const app = createPlannerApp();
const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const staticDirectory = path.join(projectRoot, "dist", "public");

app.use(express.static(staticDirectory, { index: false }));
app.get("/{*splat}", (_req, res) => res.sendFile(path.join(staticDirectory, "index.html")));

// Vercel captures this listener as one Node server function. Locally it remains usable for deployment parity.
app.listen(Number(process.env.PORT ?? 3000));
