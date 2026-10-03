import { describe, expect, it } from "vitest";
import { captureInterpretationDraft, captureKindHasUncertainOutcome, captureSheetSurface, restoredCaptureKind } from "./CaptureSheet";

describe("capture sheet interpretation handoff", () => {
  it("carries explicit deadline, Today choice, and estimate into review", () => {
    const draft = captureInterpretationDraft("Write report next week", "2026-10-03", {
      dueLocalDate: "2026-10-20", estimateMinutes: "45", planForToday: true,
    });
    expect(draft).toMatchObject({ dueLocalDate: "2026-10-20", scheduledLocalDate: "2026-10-03", estimateMinutes: 45 });
    expect(draft.notes).toEqual(expect.arrayContaining([expect.stringContaining("Explicit sheet fields")]));
  });

  it("restores a saved non-task draft's kind without reinterpreting it as a task", () => {
    expect(restoredCaptureKind("project", "task")).toBe("project");
    expect(restoredCaptureKind("goal", "task")).toBe("goal");
    expect(restoredCaptureKind("habit", "task")).toBe("habit");
    expect(restoredCaptureKind("malformed", "task")).toBe("task");
  });
  it("isolates explicit task shortcut drafts from regular Capture drafts", () => {
    expect(captureSheetSurface("task")).toBe("sheet-task");
    expect(captureSheetSurface("neutral")).toBe("sheet");
  });
  it("keeps unknown outcomes with the submitted non-task kind", () => {
    const afterProjectTimeout = ["project"] as const;
    expect(captureKindHasUncertainOutcome("project", afterProjectTimeout)).toBe(true);
    expect(captureKindHasUncertainOutcome("goal", afterProjectTimeout)).toBe(false);
    expect(captureKindHasUncertainOutcome("task", afterProjectTimeout)).toBe(false);
  });
});
