import { describe, expect, it } from "vitest";
import { displayLocalDate } from "./workspace";

describe("displayLocalDate", () => {
  it("shows the stored calendar day in every workspace zone", () => {
    // 2026-10-14 is a Wednesday. Auckland is UTC+13 in October, Pago Pago UTC-11.
    for (const zone of ["Pacific/Auckland", "Pacific/Kiritimati", "UTC", "America/Los_Angeles", "Pacific/Pago_Pago"]) {
      expect(displayLocalDate("2026-10-14", zone)).toBe("Wed, Oct 14");
    }
  });

  it("keeps caller formatting options", () => {
    expect(displayLocalDate("2026-10-14", "Pacific/Auckland", { month: "long", day: "numeric", year: "numeric" })).toBe("October 14, 2026");
  });
});
