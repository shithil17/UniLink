// Creates the first admin from env vars. Idempotent: running it again changes nothing.
//
//   vp run seed:admin            local D1
//   vp run seed:admin:staging    staging D1 (remote)
//   vp run seed:admin:prod       production D1 (remote)
//
// Env (process env, or `.dev.vars` which is read when present; the process env wins):
//   ADMIN_SEED_USERNAME    required
//   ADMIN_SEED_PASSWORD    required, a temporary password: the admin must change it at first login
//   ADMIN_SEED_STUDENT_ID  optional. When unset the admin gets a placeholder key ("admin") that can
//                          never match a real student ID, suffix "000" and admission year 0.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "../src/shared/schemas/auth.ts";
import { parseStudentId } from "../src/shared/studentId.ts";
import { hashPassword } from "../src/server/password.ts";

const sqlString = (value: string) => `'${value.replaceAll("'", "''")}'`;

export type AdminSeed = { username: string; password: string; studentId?: string };

export async function seedAdminStatements(
  seed: AdminSeed,
  now: number = Date.now(),
): Promise<string[]> {
  const username = seed.username.trim().toLowerCase();
  if (
    !/^[a-z0-9_]+$/.test(username) ||
    username.length < USERNAME_MIN_LENGTH ||
    username.length > USERNAME_MAX_LENGTH
  ) {
    throw new Error("ADMIN_SEED_USERNAME must be a valid username (lowercase letters, digits, _)");
  }
  let key = "admin";
  let suffix = "000";
  let admissionYear = 0;
  if (seed.studentId) {
    const parsed = parseStudentId(seed.studentId);
    if (!parsed) throw new Error("ADMIN_SEED_STUDENT_ID is not a valid NSU student ID");
    ({ key, suffix, admissionYear } = parsed);
  }
  const password = await hashPassword(seed.password);
  const u = sqlString(username);
  return [
    // OR IGNORE: an existing username or student key means the admin (or someone) is already there.
    `INSERT OR IGNORE INTO users (username, student_key, student_suffix, admission_year, password_hash, password_salt, password_algo, password_iterations, role, must_change_password, created_at) VALUES (${u}, ${sqlString(key)}, ${sqlString(suffix)}, ${admissionYear}, ${sqlString(password.hash)}, ${sqlString(password.salt)}, ${sqlString(password.algo)}, ${password.iterations}, 'admin', 1, ${now});`,
    // One audit row per seeded admin, written only for a user that really is an admin.
    `INSERT INTO audit_log (actor, action, target_type, target_id, before, reason, created_at) SELECT 'system', 'seed_admin', 'user', CAST(id AS TEXT), NULL, 'first admin seeded', ${now} FROM users WHERE username = ${u} AND role = 'admin' AND NOT EXISTS (SELECT 1 FROM audit_log WHERE action = 'seed_admin' AND target_type = 'user' AND target_id = CAST(users.id AS TEXT));`,
  ];
}

const TARGETS = {
  "--local": ["--local"],
  "--staging": ["--env", "staging", "--remote"],
  "--prod": ["--env", "production", "--remote"],
} as const;

if (import.meta.main) {
  if (existsSync(".dev.vars")) process.loadEnvFile(".dev.vars");
  const { ADMIN_SEED_USERNAME, ADMIN_SEED_PASSWORD, ADMIN_SEED_STUDENT_ID } = process.env;
  if (!ADMIN_SEED_USERNAME || !ADMIN_SEED_PASSWORD) {
    console.error("Set ADMIN_SEED_USERNAME and ADMIN_SEED_PASSWORD (env or .dev.vars).");
    process.exit(1);
  }
  const flag = (process.argv[2] ?? "--local") as keyof typeof TARGETS;
  const target = TARGETS[flag];
  if (!target) {
    console.error(`Unknown target ${flag}. Use ${Object.keys(TARGETS).join(", ")}.`);
    process.exit(1);
  }
  const statements = await seedAdminStatements({
    username: ADMIN_SEED_USERNAME,
    password: ADMIN_SEED_PASSWORD,
    studentId: ADMIN_SEED_STUDENT_ID || undefined,
  });
  const dir = mkdtempSync(join(tmpdir(), "unilink-seed-admin-"));
  try {
    const file = join(dir, "seed-admin.sql");
    writeFileSync(file, statements.join("\n"));
    execFileSync("wrangler", ["d1", "execute", "DB", ...target, `--file=${file}`], {
      stdio: "inherit",
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
