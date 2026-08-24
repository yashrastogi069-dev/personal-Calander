import { describe, expect, it } from "vitest";
import { safeTimeZone } from "../client/src/lib/workspace";

describe("browser timezone normalization", () => {
  it("retains valid IANA zones and safely falls back for browser-provided unknown zones", () => {
    expect(safeTimeZone("Asia/Kolkata")).toBe("Asia/Kolkata");
    expect(safeTimeZone("Etc/Unknown")).toBe("UTC");
    expect(safeTimeZone("not-a-zone")).toBe("UTC");
  });
});
