import { useEffect, useState, type CSSProperties } from "react";

/**
 * Route ids whose list entrance has already played this session. Module-level on purpose: it
 * survives a screen unmounting and remounting as the student moves between tabs, and a full reload
 * (a new session) starts it empty again.
 */
const seen = new Set<string>();

/** Forget every seen route. Tests only. */
export function resetStagger() {
  seen.clear();
}

/**
 * Whether a screen should play the `stagger` list entrance: true on its first visit this session,
 * false after that. Call it once in the screen component and add the `stagger` class to the list
 * only when it returns true. The answer is fixed for the life of the mounted screen, so rows that
 * load later do not start animating mid-visit.
 *
 * The id is marked seen in an effect, not while reading, so React's double render in development
 * cannot use up the first visit.
 *
 * ceiling: in memory only, so a reload replays each screen's entrance once. That is cheap and keeps
 * the entrance a first-load touch; revisit if students find the replay after a reload tiresome.
 */
export function useStagger(routeId: string): boolean {
  const [apply] = useState(() => !seen.has(routeId));
  useEffect(() => {
    seen.add(routeId);
  }, [routeId]);
  return apply;
}

/** The `--k` position of a row in a `stagger` list (capped at row 9 by the CSS). */
export function staggerRow(k: number): CSSProperties {
  return { "--k": k } as CSSProperties;
}
