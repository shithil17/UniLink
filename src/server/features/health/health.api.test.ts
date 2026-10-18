import { env } from "cloudflare:workers";
import { describe, expect, it } from "vite-plus/test";
import { seed } from "../../../../scripts/seed";
import { healthResponse } from "../../../shared/schemas/health";
import { app } from "../../app";

describe("GET /api/health", () => {
  it("returns ok with the version read from D1", async () => {
    const res = await app.request("/api/health", {}, env);
    expect(res.status).toBe(200);
    expect(healthResponse.parse(await res.json())).toEqual({ ok: true, dbVersion: "1" });
  });

  it("reflects what is stored in app_meta", async () => {
    await seed(env.DB);
    await env.DB.prepare("UPDATE app_meta SET value = '42' WHERE key = 'db_version'").run();
    const res = await app.request("/api/health", {}, env);
    expect(await res.json()).toEqual({ ok: true, dbVersion: "42" });
  });

  it("fails loudly when app_meta is empty", async () => {
    await env.DB.prepare("DELETE FROM app_meta").run();
    const res = await app.request("/api/health", {}, env);
    expect(res.status).toBe(503);
  });
});
