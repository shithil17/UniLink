import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { z } from "zod";
import { ApiError, OfflineError, apiGet, errorMessage, isOffline, queryString } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("apiGet offline handling", () => {
  it("throws an offline error when the network is down", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("Failed to fetch")));
    const err = await apiGet("/api/health", z.object({})).catch((e: unknown) => e);
    expect(isOffline(err)).toBe(true);
  });

  it("keeps HTTP errors separate from offline", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(new Response("{}", { status: 500 })));
    const err = await apiGet("/api/health", z.object({})).catch((e: unknown) => e);
    expect(isOffline(err)).toBe(false);
  });
});

describe("errorMessage", () => {
  it("says the user is offline", () => {
    expect(errorMessage(new OfflineError())).toBe("You are offline");
  });

  it("shows the server's message", () => {
    const err = new ApiError(409, { error: "taken", message: "That name is taken." });
    expect(errorMessage(err)).toBe("That name is taken.");
  });

  it("falls back to a rate-limit line on a 429 with no message", () => {
    expect(errorMessage(new ApiError(429, { error: "rate_limited" }))).toMatch(/Too many/);
  });

  it("falls back to a generic line otherwise", () => {
    const generic = errorMessage(new ApiError(500, {}));
    expect(generic).toMatch(/Something went wrong/);
    expect(errorMessage(new Error("boom"))).toBe(generic);
  });
});

describe("queryString", () => {
  it("keeps only defined, non-empty values", () => {
    expect(queryString({ a: "1", b: undefined, c: "", d: "x y" })).toBe("?a=1&d=x+y");
  });

  it("is an empty string when nothing is left", () => {
    expect(queryString({})).toBe("");
    expect(queryString({ a: undefined, b: "" })).toBe("");
  });
});
