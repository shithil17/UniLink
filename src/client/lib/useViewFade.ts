import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** How long the old view fades out, and the new one fades in. */
export const VIEW_FADE_MS = 110;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Swap between views of one screen (Month, Week, Day) with a quick opacity-only fade. `value` is
 * the view the student asked for; `shown` is the view to draw, which trails it by one fade-out
 * (110ms). Draw the content from `shown` and give it `opacity-0` while `fading`: the old view fades
 * out, the content swaps, then the new one fades in. The page keeps its scroll position across the
 * swap. Under reduced motion there is no fade and `shown` follows `value` at once.
 */
export function useViewFade<T>(value: T) {
  const [shown, setShown] = useState(value);
  // True from the swap until the next frame, so the new view is painted at opacity 0 first.
  const [revealing, setRevealing] = useState(false);
  const scrollY = useRef<number | null>(null);
  // Read while drawing, so reduced motion needs no state change and no second render.
  const instant = reducedMotion();

  useEffect(() => {
    if (instant || value === shown) return;
    const timer = setTimeout(() => {
      scrollY.current = window.scrollY;
      setShown(value);
      setRevealing(true);
    }, VIEW_FADE_MS);
    return () => clearTimeout(timer);
  }, [instant, value, shown]);

  // The new view is in the DOM: put the page back where it was.
  useLayoutEffect(() => {
    if (scrollY.current === null) return;
    window.scrollTo(0, scrollY.current);
    scrollY.current = null;
  }, [shown]);

  useEffect(() => {
    if (!revealing) return;
    const frame = requestAnimationFrame(() => setRevealing(false));
    return () => cancelAnimationFrame(frame);
  }, [revealing]);

  if (instant) return { shown: value, fading: false };
  return { shown, fading: value !== shown || revealing };
}
