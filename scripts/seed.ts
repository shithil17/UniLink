// Fixture data for local dev and API tests. Grows with each feature (curriculum, fake students, ...).
// Run against local D1 with `vp run seed`; API tests call `seed(env.DB)` directly.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sqlString = (value: string) => `'${value.replaceAll("'", "''")}'`;

export function seedStatements(): string[] {
  return [`INSERT OR REPLACE INTO app_meta (key, value) VALUES ('seeded', ${sqlString("dev")});`];
}

export async function seed(db: D1Database): Promise<void> {
  await db.batch(seedStatements().map((sql) => db.prepare(sql)));
}

if (import.meta.main) {
  const file = join(mkdtempSync(join(tmpdir(), "unilink-seed-")), "seed.sql");
  writeFileSync(file, seedStatements().join("\n"));
  execFileSync("wrangler", ["d1", "execute", "DB", "--local", `--file=${file}`], {
    stdio: "inherit",
  });
}
