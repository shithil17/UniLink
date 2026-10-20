import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import type {
  AuditEntry,
  IdConflictHolder,
  ModReport,
  ModUser,
} from "../../../shared/schemas/moderation";
import { app } from "../../app";
import { getDb } from "../../db/client";
import { limits } from "../../limits";
import { SESSION_COOKIE } from "../../middleware/session";
import { createTestSession, createTestUser } from "../../test/factories";

const db = () => getDb(env.DB);

async function call(method: string, path: string, token: string | null, body?: unknown) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.cookie = `${SESSION_COOKIE}=${token}`;
  return app.request(
    path,
    { method, headers, body: body === undefined ? undefined : JSON.stringify(body) },
    env,
  );
}

async function signedIn(role: "student" | "mod" | "admin" = "student", username?: string) {
  const user = await createTestUser(db(), { role, ...(username ? { username } : {}) });
  return { user, token: await createTestSession(db(), user.id) };
}

type Page<T> = { items: T[]; nextCursor: string | null };

const auditRows = () =>
  env.DB.prepare("SELECT * FROM audit_log ORDER BY id").all<{
    id: number;
    actor: string;
    action: string;
    target_type: string;
    target_id: string;
    before: string | null;
    reason: string | null;
    reverses_id: number | null;
  }>();

const userRow = (id: number) =>
  env.DB.prepare(
    "SELECT role, banned_at, student_key, must_change_password, password_hash FROM users WHERE id = ?",
  )
    .bind(id)
    .first<{
      role: string;
      banned_at: number | null;
      student_key: string;
      must_change_password: number;
      password_hash: string;
    }>();

beforeEach(async () => {
  for (const table of ["reports", "audit_log", "rate_limits", "sessions", "users"]) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
});

describe("role guards", () => {
  it("answers 401 signed out, 403 for students on mod routes and 403 for mods on admin routes", async () => {
    const student = await signedIn();
    const mod = await signedIn("mod");
    const admin = await signedIn("admin");

    expect((await call("GET", "/api/mod/users", null)).status).toBe(401);
    expect((await call("GET", "/api/mod/users", student.token)).status).toBe(403);
    expect((await call("GET", "/api/mod/reports", student.token)).status).toBe(403);
    expect((await call("GET", "/api/mod/users", mod.token)).status).toBe(200);
    expect((await call("GET", "/api/mod/users", admin.token)).status).toBe(200);

    expect((await call("GET", "/api/admin/audit", mod.token)).status).toBe(403);
    expect((await call("GET", "/api/admin/audit", student.token)).status).toBe(403);
    expect((await call("GET", "/api/admin/audit", admin.token)).status).toBe(200);
    const body = { role: "mod", reason: "trusted helper" };
    expect(
      (await call("POST", `/api/admin/users/${student.user.id}/role`, mod.token, body)).status,
    ).toBe(403);
    expect(
      (await call("POST", "/api/admin/audit/1/reverse", mod.token, { reason: "nope" })).status,
    ).toBe(403);
  });
});

describe("user list", () => {
  it("shows handle and state only, never the student ID, email or name", async () => {
    const mod = await signedIn("mod");
    await createTestUser(db(), {
      username: "alice_1",
      email: "alice@northsouth.edu",
      fullName: "Alice Rahman",
    });
    const res = await call("GET", "/api/mod/users?q=alice", mod.token);
    const text = await res.text();
    expect(text).toContain("alice_1");
    expect(text).not.toMatch(/alice@|Rahman|studentKey|studentSuffix|student_key|studentId|email/i);
    expect(Object.keys(JSON.parse(text).items[0]).sort()).toEqual([
      "bannedAt",
      "createdAt",
      "id",
      "mustChangePassword",
      "postingBlockedUntil",
      "probingFlaggedAt",
      "role",
      "username",
    ]);
  });

  it("searches by username prefix and pages with a cursor", async () => {
    const mod = await signedIn("mod");
    for (const name of ["bob_a", "bob_b", "bob_c", "carol"])
      await createTestUser(db(), { username: name });

    const found = await (
      await call("GET", "/api/mod/users?q=bob", mod.token)
    ).json<Page<ModUser>>();
    expect(found.items.map((u) => u.username).sort()).toEqual(["bob_a", "bob_b", "bob_c"]);

    const first = await (
      await call("GET", "/api/mod/users?q=bob&limit=2", mod.token)
    ).json<Page<ModUser>>();
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    const second = await (
      await call("GET", `/api/mod/users?q=bob&limit=2&cursor=${first.nextCursor}`, mod.token)
    ).json<Page<ModUser>>();
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    expect([...first.items, ...second.items].map((u) => u.username).sort()).toEqual([
      "bob_a",
      "bob_b",
      "bob_c",
    ]);
  });

  it("rejects a bad search and a bad cursor", async () => {
    const mod = await signedIn("mod");
    expect((await call("GET", "/api/mod/users?q=a", mod.token)).status).toBe(400);
    expect((await call("GET", "/api/mod/users?cursor=abc", mod.token)).status).toBe(400);
  });
});

