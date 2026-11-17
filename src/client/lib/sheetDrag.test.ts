import { describe, expect, it } from "vite-plus/test";
import {
  TAP_SLOP,
  UP_MAX,
  dragOffset,
  expandedDragOffset,
  isSettled,
  isTap,
  openness,
  peekDragOffset,
  releaseVelocity,
  scrimOpacity,
  shouldCollapse,
  shouldDismiss,
  shouldExpand,
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

describe("collapsible drag", () => {
  const TRAVEL = 400;

  it("collapses past a third of the travel or on a down flick, otherwise settles", () => {
    expect(shouldCollapse(TRAVEL * 0.35, TRAVEL, 0)).toBe(true);
    expect(shouldCollapse(TRAVEL * 0.05, TRAVEL, 0.6)).toBe(true);
    expect(shouldCollapse(TRAVEL * 0.2, TRAVEL, 0.1)).toBe(false);
    expect(shouldCollapse(TRAVEL * 0.34, TRAVEL, 0.55)).toBe(false);
  });

  it("expands past a fifth of the lift or on an up flick, otherwise settles", () => {
    expect(shouldExpand(-TRAVEL * 0.25, TRAVEL, 0)).toBe(true);
    expect(shouldExpand(-TRAVEL * 0.02, TRAVEL, -0.5)).toBe(true);
    expect(shouldExpand(-TRAVEL * 0.1, TRAVEL, -0.1)).toBe(false);
    // Pushing down on a collapsed sheet never expands it.
    expect(shouldExpand(20, TRAVEL, 0.9)).toBe(false);
  });

  it("tells a tap from a drag by the slop", () => {
    expect(isTap(TAP_SLOP - 1)).toBe(true);
    expect(isTap(TAP_SLOP)).toBe(false);
  });

  it("follows an open sheet down 1:1 to the peek, then gives way", () => {
    expect(expandedDragOffset(120, TRAVEL)).toBe(120);
    expect(expandedDragOffset(TRAVEL, TRAVEL)).toBe(TRAVEL);
    const past = expandedDragOffset(TRAVEL + 500, TRAVEL);
    expect(past).toBeGreaterThan(TRAVEL);
    expect(past).toBeLessThanOrEqual(TRAVEL + UP_MAX);
    // Upward is damped as on a plain sheet.
    expect(expandedDragOffset(-300, TRAVEL)).toBe(dragOffset(-300));
  });

  it("follows a collapsed sheet up 1:1 to open, then gives way, and damps a pull down", () => {
    expect(peekDragOffset(-120, TRAVEL)).toBe(-120);
    const past = peekDragOffset(-TRAVEL - 500, TRAVEL);
    expect(past).toBeLessThan(-TRAVEL);
    expect(past).toBeGreaterThanOrEqual(-TRAVEL - UP_MAX);
    expect(peekDragOffset(300, TRAVEL)).toBeLessThanOrEqual(UP_MAX);
  });

  it("fades the scrim to nothing at the peek and back to full when open", () => {
    expect(openness(0, TRAVEL, false)).toBe(1);
    expect(openness(TRAVEL, TRAVEL, false)).toBe(0);
    expect(openness(TRAVEL / 2, TRAVEL, false)).toBe(0.5);
    expect(openness(0, TRAVEL, true)).toBe(0);
    expect(openness(-TRAVEL, TRAVEL, true)).toBe(1);
    expect(openness(30, TRAVEL, true)).toBe(0);
    expect(openness(10, 0, false)).toBe(1);
  });
});
