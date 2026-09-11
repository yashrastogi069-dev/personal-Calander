import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repository = fileURLToPath(new URL("../", import.meta.url));
const retiredNames = [["man", "us"].join(""), ["for", "ge"].join("")];

describe("independent platform source", () => {
  it("has no retired-provider references in current tracked files", () => {
    // No tree/ref argument: inspect the current working tree, never Git history.
    const scan = spawnSync("git", ["grep", "-I", "-l", "-i", ...retiredNames.flatMap(name => ["-e", name]), "--", "."], { cwd: repository, encoding: "utf8" });
    if (scan.error || ![0, 1].includes(scan.status ?? -1)) throw new Error(scan.error?.message ?? scan.stderr);
    expect(scan.stdout.trim(), "Retired provider references remain in these tracked files").toBe("");
  });
});