describe("ban and unban", () => {
  it("bans, ends the user's sessions, refuses their cookie and logs a snapshot", async () => {
    const mod = await signedIn("mod");
    const target = await signedIn();
    const res = await call("POST", `/api/mod/users/${target.user.id}/ban`, mod.token, {
      reason: "spamming",
    });
    expect(res.status).toBe(200);

    expect((await userRow(target.user.id))?.banned_at).not.toBeNull();
    const left = await env.DB.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?")
      .bind(target.user.id)
      .first<{ n: number }>();
    expect(left?.n).toBe(0);
    expect((await call("GET", "/api/auth/me", target.token)).status).toBe(401);

    const [row] = (await auditRows()).results;
    expect(row).toMatchObject({
      actor: String(mod.user.id),
      action: "ban",
      target_type: "user",
      target_id: String(target.user.id),
      before: '{"bannedAt":null}',
      reason: "spamming",
    });
  });

  it("refuses a second ban and an unban of someone who is not banned", async () => {
    const mod = await signedIn("mod");
    const target = await signedIn();
    const reason = { reason: "because" };
    expect(
      (await call("POST", `/api/mod/users/${target.user.id}/unban`, mod.token, reason)).status,
    ).toBe(409);
    await call("POST", `/api/mod/users/${target.user.id}/ban`, mod.token, reason);
    expect(
      (await call("POST", `/api/mod/users/${target.user.id}/ban`, mod.token, reason)).status,
    ).toBe(409);
    expect((await auditRows()).results).toHaveLength(1);
  });

  it("unbans and logs the previous ban time", async () => {
    const mod = await signedIn("mod");
    const target = await createTestUser(db(), { bannedAt: 1234 });
    const res = await call("POST", `/api/mod/users/${target.id}/unban`, mod.token, {
      reason: "appeal",
    });
    expect(res.status).toBe(200);
    expect((await userRow(target.id))?.banned_at).toBeNull();
    expect((await auditRows()).results[0]).toMatchObject({
      action: "unban",
      before: '{"bannedAt":1234}',
    });
  });

  it("needs a reason", async () => {
    const mod = await signedIn("mod");
    const target = await signedIn();
    expect((await call("POST", `/api/mod/users/${target.user.id}/ban`, mod.token, {})).status).toBe(
      400,
    );
    expect(
      (await call("POST", `/api/mod/users/${target.user.id}/ban`, mod.token, { reason: " x " }))
        .status,
    ).toBe(400);
    expect((await userRow(target.user.id))?.banned_at).toBeNull();
  });

  it("lets a mod act on students only; an admin acts on mods but never admins or themselves", async () => {
    const mod = await signedIn("mod");
    const otherMod = await signedIn("mod");
    const admin = await signedIn("admin");
    const otherAdmin = await signedIn("admin");
    const reason = { reason: "testing the rule" };

    for (const target of [otherMod, admin, mod]) {
      const res = await call("POST", `/api/mod/users/${target.user.id}/ban`, mod.token, reason);
      expect(res.status).toBe(403);
    }
    expect(
      (await call("POST", `/api/mod/users/${otherAdmin.user.id}/ban`, admin.token, reason)).status,
    ).toBe(403);
    expect(
      (await call("POST", `/api/mod/users/${admin.user.id}/ban`, admin.token, reason)).status,
    ).toBe(403);
    expect(
      (await call("POST", `/api/mod/users/${otherMod.user.id}/ban`, admin.token, reason)).status,
    ).toBe(200);
    expect((await call("POST", "/api/mod/users/99999/ban", admin.token, reason)).status).toBe(404);
    expect((await auditRows()).results).toHaveLength(1);
  });
});

