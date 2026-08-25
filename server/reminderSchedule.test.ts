import { describe, expect, it } from "vitest";
import { parseReminderSchedule, reminderDueAt, serializeReminderSchedule } from "./reminderSchedule";

describe("timezone-aware reminder schedules", () => {
  it("serializes and parses the approved daily and Sunday schedules", () => {
    expect(serializeReminderSchedule({ kind: "daily", timeLocal: "11:00" })).toBe("daily@11:00");
    expect(parseReminderSchedule("weekly@0@17:00")).toEqual({ kind: "weekly", weekday: 0, timeLocal: "17:00" });
  });

  it("evaluates the same New Zealand local daily time across daylight saving and standard time", () => {
    expect(reminderDueAt("daily@11:00", "Pacific/Auckland", new Date("2026-01-04T22:00:00.000Z"))).toMatchObject({ due: true, localDate: "2026-01-05", localTime: "11:00" });
    expect(reminderDueAt("daily@11:00", "Pacific/Auckland", new Date("2026-07-05T23:00:00.000Z"))).toMatchObject({ due: true, localDate: "2026-07-06", localTime: "11:00" });
  });

  it("sends the weekly review only at the approved Sunday local time", () => {
    expect(reminderDueAt("weekly@0@17:00", "Pacific/Auckland", new Date("2026-01-04T04:00:00.000Z"))).toMatchObject({ due: true, localDate: "2026-01-04" });
    expect(reminderDueAt("weekly@0@17:00", "Pacific/Auckland", new Date("2026-01-05T04:00:00.000Z"))).toMatchObject({ due: false, localDate: "2026-01-05" });
  });
});
