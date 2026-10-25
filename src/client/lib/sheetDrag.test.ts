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
  it.each([
    ["past 34% of the height", 0.35, 0, true],
    ["on a fast flick at 5% distance", 0.05, 0.6, true],
    ["not at 20% and slow", 0.2, 0.1, false],
    ["not at exactly the thresholds", 0.34, 0.55, false],
  ])("dismisses %s", (_name, fraction, velocity, expected) => {
    expect(shouldDismiss(HEIGHT * fraction, HEIGHT, velocity)).toBe(expected);
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
    expect(scrimOpacity(HEIGHT / 2, HEIGHT)).toBeLessThan(1);
    expect(scrimOpacity(HEIGHT * 3, HEIGHT)).toBeGreaterThanOrEqual(0);
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

  it("settles to 0 within 1.5s, overshooting by less than 0.2 of the start distance", () => {
    const { state, lowest, settledAt } = simulate({ x: 120, v: 0 }, 1.5);
    expect(Math.abs(state.x)).toBeLessThan(0.5);
    expect(settledAt).not.toBeNull();
    expect(-lowest).toBeLessThan(120 * 0.2);
  });

  it("caps a stalled frame so it cannot blow up", () => {
    const next = springStep({ x: 100, v: 0 }, 5);
    expect(Math.abs(next.x)).toBeLessThan(200);
  });
});
