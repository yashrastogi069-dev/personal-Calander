import { afterEach, describe, expect, it, vi } from "vitest";
import { withTimeout } from "../shared/withTimeout";

afterEach(() => vi.useRealTimers());
describe("bounded authentication waits", () => {
  it("reports a hung session lookup and clears the timer", async () => {
    vi.useFakeTimers();
    const result = expect(withTimeout(new Promise(() => {}), 100, "Session unavailable")).rejects.toThrow("Session unavailable");
    await vi.advanceTimersByTimeAsync(100);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });
  it("returns successful sessions and propagates failures without leftover timers", async () => {
    vi.useFakeTimers();
    await expect(withTimeout(Promise.resolve("session"), 100, "Timeout")).resolves.toBe("session");
    await expect(withTimeout(Promise.reject(new Error("Offline")), 100, "Timeout")).rejects.toThrow("Offline");
    expect(vi.getTimerCount()).toBe(0);
  });
});
