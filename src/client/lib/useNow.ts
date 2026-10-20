import { useEffect, useState } from "react";

// ceiling: the clock on Home and the routine redraws twice a minute. Class times are whole minutes
// and "starts in N min" is rounded up, so a 30 s lag is invisible. Revisit if seconds are shown.
export const CLOCK_TICK_MS = 30_000;

/** The current instant (UTC epoch ms), refreshed every `CLOCK_TICK_MS` so "now" and "done" stay true while the screen is open. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, CLOCK_TICK_MS);
    // A phone that slept comes back with a stale clock; catch up as soon as it is visible again.
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return now;
}
