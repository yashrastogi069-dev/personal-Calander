import { describe, expect, it } from "vitest";
import {
  inboxCapturedLabel,
  inboxDayLabel,
  inboxDecisionMessage,
  inboxDecisionPatch,
  inboxDecisionUndoPatch,
  inboxPickDays,
  inboxShortcut,
  inboxWeekDays,
} from "./inboxTriageModel";

// 2026-10-14 is a Wednesday; the week (Monday start) ends Sun 18 Oct.
const today = "2026-10-14";
const before = { state: "not_started", horizon: "weekly", scheduledLocalDate: null, projectId: null };

describe("inbox decisions", () => {
  it("writes one patch per decision, each of which takes the task out of the Inbox", () => {
    expect(inboxDecisionPatch({ kind: "today" }, today)).toEqual({ scheduledLocalDate: today });
    expect(inboxDecisionPatch({ kind: "date", localDate: "2026-10-16" }, today)).toEqual({ scheduledLocalDate: "2026-10-16" });
    expect(inboxDecisionPatch({ kind: "project", projectId: "p1", label: "Portfolio" }, today)).toEqual({ projectId: "p1" });
    expect(inboxDecisionPatch({ kind: "someday" }, today)).toEqual({ horizon: "someday" });
  });

  it("archives on Delete, because there is no task delete and Archive keeps it restorable", () => {
    expect(inboxDecisionPatch({ kind: "delete" }, today)).toEqual({ state: "archived" });
    expect(inboxDecisionUndoPatch({ kind: "delete" }, before)).toEqual({ state: "not_started" });
  });

  it("undoes each decision back to the task as it was", () => {
    expect(inboxDecisionUndoPatch({ kind: "today" }, before)).toEqual({ scheduledLocalDate: null });
    expect(inboxDecisionUndoPatch({ kind: "date", localDate: "2026-10-16" }, before)).toEqual({ scheduledLocalDate: null });
    expect(inboxDecisionUndoPatch({ kind: "project", projectId: "p1", label: "Portfolio" }, before)).toEqual({ projectId: null });
    expect(inboxDecisionUndoPatch({ kind: "someday" }, before)).toEqual({ horizon: "weekly" });
    expect(inboxDecisionUndoPatch({ kind: "someday" }, { ...before, horizon: null })).toEqual({ horizon: "weekly" });
  });

  it("says what happened in plain words", () => {
    expect(inboxDecisionMessage({ kind: "today" }, today)).toBe("Planned for today");
    expect(inboxDecisionMessage({ kind: "date", localDate: "2026-10-16" }, today)).toBe("Planned for Fri");
    expect(inboxDecisionMessage({ kind: "date", localDate: "2026-11-02" }, today)).toBe("Planned for 2 Nov");
    expect(inboxDecisionMessage({ kind: "project", projectId: "p1", label: "Portfolio push" }, today)).toBe("Moved to Portfolio push");
    expect(inboxDecisionMessage({ kind: "someday" }, today)).toBe("Moved to Someday");
  });
});

describe("inbox pickers", () => {
  it("limits This week to today through the end of the current week (no week flag storage yet)", () => {
    expect(inboxWeekDays(today)).toEqual(["2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]);
    expect(inboxWeekDays("2026-10-18")).toEqual(["2026-10-18"]);
    // A Sunday-start workspace ends the week on Saturday.
    expect(inboxWeekDays(today, 0)).toEqual(["2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17"]);
  });

  it("offers tomorrow, the next three days and a week out for Pick date", () => {
    expect(inboxPickDays(today)).toEqual(["2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-21"]);
  });

  it("labels days as Today, Tomorrow, a weekday within the week, else a date", () => {
    expect(inboxDayLabel(today, today)).toBe("Today");
    expect(inboxDayLabel("2026-10-15", today)).toBe("Tomorrow");
    expect(inboxDayLabel("2026-10-17", today)).toBe("Sat");
    expect(inboxDayLabel("2026-10-21", today)).toBe("21 Oct");
  });

  it("maps the prototype keys T W D P S and Delete", () => {
    expect(inboxShortcut("t")).toEqual({ decision: "today" });
    expect(inboxShortcut("S")).toEqual({ decision: "someday" });
    expect(inboxShortcut("Backspace")).toEqual({ decision: "delete" });
    expect(inboxShortcut("Delete")).toEqual({ decision: "delete" });
    expect(inboxShortcut("w")).toEqual({ picker: "week" });
    expect(inboxShortcut("d")).toEqual({ picker: "date" });
    expect(inboxShortcut("p")).toEqual({ picker: "project" });
    expect(inboxShortcut("x")).toBeNull();
  });

  it("says when a thought was captured, in the workspace timezone", () => {
    expect(inboxCapturedLabel("2026-10-13T22:00:00.000Z", today, "Pacific/Auckland")).toBe("Captured today");
    expect(inboxCapturedLabel("2026-10-13T01:00:00.000Z", today, "Pacific/Auckland")).toBe("Captured yesterday");
    expect(inboxCapturedLabel("2026-10-02T01:00:00.000Z", today, "Pacific/Auckland")).toBe("Captured 2 Oct");
    expect(inboxCapturedLabel(null, today, "Pacific/Auckland")).toBeNull();
  });
});
