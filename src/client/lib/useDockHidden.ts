import { useEffect, useState } from "react";

// ceiling: 12px of downward travel before the dock hides, so a thumb jitter never hides it.
// Revisit if testers report it hiding too eagerly or too late.
export const DOCK_HIDE_DELTA_PX = 12;
// ceiling: 8px of upward travel brings it back; smaller than the hide delta so reaching for the
// bar feels instant. Revisit if it flickers on slow scrolls.
export const DOCK_SHOW_DELTA_PX = 8;
// ceiling: within 24px of the top the dock is always shown. Revisit if screens gain a tall header.
export const DOCK_TOP_ZONE_PX = 24;
// ceiling: within 2px of the document end the dock is shown so it never covers the last content.
const DOCK_BOTTOM_ZONE_PX = 2;

/** Phones only: matches Tailwind's `md` breakpoint (48rem). */
const PHONE_QUERY = "(width < 48rem)";

export type DockScrollState = {
  hidden: boolean;
  lastY: number;
  /** Signed distance travelled in the current direction (positive is down). */
  acc: number;
};

export const initialDockState: DockScrollState = { hidden: false, lastY: 0, acc: 0 };

/** Pure scroll decision. `maxY` is `scrollHeight - innerHeight`. */
export function nextDockState(prev: DockScrollState, rawY: number, maxY: number): DockScrollState {
  const y = Math.max(0, rawY); // iOS rubber band reports negative scrollY
  if (y <= DOCK_TOP_ZONE_PX || y >= maxY - DOCK_BOTTOM_ZONE_PX) {
    return { hidden: false, lastY: y, acc: 0 };
  }
  const delta = y - prev.lastY;
  if (delta === 0) return prev;
  const acc = Math.sign(delta) === Math.sign(prev.acc) ? prev.acc + delta : delta;
  let hidden = prev.hidden;
  if (acc >= DOCK_HIDE_DELTA_PX) hidden = true;
  else if (acc <= -DOCK_SHOW_DELTA_PX) hidden = false;
  return { hidden, lastY: y, acc };
}

/** True while the phone tab bar should be slid away (scrolling down). Always false from `md` up. */
export function useDockHidden(): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    let state = initialDockState;
    let frame = 0;

    const update = () => {
      frame = 0;
      const maxY = document.documentElement.scrollHeight - window.innerHeight;
      state = nextDockState(state, window.scrollY, maxY);
      setHidden(state.hidden);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const attach = () => {
      if (!mq.matches) {
        window.removeEventListener("scroll", onScroll);
        state = initialDockState;
        setHidden(false);
        return;
      }
      state = { ...initialDockState, lastY: Math.max(0, window.scrollY) };
      window.addEventListener("scroll", onScroll, { passive: true });
    };

    attach();
    mq.addEventListener("change", attach);
    return () => {
      mq.removeEventListener("change", attach);
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return hidden;
}
