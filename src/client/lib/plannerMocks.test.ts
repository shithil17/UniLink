// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { loadMocks, MOCK_GRADES, mocksStorageKey, saveMocks } from "./plannerMocks";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("mock grade storage", () => {
  const key = mocksStorageKey("dev_cse", "2022");

  it("keys by user and curriculum version", () => {
    expect(key).not.toBe(mocksStorageKey("other", "2022"));
    expect(key).not.toBe(mocksStorageKey("dev_cse", "2026"));
  });

  it("offers the letter grades of the scale only", () => {
    expect(MOCK_GRADES[0]).toBe("A");
    expect(MOCK_GRADES).toContain("F");
    for (const g of ["I", "W", "WV"]) expect(MOCK_GRADES).not.toContain(g);
  });

  it("round-trips picks and clears the entry when empty", () => {
    saveMocks(key, { CSE101: "A-" });
    expect(loadMocks(key)).toEqual({ CSE101: "A-" });
    saveMocks(key, {});
    expect(localStorage.getItem(key)).toBeNull();
  });

  it("ignores corrupt data and grades outside the scale", () => {
    localStorage.setItem(key, "{not json");
    expect(loadMocks(key)).toEqual({});
    localStorage.setItem(key, JSON.stringify({ CSE101: "WV", CSE102: "B", CSE103: 4 }));
    expect(loadMocks(key)).toEqual({ CSE102: "B" });
    localStorage.setItem(key, "[1,2]");
    expect(loadMocks(key)).toEqual({});
  });

  it("survives storage that throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    expect(loadMocks(key)).toEqual({});
    expect(() => saveMocks(key, { CSE101: "A" })).not.toThrow();
  });
});
