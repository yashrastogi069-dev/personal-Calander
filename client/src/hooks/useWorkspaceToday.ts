import { useEffect, useState } from "react";
import { localDateInTimezone } from "@/lib/workspace";

/** Advance today's evidence window without changing a deliberately selected date. */
export function followWorkspaceToday(selectedDate: string, previousToday: string, today: string) {
  return selectedDate === previousToday ? today : selectedDate;
}

export function useWorkspaceToday(timezone: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [timezone]);
  return localDateInTimezone(timezone, new Date(now));
}
