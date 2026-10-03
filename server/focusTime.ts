export type FocusIntervalBucket = { startedAt: Date; endedAt: Date; localDate: string; timezone: string; activeSeconds: number };

export function splitFocusInterval(start: Date, end: Date, timezone: string): FocusIntervalBucket[] {
  const first = start.getTime();
  const last = end.getTime();
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) throw new Error("Invalid Focus interval range.");
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  const localDateAt = (instant: number) => {
    const parts = formatter.formatToParts(new Date(instant));
    return ["year", "month", "day"].map(key => parts.find(part => part.type === key)!.value).join("-");
  };
  const buckets: FocusIntervalBucket[] = [];
  let cursor = first;
  while (cursor < last) {
    const localDate = localDateAt(cursor);
    let low = cursor;
    let high = Math.min(last, low + 6 * 60 * 60 * 1000);
    // Locate the real date transition, rather than assuming a day lasts 24 hours.
    while (high < last && localDateAt(high) === localDate) {
      low = high;
      high = Math.min(last, high + 6 * 60 * 60 * 1000);
    }
    if (localDateAt(high) !== localDate) {
      while (high - low > 1) {
        const middle = low + Math.floor((high - low) / 2);
        if (localDateAt(middle) === localDate) low = middle;
        else high = middle;
      }
    }
    const boundary = high;
    buckets.push({ startedAt: new Date(cursor), endedAt: new Date(boundary), localDate, timezone,
      // Cumulative flooring retains a fractional second carried across midnight.
      activeSeconds: Math.floor((boundary - first) / 1000) - Math.floor((cursor - first) / 1000) });
    cursor = boundary;
  }
  return buckets;
}
