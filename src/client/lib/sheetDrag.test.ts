import { describe, expect, it } from "vite-plus/test";
import {
  UP_MAX,
  dragOffset,
  isSettled,
  releaseVelocity,
  scrimOpacity,
  shouldDismiss,
  springStep,
  type SpringState,
} from "./sheetDrag";

const HEIGHT = 500;

describe("shouldDismiss", () => {
  it("dismisses past 34% of the height", () => {
    expect(shouldDismiss(HEIGHT * 0.35, HEIGHT, 0)).toBe(true);
  });

  it("dismisses on a 0.6 px/ms flick at 5% distance", () => {
    expect(shouldDismiss(HEIGHT * 0.05, HEIGHT, 0.6)).toBe(true);
  });

  it("does not dismiss at 20% and slow", () => {
    expect(shouldDismiss(HEIGHT * 0.2, HEIGHT, 0.1)).toBe(false);
  });

  it("does not dismiss at exactly the thresholds", () => {
    expect(shouldDismiss(HEIGHT * 0.34, HEIGHT, 0.55)).toBe(false);
  });
});

describe("dragOffset", () => {
  it("follows the finger 1:1 going down", () => {
    expect(dragOffset(0)).toBe(0);
    expect(dragOffset(120)).toBe(120);
  });

  it("damps an upward drag and caps it at 28px", () => {
    expect(dragOffset(-50)).toBeLessThan(0);
    expect(Math.abs(dragOffset(-50))).toBeLessThan(50);
    expect(dragOffset(-5000)).toBe(-UP_MAX);
  });
});

describe("releaseVelocity", () => {
  it("reads px per ms across the samples", () => {
    expect(
      releaseVelocity([
        { t: 100, y: 0 },
        { t: 150, y: 40 },
      ]),
    ).toBeCloseTo(0.8);
  });

  it("is 0 with no samples", () => {
    expect(releaseVelocity([])).toBe(0);
  });
});

describe("scrimOpacity", () => {
  it("fades with distance and never goes negative", () => {
    expect(scrimOpacity(0, HEIGHT)).toBe(1);
    expect(scrimOpacity(HEIGHT / 2, HEIGHT)).toBeCloseTo(0.6);
    expect(scrimOpacity(HEIGHT * 3, HEIGHT)).toBeCloseTo(0.2);
    expect(scrimOpacity(-20, HEIGHT)).toBe(1);
  });
});

describe("springStep", () => {
  function simulate(start: SpringState, seconds: number) {
    const dt = 1 / 60;
    let state = start;
    let lowest = state.x;
    let settledAt: number | null = null;
    for (let t = 0; t < seconds; t += dt) {
      state = springStep(state, dt);
      lowest = Math.min(lowest, state.x);
      if (settledAt === null && isSettled(state)) settledAt = t;
    }
    return { state, lowest, settledAt };
  }

  it("settles to 0 within 1.5s", () => {
    const { state, settledAt } = simulate({ x: 120, v: 0 }, 1.5);
    expect(Math.abs(state.x)).toBeLessThan(0.5);
    expect(Math.abs(state.v)).toBeLessThan(8);
    expect(settledAt).not.toBeNull();
  });

  it("overshoots by less than 0.2 of the start distance", () => {
    const { lowest } = simulate({ x: 120, v: 0 }, 1.5);
    expect(-lowest).toBeLessThan(120 * 0.2);
  });

  it("caps a stalled frame so it cannot blow up", () => {
    const next = springStep({ x: 100, v: 0 }, 5);
    expect(Math.abs(next.x)).toBeLessThan(200);
  });
});
