/**
 * Replaces the local D1 database with a snapshot of staging.
 *
 * `wrangler d1 export` writes tables in alphabetical order, so rows that
 * reference `users` come before `users` exists and `wrangler d1 execute`
 * rejects the dump. Instead, wrangler creates an empty local database and
 * the dump is loaded straight into its SQLite file with foreign keys off.
 *
 * Usage: vp run db:pull:staging
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const D1_STATE = ".wrangler/state/v3/d1";
const DUMP = ".wrangler/staging.sql";

function wrangler(args: string[]) {
  execFileSync("wrangler", ["d1", ...args], { stdio: "inherit" });
}

function localDbFile(): string {
  const dir = join(D1_STATE, "miniflare-D1DatabaseObject");
  const file = readdirSync(dir).find((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite");
  if (!file) throw new Error(`No local D1 file in ${dir}`);
  return join(dir, file);
}

if (import.meta.main) {
  wrangler(["export", "DB", "--env", "staging", "--remote", `--output=${DUMP}`]);
  try {
    rmSync(D1_STATE, { recursive: true, force: true });
    wrangler(["execute", "DB", "--local", "--command=SELECT 1"]);

    const db = new DatabaseSync(localDbFile(), { enableForeignKeyConstraints: false });
    try {
      db.exec(readFileSync(DUMP, "utf8"));
      const broken = db.prepare("PRAGMA foreign_key_check").all();
      if (broken.length > 0) console.warn(`${broken.length} rows with broken foreign keys`);
    } finally {
      db.close();
    }
    console.log("Local database now matches staging.");
  } finally {
    rmSync(DUMP, { force: true });
  }
}
