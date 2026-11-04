import { readdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "drizzle-kit";

// Wrangler names the local D1 file by hash, so find it instead of hardcoding it.
const dir = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
const file = readdirSync(dir).find((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite");
if (!file) throw new Error("No local D1 file. Run `vp run db:migrate:local` first.");

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/server/db/schema.ts",
  dbCredentials: { url: `file:${join(dir, file)}` },
});
