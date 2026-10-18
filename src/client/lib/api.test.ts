import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { z } from "zod";
import { apiGet, isOffline } from "./api";

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
