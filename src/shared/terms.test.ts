import { describe, expect, it } from "vite-plus/test";
import { currentTerm } from "./terms";

describe("currentTerm", () => {
  it("picks the season from the Dhaka date", () => {
    expect(currentTerm(Date.UTC(2026, 0, 15))).toEqual({ year: 2026, season: "spring" });
    expect(currentTerm(Date.UTC(2026, 5, 10))).toEqual({ year: 2026, season: "summer" });
    expect(currentTerm(Date.UTC(2026, 9, 19))).toEqual({ year: 2026, season: "fall" });
  });

  it("switches at midnight in Dhaka, not UTC", () => {
    // 18:00 UTC on 30 April is already 1 May in Dhaka.
    expect(currentTerm(Date.UTC(2026, 3, 30, 17, 59)).season).toBe("spring");
    expect(currentTerm(Date.UTC(2026, 3, 30, 18, 0)).season).toBe("summer");
    // New year in Dhaka while it is still 31 December in UTC.
    expect(currentTerm(Date.UTC(2026, 11, 31, 18, 0))).toEqual({ year: 2027, season: "spring" });
  });
});
