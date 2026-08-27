import { describe, expect, it } from "vitest";
import { parseNaturalLanguageTask } from "@shared/naturalLanguageTask";

describe("deterministic natural-language task parsing", () => {
  it("extracts an explicit plan date, time, duration, priority, and editable title without a write", () => {
    expect(parseNaturalLanguageTask("Finish report tomorrow at 2pm for 45 minutes high priority", "2026-08-27")).toMatchObject({ title: "Finish report", scheduledLocalDate: "2026-08-28", dueLocalDate: null, reserveTime: "14:00", estimateMinutes: 45, priority: "high" });
  });

  it("keeps a deadline distinct from a plan date and does not manufacture a reservation without a date", () => {
    expect(parseNaturalLanguageTask("Send proposal by Friday at 09:30", "2026-08-27")).toMatchObject({ dueLocalDate: "2026-08-28", scheduledLocalDate: null, reserveTime: "09:30" });
  });

  it("parses only supported recurring cadence and leaves ambiguous text safe and unplanned", () => {
    expect(parseNaturalLanguageTask("Review metrics every Monday and Wednesday", "2026-08-27").recurrenceRule).toEqual({ frequency: "weekly", interval: 1, weekdays: [1, 3] });
    expect(parseNaturalLanguageTask("Think about the roadmap sometime", "2026-08-27")).toMatchObject({ scheduledLocalDate: null, dueLocalDate: null, recurrenceRule: null, priority: "medium" });
  });
});
