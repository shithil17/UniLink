import { describe, expect, it } from "vite-plus/test";
import {
  DOCK_HIDE_DELTA_PX,
  DOCK_SHOW_DELTA_PX,
  initialDockState,
  nextDockState,
  type DockScrollState,
} from "./useDockHidden";

const MAX = 2000;
const at = (y: number, hidden = false): DockScrollState => ({ hidden, lastY: y, acc: 0 });

describe("nextDockState", () => {
  it("hides after 12px of downward travel", () => {
    let s = at(200);
    s = nextDockState(s, 200 + DOCK_HIDE_DELTA_PX - 1, MAX);
    expect(s.hidden).toBe(false);
    s = nextDockState(s, 200 + DOCK_HIDE_DELTA_PX, MAX);
    expect(s.hidden).toBe(true);
  });

  it("ignores small jitter that changes direction", () => {
    let s = at(200);
    for (const y of [205, 201, 206, 202, 207, 203]) s = nextDockState(s, y, MAX);
    expect(s.hidden).toBe(false);
  });

  it("shows after 8px of upward travel", () => {
    let s = at(500, true);
    s = nextDockState(s, 500 - DOCK_SHOW_DELTA_PX + 1, MAX);
    expect(s.hidden).toBe(true);
    s = nextDockState(s, 500 - DOCK_SHOW_DELTA_PX, MAX);
    expect(s.hidden).toBe(false);
  });

  it("is always shown near the top", () => {
    expect(nextDockState(at(100, true), 10, MAX).hidden).toBe(false);
  });

  it("is shown at the bottom of the document", () => {
    expect(nextDockState(at(1900, true), MAX - 1, MAX).hidden).toBe(false);
  });

  it("clamps rubber-band negative scroll to the top", () => {
    const s = nextDockState(at(100, true), -40, MAX);
    expect(s.hidden).toBe(false);
    expect(s.lastY).toBe(0);
  });

  it("starts shown", () => {
    expect(initialDockState.hidden).toBe(false);
  });
});
