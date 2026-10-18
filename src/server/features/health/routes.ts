import { Hono } from "hono";
import type { HealthResponse } from "../../../shared/schemas/health";
import { getDb } from "../../db/client";
import { appMetaRepo, DB_VERSION_KEY } from "../../repos/appMeta";

export const healthRoutes = new Hono<{ Bindings: Env }>().get("/", async (c) => {
  const dbVersion = await appMetaRepo(getDb(c.env.DB)).get(DB_VERSION_KEY);
  if (dbVersion === null) {
    return c.json({ ok: false, error: "app_meta is not seeded" }, 503);
  }
  return c.json({ ok: true, dbVersion } satisfies HealthResponse);
});
