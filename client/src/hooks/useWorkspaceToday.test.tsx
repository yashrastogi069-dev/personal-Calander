import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { followWorkspaceToday, useWorkspaceToday } from "./useWorkspaceToday";

afterEach(() => vi.useRealTimers());

describe("workspace today continuity", () => {
  it("follows midnight only for a date that was following today", () => {
    expect(followWorkspaceToday("2026-10-03", "2026-10-03", "2026-10-04")).toBe("2026-10-04");
    expect(followWorkspaceToday("2026-10-15", "2026-10-03", "2026-10-04")).toBe("2026-10-15");
    expect(followWorkspaceToday("2026-09-30", "2026-10-03", "2026-10-04")).toBe("2026-09-30");
  });

  it("renders the workspace local date rather than the browser UTC date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-03T19:00:00Z"));
    function Probe({ timezone }: { timezone: string }) {
      return <time>{useWorkspaceToday(timezone)}</time>;
    }
    expect(renderToString(<Probe timezone="Asia/Kolkata" />)).toContain("2026-10-04");
    expect(renderToString(<Probe timezone="America/Los_Angeles" />)).toContain("2026-10-03");
  });
});
