import { useSyncExternalStore } from "react";

/**
 * Whether a CSS media query matches right now, kept live. Read synchronously on the first render, so
 * a layout that depends on it never flashes the wrong branch. Use it only when the two branches are
 * different components (a sheet on phones, a side panel on wide screens); plain styling stays in
 * Tailwind classes.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
