import { describe, expect, it } from "vitest";
import { firstFreeSlot, planningAvailability } from "../shared/planningAvailability";

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
});
