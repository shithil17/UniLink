import { describe, expect, it } from "vite-plus/test";
import { blockBox, nowOffset, SAMPLE_WEEK, todayLetter } from "./sampleWeek";

// 2026-10-25 is a Sunday. Dhaka is UTC+6, so 10:00 Dhaka is 04:00 UTC.
const dhaka = (h: number, m = 0) => Date.UTC(2026, 9, 25, h - 6, m);

describe("sample week", () => {
  it("keeps every sample class inside the board", () => {
    for (const c of SAMPLE_WEEK) {
      const { left, width } = blockBox(c.start, c.end);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left + width).toBeLessThanOrEqual(100);
    }
  });

  it("takes today from the Dhaka day, not UTC", () => {
    // 01:00 Monday in Dhaka is still Sunday in UTC.
    expect(todayLetter(Date.UTC(2026, 9, 25, 19))).toBe("M");
    expect(todayLetter(dhaka(10))).toBe("S");
  });

  it("hides the now line outside class hours", () => {
    expect(nowOffset(dhaka(7, 59))).toBeNull();
    expect(nowOffset(dhaka(15, 1))).toBeNull();
  });
});