describe("temporary password reset", () => {
  it("returns a password once, forces a change, signs the user out and keeps secrets out of the log", async () => {
    const mod = await signedIn("mod");
    const target = await signedIn("student", "dana_9");
    const before = await userRow(target.user.id);

    const res = await call("POST", `/api/mod/users/${target.user.id}/reset-password`, mod.token, {
      reason: "locked out",
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const { temporaryPassword } = await res.json<{ temporaryPassword: string }>();
    expect(temporaryPassword).toHaveLength(limits.tempPasswordLength);

    const after = await userRow(target.user.id);
    expect(after?.must_change_password).toBe(1);
    expect(after?.password_hash).not.toBe(before?.password_hash);
    expect((await call("GET", "/api/auth/me", target.token)).status).toBe(401);

    // The temporary password logs in, and then everything but the password change is blocked.
    const login = await call("POST", "/api/auth/login", null, {
      username: "dana_9",
      password: temporaryPassword,
    });
    expect(login.status).toBe(200);
    expect(await login.json()).toMatchObject({ mustChangePassword: true });
    const cookie = /unilink_session=([^;]+)/.exec(login.headers.get("set-cookie") ?? "")?.[1] ?? "";
    expect((await call("GET", "/api/attempts", cookie)).status).toBe(403);

    const [row] = (await auditRows()).results;
    expect(row).toMatchObject({ action: "reset_password", reason: "locked out" });
    const logged = JSON.stringify(row);
    expect(logged).not.toContain(temporaryPassword);
    expect(logged).not.toContain(after?.password_hash ?? "?");
  });

  it("is refused when a mod targets another mod", async () => {
    const mod = await signedIn("mod");
    const otherMod = await signedIn("mod");
    const res = await call("POST", `/api/mod/users/${otherMod.user.id}/reset-password`, mod.token, {
      reason: "not allowed",
    });
    expect(res.status).toBe(403);
  });
});

describe("ID conflict", () => {
  it("finds the holder of a key and is the only response with a student ID", async () => {
    const mod = await signedIn("mod");
    const holder = await createTestUser(db(), { studentKey: "2210001", studentSuffix: "042" });

    const res = await call("GET", "/api/mod/id-conflict?key=2210001", mod.token);
    const { holder: found } = await res.json<{ holder: IdConflictHolder | null }>();
    expect(found).toMatchObject({
      id: holder.id,
      username: holder.username,
      studentId: "2210001042",
    });

    const none = await call("GET", "/api/mod/id-conflict?key=9999999", mod.token);
    expect(await none.json()).toEqual({ holder: null });
    expect((await call("GET", "/api/mod/id-conflict?key=123", mod.token)).status).toBe(400);

    // Only a real lookup is logged, and the key itself is not written to the log.
    const rows = (await auditRows()).results;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "id_lookup", target_id: String(holder.id) });
    expect(JSON.stringify(rows[0])).not.toContain("2210001");
  });

  it("releases the key: the holder is banned, the key is free for its owner, and it is logged", async () => {
    const mod = await signedIn("mod");
    const holder = await signedIn();
    const key = (await userRow(holder.user.id))?.student_key ?? "";

    const res = await call("POST", "/api/mod/id-conflict/release", mod.token, {
      userId: holder.user.id,
      reason: "impersonating",
    });
    expect(res.status).toBe(200);

    const after = await userRow(holder.user.id);
    expect(after?.banned_at).not.toBeNull();
    expect(after?.student_key).toBe(`released:${holder.user.id}`);
    expect(
      await call("GET", `/api/mod/id-conflict?key=${key}`, mod.token).then((r) => r.json()),
    ).toEqual({
      holder: null,
    });
    expect((await call("GET", "/api/auth/me", holder.token)).status).toBe(401);

    const release = (await auditRows()).results.find((r) => r.action === "release_key");
    expect(JSON.parse(release?.before ?? "{}")).toEqual({ studentKey: key, bannedAt: null });

    // A second release has nothing to release.
    const again = await call("POST", "/api/mod/id-conflict/release", mod.token, {
      userId: holder.user.id,
      reason: "again",
    });
    expect(again.status).toBe(409);
  });
});

