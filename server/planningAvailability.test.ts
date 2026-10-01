import { describe, expect, it } from "vitest";
import { firstFreeSlot, planningAvailability, zonedDateTimeCandidates, zonedDateTimeToUtc } from "../shared/planningAvailability";

const window = { workdayStartsAt: "09:00", workdayEndsAt: "17:00", defaultBreakMinutes: 30 };
const timezone = "Pacific/Auckland";
const localDate = "2026-08-27";

describe("planning availability", () => {
  it("deduplicates overlapping reserved and external busy time before reporting free minutes", () => {
    const summary = planningAvailability({
      localDate,
      timezone,
      window,
      reservedBlocks: [{ startsAt: "2026-08-26T21:00:00.000Z", endsAt: "2026-08-26T22:00:00.000Z" }],
      externalBusy: [{ startsAt: "2026-08-26T21:30:00.000Z", endsAt: "2026-08-26T22:30:00.000Z" }],
    });
    expect(summary.workdayMinutes).toBe(480);
    expect(summary.scheduledMinutes).toBe(60);
    expect(summary.externalBusyMinutes).toBe(60);
    expect(summary.mergedBusyMinutes).toBe(90);
    expect(summary.availableMinutes).toBe(390);
    expect(summary.freeMinutes).toBe(360);
  });

  it("suggests the first viable open slot without writing any reservation", () => {
    const slot = firstFreeSlot({
      localDate,
      timezone,
      window,
      durationMinutes: 45,
      reservedBlocks: [{ startsAt: "2026-08-26T21:00:00.000Z", endsAt: "2026-08-26T22:00:00.000Z" }],
    });
    expect(slot?.startAt.toISOString()).toBe("2026-08-26T22:00:00.000Z");
    expect(slot?.endAt.toISOString()).toBe("2026-08-26T22:45:00.000Z");
  });

  it("counts both repeated fall-back hours as distinct real time", () => {
    const summary = planningAvailability({
      localDate: "2026-11-01", timezone: "America/New_York",
      window: { workdayStartsAt: "00:00", workdayEndsAt: "04:00", defaultBreakMinutes: 0 },
      reservedBlocks: [{ startsAt: "2026-11-01T05:15:00.000Z", endsAt: "2026-11-01T05:45:00.000Z" }],
      externalBusy: [{ startsAt: "2026-11-01T06:15:00.000Z", endsAt: "2026-11-01T06:45:00.000Z" }],
    });
    expect(summary).toMatchObject({ workdayMinutes: 300, scheduledMinutes: 30, externalBusyMinutes: 30, mergedBusyMinutes: 60, freeMinutes: 240 });
  });

  it("uses elapsed minutes across a spring-forward window", () => {
    const summary = planningAvailability({ localDate: "2026-03-08", timezone: "America/New_York", window: { workdayStartsAt: "01:00", workdayEndsAt: "04:00", defaultBreakMinutes: 0 } });
    expect(summary.workdayMinutes).toBe(120);
    expect(summary.freeMinutes).toBe(120);
  });

  it("rejects a wall time that does not exist during spring-forward", () => {
    expect(() => zonedDateTimeToUtc("2026-03-08", 2 * 60 + 30, "America/New_York")).toThrow(/does not exist/i);
  });

  it("exposes both instants for a repeated fall-back wall time", () => {
    expect(zonedDateTimeCandidates("2026-11-01", 90, "America/New_York").map(value => value.toISOString())).toEqual([
      "2026-11-01T05:30:00.000Z", "2026-11-01T06:30:00.000Z",
    ]);
  });

  it("includes the second occurrence when an availability window ends in a repeated hour", () => {
    const summary = planningAvailability({ localDate: "2026-11-01", timezone: "America/New_York", window: { workdayStartsAt: "00:00", workdayEndsAt: "01:30", defaultBreakMinutes: 0 } });
    expect(summary.workdayMinutes).toBe(150);
  });
});
