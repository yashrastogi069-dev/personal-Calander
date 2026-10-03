import { describe, expect, it } from "vitest";
import { captureDraftAfterThoughtChange, restoreNaturalLanguageDraft, titleOnlyCapturePatch } from "./NaturalLanguageCaptureWorkspace";

describe("capture entry semantics", () => {
  it("keeps title-only Inbox capture free of inferred planning fields", () => {
    expect(titleOnlyCapturePatch("  Call mom tomorrow at 2  ", false, "2026-10-03")).toMatchObject({
      title: "Call mom tomorrow at 2",
      scheduledLocalDate: null,
    });
    expect(titleOnlyCapturePatch("Call mom", true, "2026-10-03").scheduledLocalDate).toBe("2026-10-03");
  });

  it("invalidates reviewed interpretation when the raw thought changes", () => {
    const reviewed = { title: "Call mom" };
    expect(captureDraftAfterThoughtChange("Call mom", "Call mom", reviewed)).toBe(reviewed);
    expect(captureDraftAfterThoughtChange("Call mom", "Call dad", reviewed)).toBeNull();
  });

  it("ignores malformed saved interpretation fields", () => {
    expect(restoreNaturalLanguageDraft({ title: "Call mom", notes: [{ private: "bad" }], recurrenceRule: 4 }, "2026-10-03")).toMatchObject({
      title: "Call mom", notes: [], recurrenceRule: null,
    });
    expect(restoreNaturalLanguageDraft(["bad"], "2026-10-03")).toBeNull();
  });
});
