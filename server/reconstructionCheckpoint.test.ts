import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("reconstruction checkpoint boundaries", () => {
  it("disables automatic deployment only for the gated workbench branch", () => {
    const configuration = JSON.parse(readFileSync("vercel.json", "utf8"));
    expect(configuration.git.deploymentEnabled).toEqual({
      "dev/personal-calendar-workbench": false,
    });
    expect(configuration.functions["api/trpc/[...path].mjs"].includeFiles)
      .toBe("dist/server/planner-app.mjs");
    expect(configuration.buildCommand).toBe("pnpm run build:client");
  });

  it("retains the owner-requested project skill configuration", () => {
    const configuration = readFileSync(".codex/config.toml", "utf8");
    expect(configuration).toMatch(/^\[skills\]\s*\r?\ninclude_instructions = false\s*$/);
  });
});
