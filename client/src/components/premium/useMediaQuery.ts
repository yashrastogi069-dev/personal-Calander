import { useEffect, useState } from "react";

/** The phone breakpoint shared by the shell and the premium pieces. */
export const PHONE_QUERY = "(max-width: 680px)";

/** Live media-query match. False when there is no window (SSR, tests). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false));
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);
  return matches;
}

export function useIsPhone(): boolean {
  return useMediaQuery(PHONE_QUERY);
}
