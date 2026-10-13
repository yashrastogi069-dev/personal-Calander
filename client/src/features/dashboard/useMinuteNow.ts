import { useEffect, useState } from "react";

/** Current time, refreshed on each minute boundary while `active`, and again when the page wakes or regains focus. */
export function useMinuteNow(active = true): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    // Re-align to the next minute boundary; timers drift or pause while a device sleeps.
    const schedule = () => {
      clearTimeout(timeout);
      clearInterval(interval);
      interval = undefined;
      setNow(new Date());
      timeout = setTimeout(() => {
        setNow(new Date());
        interval = setInterval(() => setNow(new Date()), 60_000);
      }, 60_000 - (Date.now() % 60_000));
    };
    const wake = () => {
      if (document.visibilityState === "visible") schedule();
    };
    schedule();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, [active]);
  return now;
}
