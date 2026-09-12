import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const entrypoints = [
  "api/trpc/[...path].mjs",
  "api/calendar/[token].ics.mjs",
  "api/scheduled/reminder.mjs",
];

describe("Vercel serverless entrypoints", () => {
  it("routes every planner endpoint through the generated server bundle", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8"));
    for (const path of entrypoints) {
      const source = readFileSync(path, "utf8");
      expect(source).toContain("dist/server/planner-app.mjs");
      expect(source).not.toMatch(/from ["']\.\.\/\.\.\/server\//);
      expect(config.functions[path]).toEqual({ includeFiles: "dist/server/planner-app.mjs" });
    }
  });
});
