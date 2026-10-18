import { describe, expect, it } from "vite-plus/test";
import { healthResponse } from "./schemas/health";

describe("shared schemas", () => {
  it("accepts a healthy response and rejects a broken one", () => {
    expect(healthResponse.parse({ ok: true, dbVersion: "1" })).toEqual({
      ok: true,
      dbVersion: "1",
    });
    expect(healthResponse.safeParse({ ok: false }).success).toBe(false);
  });
});
