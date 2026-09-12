import { describe, expect, it } from "vitest";
import { mergeOperationPatch } from "@shared/syncMerge";

describe("server offline-operation merge", () => {
  it("applies non-overlapping fields while retaining every overlapping value", () => {
    expect(mergeOperationPatch({
      baseValues: { title: "Before", description: "Before note", priority: "medium" },
      patch: { title: "Device title", description: "Device note", priority: "high" },
      server: { title: "Before", description: "Phone note", priority: "high", version: 7 },
    })).toEqual({
      safePatch: { title: "Device title" },
      alreadyApplied: ["priority"],
      conflicts: [{ field: "description", baseValue: "Before note", localValue: "Device note", serverValue: "Phone note" }],
    });
  });

  it("never interprets an omitted field as a deletion", () => {
    expect(mergeOperationPatch({
      baseValues: { title: "Before" },
      patch: { title: "After" },
      server: { title: "Before", description: "Keep me", projectId: "project-1" },
    })).toEqual({ safePatch: { title: "After" }, conflicts: [], alreadyApplied: [] });
  });
});
