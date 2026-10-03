import { describe, expect, it } from "vitest";
import { splitFocusInterval } from "./focusTime";

describe("Focus active interval date buckets", () => {
  it.each([
    ["2026-10-02T23:59:50Z", "2026-10-03T00:00:10Z", "UTC", ["2026-10-02", "2026-10-03"], [10, 10]],
    ["2026-10-02T18:29:50Z", "2026-10-02T18:30:10Z", "Asia/Kolkata", ["2026-10-02", "2026-10-03"], [10, 10]],
    ["2026-03-08T05:00:00Z", "2026-03-09T04:00:00Z", "America/New_York", ["2026-03-08"], [82800]],
    ["2026-11-01T04:00:00Z", "2026-11-02T05:00:00Z", "America/New_York", ["2026-11-01"], [90000]],
  ])("splits %s through %s in %s", (start, end, timezone, dates, seconds) => {
    const buckets = splitFocusInterval(new Date(start), new Date(end), timezone);
    expect(buckets.map(bucket => bucket.localDate)).toEqual(dates);
    expect(buckets.map(bucket => bucket.activeSeconds)).toEqual(seconds);
    expect(buckets.every(bucket => bucket.timezone === timezone)).toBe(true);
    expect(buckets[0].startedAt).toEqual(new Date(start));
    expect(buckets.at(-1)?.endedAt).toEqual(new Date(end));
  });

  it("conserves fractional remainder across midnight", () => {
    const buckets = splitFocusInterval(new Date("2026-10-02T23:59:59.600Z"), new Date("2026-10-03T00:00:01.700Z"), "UTC");
    expect(buckets.map(bucket => bucket.activeSeconds)).toEqual([0, 2]);
    expect(buckets[0].endedAt.toISOString()).toBe("2026-10-03T00:00:00.000Z");
    expect(buckets[1].startedAt).toEqual(buckets[0].endedAt);
  });

  it("sums only separate active intervals and excludes the paused gap", () => {
    const buckets = [
      ...splitFocusInterval(new Date("2026-10-02T23:59:50Z"), new Date("2026-10-03T00:00:05Z"), "UTC"),
      ...splitFocusInterval(new Date("2026-10-03T00:10:00Z"), new Date("2026-10-03T00:10:20Z"), "UTC"),
    ];
    expect(buckets.map(bucket => bucket.activeSeconds)).toEqual([10, 5, 20]);
  });

  it("rejects invalid dates, backwards ranges, and unknown timezones", () => {
    expect(() => splitFocusInterval(new Date(NaN), new Date(), "UTC")).toThrow();
    expect(() => splitFocusInterval(new Date("2026-10-03"), new Date("2026-10-02"), "UTC")).toThrow();
    expect(() => splitFocusInterval(new Date("2026-10-02"), new Date("2026-10-03"), "Not/AZone")).toThrow();
    expect(splitFocusInterval(new Date("2026-10-02"), new Date("2026-10-02"), "UTC")).toEqual([]);
  });
});