describe("roles", () => {
  it("promotes a student and demotes a mod, and refuses a no-op", async () => {
    const admin = await signedIn("admin");
    const student = await signedIn();
    const up = await call("POST", `/api/admin/users/${student.user.id}/role`, admin.token, {
      role: "mod",
      reason: "active helper",
    });
    expect(up.status).toBe(200);
    expect((await userRow(student.user.id))?.role).toBe("mod");
    // The new role applies to the live session straight away.
    expect((await call("GET", "/api/mod/users", student.token)).status).toBe(200);

    const noop = await call("POST", `/api/admin/users/${student.user.id}/role`, admin.token, {
      role: "mod",
      reason: "again",
    });
    expect(noop.status).toBe(409);

    const down = await call("POST", `/api/admin/users/${student.user.id}/role`, admin.token, {
      role: "student",
      reason: "stepped down",
    });
    expect(down.status).toBe(200);
    expect((await call("GET", "/api/mod/users", student.token)).status).toBe(403);

    const rows = (await auditRows()).results;
    expect(rows.map((r) => [r.action, r.before])).toEqual([
      ["role_change", '{"role":"student"}'],
      ["role_change", '{"role":"mod"}'],
    ]);
  });

  it("cannot promote an admin or oneself", async () => {
    const admin = await signedIn("admin");
    const otherAdmin = await signedIn("admin");
    const body = { role: "student", reason: "nope" };
    expect(
      (await call("POST", `/api/admin/users/${otherAdmin.user.id}/role`, admin.token, body)).status,
    ).toBe(403);
    expect(
      (await call("POST", `/api/admin/users/${admin.user.id}/role`, admin.token, body)).status,
    ).toBe(403);
  });
});

