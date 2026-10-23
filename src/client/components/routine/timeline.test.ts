import { describe, expect, it } from "vite-plus/test";
import { hourLabel, nowOffset, timelineRange } from "./timeline";

// Dhaka is UTC+6, so 10:00 there is 04:00 UTC.
const at = (h: number, m = 0) => Date.UTC(2026, 9, 20, h - 6, m);

describe("timelineRange", () => {
  it("runs from the first class's hour down to the last class's end, rounded up", () => {
    expect(
      timelineRange([
        { start: "09:30", end: "10:45" },
        { start: "13:00", end: "14:05" },
      ]),
    ).toEqual({ from: 9, to: 15 });
    expect(timelineRange([{ start: "09:00", end: "10:00" }])).toEqual({ from: 9, to: 10 });
  });

  it("is null with no classes", () => {
    expect(timelineRange([])).toBeNull();
  });
});

describe("nowOffset", () => {
  const range = { from: 9, to: 12 };
  it("counts hours below the top line, read in Dhaka", () => {
    expect(nowOffset(range, at(9))).toBe(0);
    expect(nowOffset(range, at(10, 30))).toBe(1.5);
    expect(nowOffset(range, at(12))).toBe(3);
  });
  it("is null outside the hours shown", () => {
    expect(nowOffset(range, at(8, 59))).toBeNull();
    expect(nowOffset(range, at(12, 1))).toBeNull();
  });
});

describe("hourLabel", () => {
  it("writes hours the NSU way", () => {
    expect([8, 12, 13, 24].map(hourLabel)).toEqual(["8 AM", "12 PM", "1 PM", "12 AM"]);
  });
});
