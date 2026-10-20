import { describe, expect, it } from "vite-plus/test";
import { limits } from "./limits";
import { generateTemporaryPassword } from "./tempPassword";

describe("generateTemporaryPassword()", () => {
  it("has the configured length and only unambiguous characters", () => {
    const password = generateTemporaryPassword();
    expect(password).toHaveLength(limits.tempPasswordLength);
    expect(password).toMatch(/^[A-HJ-NP-Z2-9]+$/);
  });

  it("differs between calls", () => {
    const seen = new Set(Array.from({ length: 20 }, () => generateTemporaryPassword()));
    expect(seen.size).toBe(20);
  });
});