describe("audit log and reverse", () => {
  it("reverses a ban from its snapshot, logs the reversal and refuses a second reversal", async () => {
    const mod = await signedIn("mod");
    const admin = await signedIn("admin");
    const target = await signedIn();
    await call("POST", `/api/mod/users/${target.user.id}/ban`, mod.token, { reason: "spam" });
    const [ban] = (await auditRows()).results;

    const res = await call("POST", `/api/admin/audit/${ban.id}/reverse`, admin.token, {
      reason: "wrong person",
    });
    expect(res.status).toBe(201);
    expect((await userRow(target.user.id))?.banned_at).toBeNull();

    const rows = (await auditRows()).results;
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      actor: String(admin.user.id),
      action: "reverse",
      target_id: String(target.user.id),
      reverses_id: ban.id,
      reason: "wrong person",
    });

    const again = await call("POST", `/api/admin/audit/${ban.id}/reverse`, admin.token, {
      reason: "x1x",
    });
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ error: "already_reversed" });
    const reverseOfReverse = await call(
      "POST",
      `/api/admin/audit/${rows[1].id}/reverse`,
      admin.token,
      {
        reason: "x2x",
      },
    );
    expect(await reverseOfReverse.json()).toMatchObject({ error: "is_reversal" });
    expect((await auditRows()).results).toHaveLength(2);
  });

  it("restores a role change and a released key exactly, and refuses a taken key", async () => {
    const mod = await signedIn("mod");
    const admin = await signedIn("admin");
    const holder = await signedIn();
    const key = (await userRow(holder.user.id))?.student_key ?? "";
    await call("POST", "/api/mod/id-conflict/release", mod.token, {
      userId: holder.user.id,
      reason: "fake",
    });
    const release = (await auditRows()).results.find((r) => r.action === "release_key");

    // The real owner signs up with the key in the meantime.
    const owner = await createTestUser(db(), { studentKey: key });
    const blocked = await call("POST", `/api/admin/audit/${release?.id}/reverse`, admin.token, {
      reason: "undo",
    });
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toMatchObject({ error: "key_in_use" });
    expect((await userRow(holder.user.id))?.student_key).toBe(`released:${holder.user.id}`);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'reverse'").first(),
    ).toEqual({
      n: 0,
    });

    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(owner.id).run();
    const ok = await call("POST", `/api/admin/audit/${release?.id}/reverse`, admin.token, {
      reason: "undo",
    });
    expect(ok.status).toBe(201);
    const restored = await userRow(holder.user.id);
    expect(restored?.student_key).toBe(key);
    expect(restored?.banned_at).toBeNull();
  });

  it("cannot reverse a password reset or touch a user who is an admin now", async () => {
    const mod = await signedIn("mod");
    const admin = await signedIn("admin");
    const target = await signedIn();
    await call("POST", `/api/mod/users/${target.user.id}/reset-password`, mod.token, {
      reason: "lost it",
    });
    await call("POST", `/api/mod/users/${target.user.id}/ban`, mod.token, { reason: "spam" });
    const rows = (await auditRows()).results;

    const reset = await call("POST", `/api/admin/audit/${rows[0].id}/reverse`, admin.token, {
      reason: "undo",
    });
    expect(await reset.json()).toMatchObject({ error: "not_reversible" });

    await env.DB.prepare("UPDATE users SET role = 'admin' WHERE id = ?").bind(target.user.id).run();
    const ban = await call("POST", `/api/admin/audit/${rows[1].id}/reverse`, admin.token, {
      reason: "undo",
    });
    expect(ban.status).toBe(403);
    expect((await userRow(target.user.id))?.banned_at).not.toBeNull();
    expect(
      (await call("POST", "/api/admin/audit/99999/reverse", admin.token, { reason: "undo" }))
        .status,
    ).toBe(404);
  });

  it("lists entries newest first with names, flags and no snapshot, and pages", async () => {
    const mod = await signedIn("mod", "mod_one");
    const admin = await signedIn("admin");
    const target = await signedIn("student", "target_1");
    await call("POST", `/api/mod/users/${target.user.id}/ban`, mod.token, { reason: "spam" });
    await call("POST", `/api/mod/users/${target.user.id}/reset-password`, mod.token, {
      reason: "reset",
    });
    const [ban] = (await auditRows()).results;
    await call("POST", `/api/admin/audit/${ban.id}/reverse`, admin.token, { reason: "mistake" });

    const res = await call("GET", "/api/admin/audit", admin.token);
    const text = await res.text();
    expect(text).not.toContain('"before"');
    const { items } = JSON.parse(text) as Page<AuditEntry>;
    expect(items.map((e) => e.action)).toEqual(["reverse", "reset_password", "ban"]);
    expect(items[2]).toMatchObject({
      actor: "mod_one",
      targetLabel: "target_1",
      reversedBy: items[0].id,
      reversible: false,
    });
    expect(items[1]).toMatchObject({ reversible: false });
    expect(items[0]).toMatchObject({ reverses: ban.id, reversible: false });

    const page1 = await (
      await call("GET", "/api/admin/audit?limit=2", admin.token)
    ).json<Page<AuditEntry>>();
    expect(page1.items).toHaveLength(2);
    const page2 = await (
      await call("GET", `/api/admin/audit?limit=2&cursor=${page1.nextCursor}`, admin.token)
    ).json<Page<AuditEntry>>();
    expect(page2.items.map((e) => e.id)).toEqual([ban.id]);

    const filtered = await (
      await call(
        "GET",
        `/api/admin/audit?targetType=user&targetId=${target.user.id}&actor=${mod.user.id}`,
        admin.token,
      )
    ).json<Page<AuditEntry>>();
    expect(filtered.items.map((e) => e.action)).toEqual(["reset_password", "ban"]);
  });
});

