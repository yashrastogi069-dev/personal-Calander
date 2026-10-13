import { describe, expect, it } from "vitest";
import {
  isRecurrenceRule,
  isRecurringLocalDate,
  nextRecurringLocalDate,
  recurrenceCadenceLabel,
  recurrenceSeriesStart,
  recurringLocalDates,
  recurringTaskKeyDate,
  recurringTaskStatus,
  shiftLocalDate,
  upcomingRecurringLocalDates,
  type RecurrenceRule,
} from "@shared/taskRecurrence";
import * as serverRules from "./plannerRules";

// Frozen copy of the server implementation before the move (server/plannerRules.ts @ 91bb8d2).
const legacy = {
  shiftLocalDate(localDate: string, days: number) {
    const date = new Date(`${localDate}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  },
  isRecurringLocalDate(rule: RecurrenceRule, start: string, localDate: string, until?: string | null) {
    if (localDate < start || (until && localDate > until)) return false;
    const date = new Date(`${localDate}T12:00:00.000Z`);
    const anchor = new Date(`${start}T12:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || Number.isNaN(anchor.getTime())) return false;
    const interval = Math.max(1, Math.floor(rule.interval ?? 1));
    const daysFromStart = Math.floor((date.getTime() - anchor.getTime()) / 86_400_000);
    if (rule.frequency === "daily") return daysFromStart % interval === 0;
    if (rule.frequency === "weekly") return Math.floor(daysFromStart / 7) % interval === 0
      && (rule.weekdays?.includes(date.getUTCDay()) ?? date.getUTCDay() === anchor.getUTCDay());
    const monthOffset = (date.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + date.getUTCMonth() - anchor.getUTCMonth();
    return monthOffset % interval === 0 && date.getUTCDate() === anchor.getUTCDate();
  },
  recurringLocalDates(rule: RecurrenceRule, start: string, end: string, until?: string | null) {
    const cappedEnd = until && until < end ? until : end;
    const results: string[] = [];
    let cursor = start;
    let guard = 0;
    while (cursor <= cappedEnd && guard < 5000) {
      if (legacy.isRecurringLocalDate(rule, start, cursor, until)) results.push(cursor);
      cursor = legacy.shiftLocalDate(cursor, 1);
      guard += 1;
    }
    return results;
  },
};

const parityRules: RecurrenceRule[] = [
  { frequency: "daily" },
  { frequency: "daily", interval: 3 },
  { frequency: "weekly" },
  { frequency: "weekly", interval: 2 },
  { frequency: "weekly", weekdays: [1, 3, 5] },
  { frequency: "weekly", interval: 3, weekdays: [0, 6] },
  { frequency: "weekly", weekdays: [] },
  { frequency: "monthly" },
  { frequency: "monthly", interval: 2 },
  { frequency: "daily", interval: 0 },
  { frequency: "daily", interval: 2.7 },
];
const parityStarts = ["2026-01-31", "2026-02-28", "2026-09-24", "2026-10-13", "2028-02-29"];

describe("shared task recurrence", () => {
  it("returns the same dates as the old server copy over a 400-day window", () => {
    for (const rule of parityRules) {
      for (const start of parityStarts) {
        const end = legacy.shiftLocalDate(start, 400);
        for (const until of [null, legacy.shiftLocalDate(start, 120)]) {
          expect(recurringLocalDates(rule, start, end, until)).toEqual(legacy.recurringLocalDates(rule, start, end, until));
          for (let offset = -3; offset <= 400; offset += 1) {
            const day = legacy.shiftLocalDate(start, offset);
            expect(isRecurringLocalDate(rule, start, day, until)).toBe(legacy.isRecurringLocalDate(rule, start, day, until));
          }
        }
      }
    }
  });

  it("keeps the server re-exports pointing at the shared functions", () => {
    expect(serverRules.isRecurringLocalDate).toBe(isRecurringLocalDate);
    expect(serverRules.recurringLocalDates).toBe(recurringLocalDates);
    expect(serverRules.shiftLocalDate).toBe(shiftLocalDate);
    expect(shiftLocalDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftLocalDate("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("recognises only daily, weekly and monthly rules", () => {
    expect(isRecurrenceRule({ frequency: "daily" })).toBe(true);
    expect(isRecurrenceRule({ frequency: "yearly" })).toBe(false);
    expect(isRecurrenceRule(null)).toBe(false);
    expect(isRecurrenceRule("daily")).toBe(false);
  });

  it("anchors a series the way occurrence materialization does", () => {
    expect(recurrenceSeriesStart({ scheduledLocalDate: "2026-09-24", dueLocalDate: "2026-09-30" })).toBe("2026-09-24");
    expect(recurrenceSeriesStart({ scheduledLocalDate: null, dueLocalDate: "2026-09-30" })).toBe("2026-09-30");
    // Server fallback: the UTC day of createdAt (kept for parity with materializeTaskOccurrences).
    expect(recurrenceSeriesStart({ createdAt: "2026-09-23T20:00:00.000Z" })).toBe("2026-09-23");
    expect(recurrenceSeriesStart({ createdAt: new Date("2026-09-23T20:00:00.000Z") })).toBe("2026-09-23");
    expect(recurrenceSeriesStart({})).toBeNull();
  });

  describe("nextRecurringLocalDate", () => {
    it("finds daily, interval, weekly-with-weekdays and monthly cadence days", () => {
      expect(nextRecurringLocalDate({ frequency: "daily" }, "2026-09-24", "2026-10-14")).toBe("2026-10-14");
      expect(nextRecurringLocalDate({ frequency: "daily", interval: 3 }, "2026-10-01", "2026-10-14")).toBe("2026-10-16");
      // 2026-10-15 is a Thursday.
      expect(nextRecurringLocalDate({ frequency: "weekly", weekdays: [4] }, "2026-09-24", "2026-10-14")).toBe("2026-10-15");
      expect(nextRecurringLocalDate({ frequency: "weekly", interval: 2 }, "2026-09-24", "2026-10-14")).toBe("2026-10-22");
      expect(nextRecurringLocalDate({ frequency: "monthly" }, "2026-01-31", "2026-02-01")).toBe("2026-03-31");
    });

    it("starts at the series start when asked from before it", () => {
      expect(nextRecurringLocalDate({ frequency: "daily" }, "2026-11-01", "2026-10-14")).toBe("2026-11-01");
    });

    it("returns null once the series has ended or no cadence day exists", () => {
      expect(nextRecurringLocalDate({ frequency: "daily" }, "2026-09-24", "2026-10-14", "2026-10-13")).toBeNull();
      expect(nextRecurringLocalDate({ frequency: "weekly", weekdays: [] }, "2026-09-24", "2026-10-14")).toBeNull();
    });

    it("skips days the caller marks as already resolved", () => {
      expect(nextRecurringLocalDate({ frequency: "daily" }, "2026-09-24", "2026-10-14", null, day => day === "2026-10-14")).toBe("2026-10-15");
    });

    it("lists the next few dates for the detail preview", () => {
      expect(upcomingRecurringLocalDates({ frequency: "weekly", weekdays: [5, 6] }, "2026-10-01", "2026-10-14", 3)).toEqual(["2026-10-16", "2026-10-17", "2026-10-23"]);
      expect(upcomingRecurringLocalDates({ frequency: "daily" }, "2026-10-01", "2026-10-14", 5, "2026-10-15")).toEqual(["2026-10-14", "2026-10-15"]);
    });
  });

  it("labels cadence for the Repeat pill", () => {
    expect(recurrenceCadenceLabel({ frequency: "daily" })).toBe("Daily");
    expect(recurrenceCadenceLabel({ frequency: "daily", interval: 2 })).toBe("Every 2 days");
    expect(recurrenceCadenceLabel({ frequency: "weekly" })).toBe("Weekly");
    expect(recurrenceCadenceLabel({ frequency: "weekly", interval: 2 })).toBe("Every 2 weeks");
    expect(recurrenceCadenceLabel({ frequency: "monthly" })).toBe("Monthly");
    expect(recurrenceCadenceLabel({ frequency: "monthly", interval: 3 })).toBe("Every 3 months");
  });

  describe("recurringTaskStatus", () => {
    const daily = { id: "t1", recurrenceRule: { frequency: "daily" }, scheduledLocalDate: "2026-09-24" };
    const occurrence = (localDate: string, state: string, id = `o-${localDate}`) => ({ id, taskId: "t1", localDate, state, version: 2 });

    it("returns null for a task without a valid rule", () => {
      expect(recurringTaskStatus({ id: "t1", recurrenceRule: null }, "2026-10-14")).toBeNull();
      expect(recurringTaskStatus({ id: "t1", recurrenceRule: { frequency: "yearly" } }, "2026-10-14")).toBeNull();
    });

    it("uses today's pending occurrence", () => {
      const status = recurringTaskStatus(daily, "2026-10-14", [occurrence("2026-10-14", "pending")]);
      expect(status).toMatchObject({ kind: "pending_today", localDate: "2026-10-14", occurrence: { id: "o-2026-10-14" } });
      expect(recurringTaskKeyDate(status)).toBe("2026-10-14");
    });

    it("computes today without occurrence data, flagging that no occurrence row exists", () => {
      expect(recurringTaskStatus(daily, "2026-10-14")).toMatchObject({ kind: "pending_today", occurrence: null });
    });

    it("reports today's outcome and the next date after it", () => {
      expect(recurringTaskStatus(daily, "2026-10-14", [occurrence("2026-10-14", "completed")])).toMatchObject({ kind: "resolved_today", state: "completed", next: "2026-10-15" });
      expect(recurringTaskStatus(daily, "2026-10-14", [occurrence("2026-10-14", "skipped")])).toMatchObject({ kind: "resolved_today", state: "skipped" });
      expect(recurringTaskStatus(daily, "2026-10-14", [occurrence("2026-10-14", "completed"), occurrence("2026-10-15", "completed")])).toMatchObject({ next: "2026-10-16" });
    });

    it("shows the next weekly occurrence, never the anchor", () => {
      const weekly = { id: "t1", recurrenceRule: { frequency: "weekly", weekdays: [4] }, scheduledLocalDate: "2026-09-24" };
      expect(recurringTaskStatus(weekly, "2026-10-14")).toMatchObject({ kind: "next", localDate: "2026-10-15", occurrence: null });
      expect(recurringTaskStatus(weekly, "2026-10-14", [occurrence("2026-10-15", "pending")])).toMatchObject({ kind: "next", localDate: "2026-10-15", occurrence: { id: "o-2026-10-15" } });
    });

    it("prefers an earlier materialized pending occurrence (for example a moved one)", () => {
      const weekly = { id: "t1", recurrenceRule: { frequency: "weekly", weekdays: [4] }, scheduledLocalDate: "2026-09-24" };
      expect(recurringTaskStatus(weekly, "2026-10-12", [occurrence("2026-10-13", "pending")])).toMatchObject({ kind: "next", localDate: "2026-10-13" });
    });

    it("moves past a rescheduled occurrence today", () => {
      expect(recurringTaskStatus(daily, "2026-10-14", [occurrence("2026-10-14", "rescheduled")])).toMatchObject({ kind: "next", localDate: "2026-10-15" });
    });

    it("ends a series whose until date has passed", () => {
      expect(recurringTaskStatus({ ...daily, recurrenceUntilLocalDate: "2026-10-10" }, "2026-10-14")).toMatchObject({ kind: "ended", until: "2026-10-10" });
    });

    it("uses only materialized occurrences for a completion-anchored series", () => {
      const completion = { ...daily, recurrenceAnchor: "completion" };
      expect(recurringTaskStatus(completion, "2026-10-14")).toMatchObject({ kind: "after_completion" });
      expect(recurringTaskStatus(completion, "2026-10-14", [occurrence("2026-10-18", "pending")])).toMatchObject({ kind: "next", localDate: "2026-10-18" });
      expect(recurringTaskStatus(completion, "2026-10-14", [occurrence("2026-10-14", "pending")])).toMatchObject({ kind: "pending_today" });
    });

    it("ignores other tasks' occurrences and reports a rule with no reachable day", () => {
      expect(recurringTaskStatus(daily, "2026-10-14", [{ id: "x", taskId: "other", localDate: "2026-10-14", state: "completed" }])).toMatchObject({ kind: "pending_today", occurrence: null });
      expect(recurringTaskStatus({ id: "t1", recurrenceRule: { frequency: "weekly", weekdays: [] }, scheduledLocalDate: "2026-09-24" }, "2026-10-14")).toMatchObject({ kind: "none" });
    });
  });
});
