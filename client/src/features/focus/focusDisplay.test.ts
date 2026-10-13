import { describe, expect, it } from "vitest";
import {
  clampFocusTarget,
  focusAnnouncement,
  focusDialGeometry,
  focusEndsAround,
  focusMeetingNotch,
  focusOvertimeLabel,
  focusPausedLabel,
  focusTimerSentence,
  formatFocusClock,
  formatFocusMinutes,
  groupFocusTasks,
  isValidFocusTarget,
  recentFocusHandoff,
} from "./focusDisplay";

describe("focus instrument digits", () => {
  it("uses MM:SS under an hour and keeps seconds as H:MM:SS after", () => {
    expect(formatFocusClock(0)).toBe("00:00");
    expect(formatFocusClock(14 * 60 + 32)).toBe("14:32");
    expect(formatFocusClock(3599)).toBe("59:59");
    expect(formatFocusClock(3600)).toBe("1:00:00");
    expect(formatFocusClock(3600 + 5 * 60 + 9.8)).toBe("1:05:09");
    expect(formatFocusClock(-4)).toBe("00:00");
    expect(formatFocusClock(Number.NaN)).toBe("00:00");
  });

  it("formats compact minutes", () => {
    expect(formatFocusMinutes(25)).toBe("25m");
    expect(formatFocusMinutes(90)).toBe("1h 30m");
    expect(formatFocusMinutes(120)).toBe("2h");
  });

  it("keeps targets inside 5-240 minutes", () => {
    expect(clampFocusTarget(2)).toBe(5);
    expect(clampFocusTarget(500)).toBe(240);
    expect(isValidFocusTarget(25)).toBe(true);
    expect(isValidFocusTarget(4)).toBe(false);
    expect(isValidFocusTarget(25.5)).toBe(false);
  });
});

describe("focus dial geometry", () => {
  it("fills the arc to the target, then grows the overtime lap", () => {
    expect(focusDialGeometry(0, 25)).toEqual({ arc: 0, lap: 0, over: false, lit: 0 });
    const half = focusDialGeometry(12.5 * 60, 25);
    expect(half.arc).toBeCloseTo(0.5);
    expect(half.lit).toBe(30);
    const over = focusDialGeometry(31 * 60, 25);
    expect(over).toMatchObject({ arc: 1, over: true, lit: 60 });
    expect(over.lap).toBeCloseTo(6 / 25);
    expect(focusDialGeometry(100 * 60, 25).lap).toBe(1);
    expect(focusDialGeometry(60, 25, 30).lit).toBe(1);
  });

  it("labels overtime without warning language", () => {
    expect(focusOvertimeLabel(24 * 60, 25)).toBeNull();
    expect(focusOvertimeLabel(25 * 60, 25)).toBe("+1m");
    expect(focusOvertimeLabel(31 * 60, 25)).toBe("+6m");
    expect(focusOvertimeLabel(25 * 60 + 90 * 60, 25)).toBe("+1h 30m");
  });
});

describe("focus minute-level text", () => {
  it("reads minutes of target and the task, once a minute", () => {
    expect(focusTimerSentence(14 * 60 + 59, 25, "Draft Q4 report")).toBe("14 minutes of 25, Draft Q4 report");
    expect(focusTimerSentence(60, 25, "Read")).toBe("1 minute of 25, Read");
  });

  it("estimates the end only while running and before the target", () => {
    const now = Date.UTC(2026, 9, 13, 11, 57);
    expect(focusEndsAround(now, 11 * 60, 25, true, "UTC")).toMatch(/^ends ~12:11/);
    expect(focusEndsAround(now, 11 * 60, 25, false, "UTC")).toBeNull();
    expect(focusEndsAround(now, 26 * 60, 25, true, "UTC")).toBeNull();
  });

  it("names the pause time when saved", () => {
    expect(focusPausedLabel("2026-10-13T11:58:00Z", "UTC")).toMatch(/^Paused at 11:58/);
    expect(focusPausedLabel(null)).toBe("Paused");
  });

  it("marks a meeting only when it starts before the target", () => {
    const now = 1_000_000;
    expect(focusMeetingNotch(now + 10 * 60_000, now, 10 * 60, 25)).toBeCloseTo(20 / 25);
    expect(focusMeetingNotch(now + 30 * 60_000, now, 10 * 60, 25)).toBeNull();
    expect(focusMeetingNotch(now - 60_000, now, 10 * 60, 25)).toBeNull();
    expect(focusMeetingNotch(null, now, 10 * 60, 25)).toBeNull();
  });
});

describe("focus announcements", () => {
  const base = { id: "s1", state: "active" as const, elapsedSeconds: 60, targetMinutes: 25 };
  it("announces start, pause, resume, warnings and save, never seconds", () => {
    expect(focusAnnouncement(null, base)).toBe("Focus started, 25 minute target.");
    expect(focusAnnouncement(base, { ...base, state: "paused", elapsedSeconds: 14 * 60 + 3 })).toBe("Paused at 14 minutes.");
    expect(focusAnnouncement({ ...base, state: "paused" }, base)).toBe("Resumed.");
    expect(focusAnnouncement({ ...base, elapsedSeconds: 19 * 60 + 59 }, { ...base, elapsedSeconds: 20 * 60 })).toBe("5 minutes to target.");
    expect(focusAnnouncement({ ...base, elapsedSeconds: 25 * 60 - 1 }, { ...base, elapsedSeconds: 25 * 60 })).toBe("Target reached.");
    expect(focusAnnouncement(base, { ...base, elapsedSeconds: 61 })).toBeNull();
    expect(focusAnnouncement({ ...base, elapsedSeconds: 14 * 60 }, null)).toBe("Session saved, 14 minutes.");
    expect(focusAnnouncement(null, null)).toBeNull();
  });
});

describe("focus task picker grouping", () => {
  it("puts today's planned or due tasks first", () => {
    const groups = groupFocusTasks([
      { id: "a", scheduledLocalDate: "2026-10-13" },
      { id: "b", dueLocalDate: "2026-10-20" },
      { id: "c", dueLocalDate: "2026-10-13" },
    ], "2026-10-13");
    expect(groups.today.map(task => task.id)).toEqual(["a", "c"]);
    expect(groups.other.map(task => task.id)).toEqual(["b"]);
  });
});

describe("recent focus handoff", () => {
  const now = Date.parse("2026-10-13T12:00:00Z");
  it("offers the newest finished session for ten minutes until a next step is saved", () => {
    const sessions = [
      { id: "old", state: "completed", endedAt: "2026-10-13T11:40:00Z", nextStepAction: null },
      { id: "new", state: "abandoned", endedAt: "2026-10-13T11:55:00Z", nextStepAction: null },
      { id: "open", state: "active", endedAt: null },
    ];
    expect(recentFocusHandoff(sessions, now)?.id).toBe("new");
    expect(recentFocusHandoff(sessions, now + 11 * 60_000)).toBeNull();
    expect(recentFocusHandoff([{ ...sessions[1], nextStepAction: "plan" }], now)).toBeNull();
  });
});