describe("reports", () => {
  it("files a report, refuses a duplicate open one, and allows a new one after it is closed", async () => {
    const reporter = await signedIn();
    const mod = await signedIn("mod");
    const target = await signedIn("student", "rude_one");
    const body = { targetType: "user", targetId: target.user.id, reason: "Harassing people" };

    const first = await call("POST", "/api/reports", reporter.token, body);
    expect(first.status).toBe(201);
    const dup = await call("POST", "/api/reports", reporter.token, body);
    expect(dup.status).toBe(409);
    expect(await dup.json()).toMatchObject({ error: "already_reported" });

    // Someone else can still report the same target.
    const other = await signedIn();
    expect((await call("POST", "/api/reports", other.token, body)).status).toBe(201);

    const { id } = await first.json<{ id: number }>();
    const closed = await call("POST", `/api/mod/reports/${id}/resolve`, mod.token, {
      outcome: "dismissed",
    });
    expect(closed.status).toBe(200);
    expect((await call("POST", "/api/reports", reporter.token, body)).status).toBe(201);
  });

  it("refuses reports on yourself, unknown targets and bad input, and needs a login", async () => {
    const reporter = await signedIn();
    const reason = "Something is wrong";
    expect(
      (
        await call("POST", "/api/reports", reporter.token, {
          targetType: "user",
          targetId: reporter.user.id,
          reason,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call("POST", "/api/reports", reporter.token, {
          targetType: "user",
          targetId: 99999,
          reason,
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await call("POST", "/api/reports", reporter.token, {
          targetType: "ride",
          targetId: 1,
          reason,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call("POST", "/api/reports", reporter.token, {
          targetType: "user",
          targetId: 1,
          reason: "",
        })
      ).status,
    ).toBe(400);
    expect(
      (await call("POST", "/api/reports", null, { targetType: "user", targetId: 1, reason }))
        .status,
    ).toBe(401);
  });

  it("is rate limited per reporter", async () => {
    const reporter = await signedIn();
    const statuses: number[] = [];
    for (let i = 0; i <= limits.reportCreate.limit; i++) {
      const target = await createTestUser(db());
      const res = await call("POST", "/api/reports", reporter.token, {
        targetType: "user",
        targetId: target.id,
        reason: "Not nice",
      });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, -1).every((s) => s === 201)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it("lists the open queue oldest first with labels, resolves once, and logs it", async () => {
    const mod = await signedIn("mod");
    const reporter = await signedIn("student", "reporter_1");
    const a = await createTestUser(db(), { username: "target_a" });
    const b = await createTestUser(db(), { username: "target_b" });
    for (const t of [a, b]) {
      await call("POST", "/api/reports", reporter.token, {
        targetType: "user",
        targetId: t.id,
        reason: "Spammer",
      });
    }

    const queue = await (await call("GET", "/api/mod/reports", mod.token)).json<Page<ModReport>>();
    expect(queue.items.map((r) => r.targetLabel)).toEqual(["target_a", "target_b"]);
    expect(queue.items[0]).toMatchObject({
      reporter: "reporter_1",
      status: "open",
      reason: "Spammer",
    });

    const page1 = await (
      await call("GET", "/api/mod/reports?limit=1", mod.token)
    ).json<Page<ModReport>>();
    const page2 = await (
      await call("GET", `/api/mod/reports?limit=1&cursor=${page1.nextCursor}`, mod.token)
    ).json<Page<ModReport>>();
    expect([page1.items[0].targetLabel, page2.items[0].targetLabel]).toEqual([
      "target_a",
      "target_b",
    ]);

    const id = queue.items[0].id;
    const done = await call("POST", `/api/mod/reports/${id}/resolve`, mod.token, {
      outcome: "resolved",
      note: "Warned the user",
    });
    expect(done.status).toBe(200);
    expect(
      (await call("POST", `/api/mod/reports/${id}/resolve`, mod.token, { outcome: "resolved" }))
        .status,
    ).toBe(409);
    expect(
      (await call("POST", "/api/mod/reports/99999/resolve", mod.token, { outcome: "resolved" }))
        .status,
    ).toBe(404);

    const open = await (await call("GET", "/api/mod/reports", mod.token)).json<Page<ModReport>>();
    expect(open.items.map((r) => r.targetLabel)).toEqual(["target_b"]);
    const closed = await (
      await call("GET", "/api/mod/reports?status=resolved", mod.token)
    ).json<Page<ModReport>>();
    expect(closed.items[0]).toMatchObject({
      id,
      status: "resolved",
      resolveNote: "Warned the user",
    });

    const logged = (await auditRows()).results.filter((r) => r.action === "resolve_report");
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({
      target_type: "report",
      target_id: String(id),
      before: '{"status":"open"}',
    });
  });
});

describe("private data stays private", () => {
  it("shows a mod their own attempts only: there is no mod route for anyone else's", async () => {
    const mod = await signedIn("mod");
    const student = await signedIn();
    await env.DB.prepare(
      "INSERT INTO attempts (user_id, course_code, grade, created_at) VALUES (?, 'CSE115', 'A', 1)",
    )
      .bind(student.user.id)
      .run();
    expect(await (await call("GET", "/api/attempts", mod.token)).json()).toEqual([]);
    for (const path of ["attempts", "cgpa", "routine", `users/${student.user.id}/attempts`]) {
      expect((await call("GET", `/api/mod/${path}`, mod.token)).status).toBe(404);
      expect((await call("GET", `/api/admin/${path}`, mod.token)).status).toBe(403);
    }
  });
});
