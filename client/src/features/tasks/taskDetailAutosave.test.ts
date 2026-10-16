import { describe, expect, it } from "vitest";
import { sheetMorphStart } from "@/components/premium/Sheet";
import {
  changedTaskPatch,
  seedTaskInspectorDraft,
  taskAutosaveDecision,
  taskDetailSaveLabel,
  taskDetailWhyLines,
} from "./TaskDetailSheet";

const base = {
  id: "t1", workspaceId: "w1", version: 3, title: "Tailor CV", description: null, state: "not_started", priority: "medium", horizon: "weekly",
  categoryId: null, goalId: null, projectId: "p1", dueLocalDate: "2026-10-20", scheduledLocalDate: null, plannedStartAt: null, plannedEndAt: null,
  estimateMinutes: 45, scheduleMode: "manual", recurrenceRule: null, recurrenceUntilLocalDate: null,
};

function edited(fields: Record<string, unknown>, task = base) {
  const seed = seedTaskInspectorDraft(task);
  return { ...seed, fields: { ...seed.fields, ...fields }, changed: true };
}

describe("detail autosave", () => {
  it("labels the states: Saving while pending or in flight, then Saved", () => {
    expect(taskDetailSaveLabel("pending")).toBe("Saving");
    expect(taskDetailSaveLabel("saving")).toBe("Saving");
    expect(taskDetailSaveLabel("saved")).toBe("Saved");
    expect(taskDetailSaveLabel("queued")).toBe("Saved on this device");
    expect(taskDetailSaveLabel("error")).toBe("Not saved");
    expect(taskDetailSaveLabel("idle")).toBeNull();
  });

  it("sends only the fields the edit changed", () => {
    expect(changedTaskPatch(edited({ title: "Tailor CV for Fonterra" }).fields, base)).toEqual({ title: "Tailor CV for Fonterra" });
    expect(changedTaskPatch(edited({ projectId: "none", estimateMinutes: "60" }).fields, base)).toEqual({ projectId: null, estimateMinutes: 60 });
    expect(changedTaskPatch(seedTaskInspectorDraft(base).fields, base)).toEqual({});
  });

  it("writes recurrence as one rule with its anchor", () => {
    const patch = changedTaskPatch(edited({ recurrenceFrequency: "weekly", recurrenceWeekdays: [5, 1] }).fields, base);
    expect(patch.recurrenceRule).toEqual({ frequency: "weekly", interval: 1, weekdays: [1, 5] });
    expect(patch.recurrenceAnchor).toBe("scheduled");
  });

  it("does nothing for an untouched draft and pauses on a stale one", () => {
    expect(taskAutosaveDecision(seedTaskInspectorDraft(base), base)).toEqual({ kind: "none" });
    expect(taskAutosaveDecision(edited({ title: "New" }), { ...base, version: 4 })).toEqual({ kind: "stale" });
  });

  it("blocks invalid drafts with the reason, never writing", () => {
    expect(taskAutosaveDecision(edited({ title: "   " }), base)).toMatchObject({ kind: "invalid" });
    expect(taskAutosaveDecision(edited({ plannedStartAt: "2026-10-15T10:00", plannedEndAt: "2026-10-15T09:00" }), base)).toMatchObject({ kind: "invalid" });
  });

  it("saves a valid change", () => {
    expect(taskAutosaveDecision(edited({ priority: "high" }), base)).toEqual({ kind: "save", patch: { priority: "high" } });
  });
});

describe("detail Why it matters", () => {
  const reason = (kind: string) => ({ kind, family: "deadline", rank: 1, tone: "risk", icon: "CalendarClock", short: kind, long: `${kind} long`, accessible: kind, ref: null, basis: [] });

  it("shows at most 2 reason lines", () => {
    const lines = taskDetailWhyLines({ kind: "reasons", reasons: [reason("a"), reason("b"), reason("c")] as never });
    expect(lines).toMatchObject({ kind: "reasons" });
    expect(lines && lines.kind === "reasons" ? lines.reasons.map(item => item.kind) : []).toEqual(["a", "b"]);
  });

  it("keeps the Q43 empty line and hides when hidden", () => {
    expect(taskDetailWhyLines({ kind: "empty", message: "Not linked to a goal yet.", action: "link_goal" })).toEqual({ kind: "empty", message: "Not linked to a goal yet." });
    expect(taskDetailWhyLines({ kind: "hidden" })).toBeNull();
    expect(taskDetailWhyLines(null)).toBeNull();
  });
});

describe("detail morph", () => {
  it("starts the panel over the row (FLIP from the top-left origin)", () => {
    expect(sheetMorphStart({ left: 100, top: 300, width: 600, height: 56 }, { left: 960, top: 0, width: 480, height: 900 })).toEqual({ x: -860, y: 300, scaleX: 1, scaleY: 56 / 900 });
  });

  it("never scales from a zero or broken rect", () => {
    const start = sheetMorphStart({ left: 0, top: 0, width: 0, height: Number.NaN }, { left: 0, top: 0, width: 400, height: 800 });
    expect(Number.isFinite(start.scaleX) && Number.isFinite(start.scaleY)).toBe(true);
    expect(start.scaleX).toBeGreaterThan(0);
  });
});
