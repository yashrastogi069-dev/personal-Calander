import { describe, expect, it } from "vitest";
import { intentionPresentation, previewIntentionKindChange } from "@shared/goalIntentions";

describe("goal intention semantics", () => {
  it("keeps null metadata in legacy goal presentation", () => {
    const presentation = intentionPresentation({ title: "Old goal", progressMode: "task", progressValue: 3, targetValue: 8, dueLocalDate: "2026-12-31" });
    expect(presentation.kind).toBe("legacy");
    expect(presentation.showsProgress).toBe(true);
    expect(presentation.showsDates).toBe(true);
  });
  it("does not infer an intention from the title", () => {
    expect(intentionPresentation({ title: "Become a better leader" }).kind).toBe("legacy");
  });
  it("makes direction presentation less score-driven without deleting stored facts", () => {
    const presentation = intentionPresentation({ title: "Health", intentionKind: "direction", standards: "Sleep consistently", progressValue: 80, targetValue: 100, dueLocalDate: "2026-12-31" });
    expect(presentation.showsProgress).toBe(false);
    expect(presentation.showsDates).toBe(false);
    expect(presentation.details).toContainEqual({ label: "Standards", value: "Sleep consistently" });
  });
  it("previews conversion without mutating the goal", () => {
    const goal = { title: "Ship", intentionKind: "direction" as const, dueLocalDate: "2026-10-01", progressValue: 40 };
    const preview = previewIntentionKindChange(goal, "outcome");
    expect(preview.consequences.join(" ")).toContain("Existing dates");
    expect(goal).toEqual({ title: "Ship", intentionKind: "direction", dueLocalDate: "2026-10-01", progressValue: 40 });
  });
});
