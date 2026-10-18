import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { verifyPassword } from "../../password";
import { seedAdminStatements } from "../../../../scripts/seed-admin";

async function run(statements: string[]) {
  for (const sql of statements) await env.DB.prepare(sql).run();
}
const seed = { username: "Root_Admin", password: "temp-password-1" };

beforeEach(async () => {
  for (const table of ["sessions", "users", "audit_log"]) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
});

describe("seed-admin", () => {
  it("creates an admin that must change its password, with a system audit row", async () => {
    await run(await seedAdminStatements(seed));
    const user = await env.DB.prepare("SELECT * FROM users").first<Record<string, unknown>>();
    expect(user).toMatchObject({ username: "root_admin", role: "admin", must_change_password: 1 });
    expect(
      await verifyPassword(seed.password, {
        hash: user?.password_hash as string,
        salt: user?.password_salt as string,
        algo: user?.password_algo as string,
        iterations: user?.password_iterations as number,
      }),
    ).toBe(true);
    const audit = await env.DB.prepare("SELECT actor, action, target_id FROM audit_log").all();
    expect(audit.results).toEqual([
      { actor: "system", action: "seed_admin", target_id: String(user?.id) },
    ]);
  });

  it("is idempotent: a second run adds no user and no audit row", async () => {
    await run(await seedAdminStatements(seed));
    await run(await seedAdminStatements({ ...seed, password: "another-password" }));
    const users = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
    const audits = await env.DB.prepare("SELECT COUNT(*) AS n FROM audit_log").first<{
      n: number;
    }>();
    expect([users?.n, audits?.n]).toEqual([1, 1]);
  });

  it("does not claim an existing student as the seeded admin", async () => {
    await env.DB.prepare(
      "INSERT INTO users (username, student_key, student_suffix, admission_year, password_hash, password_salt, password_algo, password_iterations, created_at) VALUES ('root_admin', '2211111', '042', 22, 'x', 'x', 'x', 1, 1)",
    ).run();
    await run(await seedAdminStatements(seed));
    const row = await env.DB.prepare("SELECT role FROM users").first<{ role: string }>();
    expect(row?.role).toBe("student");
    const audits = await env.DB.prepare("SELECT COUNT(*) AS n FROM audit_log").first<{
      n: number;
    }>();
    expect(audits?.n).toBe(0);
  });

  it("uses the real student key when an ID is given and rejects a bad one", async () => {
    await run(await seedAdminStatements({ ...seed, studentId: "221 3456 642" }));
    const row = await env.DB.prepare(
      "SELECT student_key, student_suffix, admission_year FROM users",
    ).first();
    expect(row).toEqual({ student_key: "2213456", student_suffix: "642", admission_year: 22 });
    await expect(seedAdminStatements({ ...seed, studentId: "123" })).rejects.toThrow();
  });
});
