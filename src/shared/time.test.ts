import { describe, expect, it } from "vite-plus/test";
import { dhakaYear } from "./time";

describe("dhakaYear", () => {
  it("rolls over at midnight in Dhaka, six hours before UTC", () => {
    expect(dhakaYear(Date.UTC(2026, 11, 31, 17, 59))).toBe(2026);
    expect(dhakaYear(Date.UTC(2026, 11, 31, 18, 0))).toBe(2027);
  });
});
