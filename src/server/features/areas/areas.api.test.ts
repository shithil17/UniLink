import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import type { AreaOption, ModArea } from "../../../shared/schemas/areas";
import { app } from "../../app";
import { getDb } from "../../db/client";
import { limits } from "../../limits";
import { SESSION_COOKIE } from "../../middleware/session";
import { reverse } from "../../reverse";
import {
  areaIdBySlug,
  createTestSession,
  createTestUser,
  resetAreas,
  SEEDED_AREA_COUNT,
} from "../../test/factories";

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

type Person = { id: number; token: string };

async function person(role: "student" | "mod" | "admin" = "student"): Promise<Person> {
  const user = await createTestUser(db(), { role });
  return { id: user.id, token: await createTestSession(db(), user.id) };
}

const REASON = "Not a real pickup point";

const list = async (who: Person) => {
  const res = await call("GET", "/api/areas", who.token);
  expect(res.status).toBe(200);
  return res.json<AreaOption[]>();
};
const modList = async (who: Person) => {
  const res = await call("GET", "/api/mod/areas", who.token);
  expect(res.status).toBe(200);
  return res.json<ModArea[]>();
};
const add = (who: Person, body: unknown) => call("POST", "/api/mod/areas", who.token, body);
const addOk = async (who: Person, body: unknown) => {
  const res = await add(who, body);
  expect(res.status).toBe(201);
  return res.json<ModArea>();
};
const auditRows = async (action: string) =>
  (
    await env.DB.prepare(
      "SELECT actor, target_type, target_id, before, reason FROM audit_log WHERE action = ? ORDER BY id",
    )
      .bind(action)
      .all<{
        actor: string;
        target_type: string;
        target_id: string;
        before: string | null;
        reason: string | null;
      }>()
  ).results;

beforeEach(async () => {
  for (const table of ["rides", "sessions", "users", "rate_limits", "audit_log"]) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
  await resetAreas(env.DB);
});

describe("the area list", () => {
  it("is seeded with Bashundhara first and Outside Dhaka last, the rest alphabetical", async () => {
    const who = await person();
    const res = await call("GET", "/api/areas", who.token);
    expect(res.headers.get("cache-control")).toBe("private, max-age=60");
    const areas = await res.json<AreaOption[]>();
    expect(areas).toHaveLength(SEEDED_AREA_COUNT);
    expect(areas[0]).toMatchObject({ slug: "bashundhara-r-a", name: "Bashundhara R/A" });
    expect(areas.at(-1)).toMatchObject({ slug: "outside-dhaka", name: "Outside Dhaka" });
    const middle = areas.slice(1, -1).map((a) => a.name);
    expect(middle).toEqual([...middle].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
    expect(middle.slice(0, 2)).toEqual(["Adabor", "Aftabnagar"]);
    expect(areas.every((a) => a.children.length === 0)).toBe(true);
  });

  it("needs a login", async () => {
    expect((await call("GET", "/api/areas", null)).status).toBe(401);
  });

  it("carries each area's point, null for Outside Dhaka and for a new area", async () => {
    const mod = await person("mod");
    const who = await person();
    await addOk(mod, { name: "Brand new place" });
    const areas = await list(who);
    const bySlug = new Map(areas.map((a) => [a.slug, a]));
    // Bashundhara is by NSU, Uttara is north of it, Jatrabari south-east of the centre.
    const nsu = bySlug.get("bashundhara-r-a")!;
    const uttara = bySlug.get("uttara")!;
    const jatrabari = bySlug.get("jatrabari")!;
    expect(Math.abs(nsu.lat! - 23.8151)).toBeLessThan(0.02);
    expect(Math.abs(nsu.lng! - 90.4253)).toBeLessThan(0.02);
    expect(uttara.lat!).toBeGreaterThan(nsu.lat!);
    expect(jatrabari.lat!).toBeLessThan(nsu.lat! - 0.05);
    expect(bySlug.get("outside-dhaka")).toMatchObject({ lat: null, lng: null });
    expect(areas.find((a) => a.name === "Brand new place")).toMatchObject({ lat: null, lng: null });
    // Every point is a pair.
    expect(areas.every((a) => (a.lat === null) === (a.lng === null))).toBe(true);
    // The mod list carries them too.
    expect((await modList(mod)).find((a) => a.slug === "uttara")).toMatchObject({
      lat: uttara.lat,
      lng: uttara.lng,
    });
  });

  it("lists sub-areas under their parent and leaves hidden areas out for students but not for mods", async () => {
    const mod = await person("mod");
    const student = await person();
    const mirpur = await areaIdBySlug(env.DB, "mirpur");
    const sub = await addOk(mod, { name: "Mirpur 10", parentId: mirpur });
    const hidden = await addOk(mod, { name: "Ghost Town" });

    expect((await list(student)).find((a) => a.id === mirpur)?.children).toEqual([
      { id: sub.id, slug: "mirpur-mirpur-10", name: "Mirpur 10", lat: null, lng: null },
    ]);

    const res = await call("POST", `/api/mod/areas/${hidden.id}/hide`, mod.token, {
      reason: REASON,
    });
    expect(res.status).toBe(200);
    expect((await list(student)).some((a) => a.id === hidden.id)).toBe(false);
    expect((await modList(mod)).find((a) => a.id === hidden.id)).toMatchObject({
      hidden: true,
      hiddenReason: REASON,
      parentId: null,
    });

    // A sub-area under a hidden parent is not listed either.
    await call("POST", `/api/mod/areas/${mirpur}/hide`, mod.token, { reason: REASON });
    const after = await list(student);
    expect(after.some((a) => a.id === mirpur)).toBe(false);
    expect(JSON.stringify(after)).not.toContain("Mirpur 10");
    expect((await modList(mod)).find((a) => a.id === sub.id)?.hidden).toBe(false);

    // Showing them again brings them back.
    await call("POST", `/api/mod/areas/${mirpur}/unhide`, mod.token, { reason: REASON });
    expect((await list(student)).find((a) => a.id === mirpur)?.children).toHaveLength(1);
  });
});

describe("mod area management", () => {
  it("refuses students and signed-out callers on every mod route", async () => {
    const student = await person();
    const bashundhara = await areaIdBySlug(env.DB, "bashundhara-r-a");
    for (const [method, path, body] of [
      ["GET", "/api/mod/areas", undefined],
      ["POST", "/api/mod/areas", { name: "New place" }],
      ["PATCH", `/api/mod/areas/${bashundhara}`, { name: "Renamed" }],
      ["POST", `/api/mod/areas/${bashundhara}/hide`, { reason: REASON }],
      ["POST", `/api/mod/areas/${bashundhara}/unhide`, { reason: REASON }],
    ] as const) {
      expect((await call(method, path, student.token, body)).status).toBe(403);
      expect((await call(method, path, null, body)).status).toBe(401);
    }
    expect(await modList(await person("mod"))).toHaveLength(SEEDED_AREA_COUNT);
    expect(
      (await env.DB.prepare("SELECT name FROM areas WHERE id = ?").bind(bashundhara).first())!.name,
    ).toBe("Bashundhara R/A");
  });

  it("adds a top-level area and a sub-area, each with an audit row", async () => {
    const mod = await person("mod");
    const top = await addOk(mod, { name: "  Rampura Bridge " });
    expect(top).toMatchObject({
      name: "Rampura Bridge",
      slug: "rampura-bridge",
      parentId: null,
      hidden: false,
    });
    const mirpur = await areaIdBySlug(env.DB, "mirpur");
    const sub = await addOk(mod, { name: "Section 12", parentId: mirpur });
    expect(sub).toMatchObject({ parentId: mirpur, slug: "mirpur-section-12" });

    const rows = await auditRows("area_add");
    expect(rows.map((r) => [r.actor, r.target_type, r.target_id])).toEqual([
      [String(mod.id), "area", String(top.id)],
      [String(mod.id), "area", String(sub.id)],
    ]);
  });

  it("refuses a sub-area under a sub-area, under a missing parent, and a blank or symbol-only name", async () => {
    const mod = await person("mod");
    const mirpur = await areaIdBySlug(env.DB, "mirpur");
    const sub = await addOk(mod, { name: "Section 12", parentId: mirpur });

    const nested = await add(mod, { name: "Block C", parentId: sub.id });
    expect(nested.status).toBe(400);
    expect((await nested.json<{ error: string }>()).error).toBe("invalid_parent");
    const missing = await add(mod, { name: "Block C", parentId: 999_999 });
    expect(missing.status).toBe(400);
    expect((await missing.json<{ error: string }>()).error).toBe("invalid_parent");
    expect((await add(mod, { name: "   " })).status).toBe(400);
    expect((await add(mod, { name: "---" })).status).toBe(400);
    expect((await add(mod, { name: "x".repeat(limits.areaField.nameMax + 1) })).status).toBe(400);
    // Nothing was written for any of them.
    expect(await modList(mod)).toHaveLength(SEEDED_AREA_COUNT + 1);
  });

  it("refuses a duplicate name among siblings, ignoring case, but allows it under another parent", async () => {
    const mod = await person("mod");
    const mirpur = await areaIdBySlug(env.DB, "mirpur");
    const banani = await areaIdBySlug(env.DB, "banani");

    const dupTop = await add(mod, { name: "MIRPUR" });
    expect(dupTop.status).toBe(409);
    expect((await dupTop.json<{ error: string }>()).error).toBe("name_taken");

    await addOk(mod, { name: "Section 12", parentId: mirpur });
    expect((await add(mod, { name: "section 12", parentId: mirpur })).status).toBe(409);
    // The same name under another parent is a different place.
    await addOk(mod, { name: "Section 12", parentId: banani });
    // A sub-area may share a top-level area's name.
    await addOk(mod, { name: "Mirpur", parentId: banani });
  });

  it("renames an area, keeps its slug, and refuses a taken name", async () => {
    const mod = await person("mod");
    const area = await addOk(mod, { name: "Rampura Bridge" });
    const res = await call("PATCH", `/api/mod/areas/${area.id}`, mod.token, {
      name: "Rampura Bridge Area",
    });
    expect(res.status).toBe(200);
    expect(await res.json<ModArea>()).toMatchObject({
      name: "Rampura Bridge Area",
      slug: "rampura-bridge",
    });
    const rows = await auditRows("area_rename");
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0]!.before!)).toEqual({ name: "Rampura Bridge" });

    const taken = await call("PATCH", `/api/mod/areas/${area.id}`, mod.token, { name: "mirpur" });
    expect(taken.status).toBe(409);
    expect((await taken.json<{ error: string }>()).error).toBe("name_taken");
    expect(await auditRows("area_rename")).toHaveLength(1);

    expect(
      (await call("PATCH", "/api/mod/areas/999999", mod.token, { name: "Nowhere" })).status,
    ).toBe(404);
    expect((await call("PATCH", `/api/mod/areas/${area.id}`, mod.token, { name: "" })).status).toBe(
      400,
    );
  });

  it("names the area on its audit log rows, hidden or not", async () => {
    const mod = await person("mod");
    const admin = await person("admin");
    const area = await addOk(mod, { name: "Rampura Bridge" });
    await call("POST", `/api/mod/areas/${area.id}/hide`, mod.token, { reason: REASON });
    const log = await call("GET", "/api/admin/audit?targetType=area", admin.token);
    const items = (await log.json<{ items: { action: string; targetLabel: string | null }[] }>())
      .items;
    expect(items.map((i) => [i.action, i.targetLabel])).toEqual([
      ["area_hide", "Rampura Bridge"],
      ["area_add", "Rampura Bridge"],
    ]);
  });

  it("hides and shows an area with a reason and an audit row each time, and refuses a repeat", async () => {
    const mod = await person("mod");
    const area = await addOk(mod, { name: "Rampura Bridge" });
    const path = (verb: string) => `/api/mod/areas/${area.id}/${verb}`;

    expect((await call("POST", path("hide"), mod.token, {})).status).toBe(400);
    expect((await call("POST", path("hide"), mod.token, { reason: "x" })).status).toBe(400);
    expect((await call("POST", path("unhide"), mod.token, { reason: REASON })).status).toBe(409);

    const hidden = await call("POST", path("hide"), mod.token, { reason: REASON });
    expect(hidden.status).toBe(200);
    expect(await hidden.json<ModArea>()).toMatchObject({ hidden: true, hiddenReason: REASON });
    expect((await call("POST", path("hide"), mod.token, { reason: REASON })).status).toBe(409);

    const shown = await call("POST", path("unhide"), mod.token, { reason: "Back in use" });
    expect(await shown.json<ModArea>()).toMatchObject({ hidden: false, hiddenReason: null });

    const hides = await auditRows("area_hide");
    expect(hides).toHaveLength(1);
    expect(hides[0]).toMatchObject({
      actor: String(mod.id),
      target_id: String(area.id),
      reason: REASON,
    });
    expect(JSON.parse(hides[0]!.before!)).toEqual({ hidden: false, hiddenReason: null });
    const shows = await auditRows("area_unhide");
    expect(shows).toHaveLength(1);
    expect(JSON.parse(shows[0]!.before!)).toEqual({ hidden: true, hiddenReason: REASON });

    expect(
      (await call("POST", "/api/mod/areas/999999/hide", mod.token, { reason: REASON })).status,
    ).toBe(404);
  });

  it("never deletes: a hidden area is still in the mod list", async () => {
    const mod = await person("mod");
    const bashundhara = await areaIdBySlug(env.DB, "bashundhara-r-a");
    await call("POST", `/api/mod/areas/${bashundhara}/hide`, mod.token, { reason: REASON });
    expect((await modList(mod)).find((a) => a.id === bashundhara)?.hidden).toBe(true);
    expect(
      (await call("DELETE", `/api/mod/areas/${bashundhara}`, mod.token)).status,
    ).toBeGreaterThanOrEqual(404);
  });

  it("rate limits a mod's writes", async () => {
    const mod = await person("mod");
    const area = await addOk(mod, { name: "Rampura Bridge" });
    let last = 201;
    // The add above was the first write; use up the rest of the window.
    for (let i = 1; i < limits.areaModWrite.limit; i++) {
      last = (await call("PATCH", `/api/mod/areas/${area.id}`, mod.token, { name: `Name ${i}` }))
        .status;
    }
    expect(last).toBe(200);
    const res = await call("PATCH", `/api/mod/areas/${area.id}`, mod.token, { name: "One more" });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
  });
});

describe("reversing area actions", () => {
  it("puts a hidden area back and a renamed area's name back, and refuses when the name is taken", async () => {
    const mod = await person("mod");
    const admin = await person("admin");
    const area = await addOk(mod, { name: "Rampura Bridge" });
    await call("POST", `/api/mod/areas/${area.id}/hide`, mod.token, { reason: REASON });
    await call("PATCH", `/api/mod/areas/${area.id}`, mod.token, { name: "Rampura Flyover" });

    const hideId = await env.DB.prepare(
      "SELECT id FROM audit_log WHERE action = 'area_hide'",
    ).first<{
      id: number;
    }>();
    const renameId = await env.DB.prepare(
      "SELECT id FROM audit_log WHERE action = 'area_rename'",
    ).first<{
      id: number;
    }>();
    const addId = await env.DB.prepare("SELECT id FROM audit_log WHERE action = 'area_add'").first<{
      id: number;
    }>();
    const undo = (auditId: number) =>
      reverse(db(), { auditId, actor: admin.id, reason: "Mistake" });

    // Adding is not reversible; hide the area instead.
    expect(await undo(addId!.id)).toEqual({ ok: false, reason: "not_reversible" });

    // Someone else took the old name meanwhile (its slug is taken too, so it gets another).
    expect((await addOk(mod, { name: "Rampura Bridge" })).slug).not.toBe("rampura-bridge");
    expect(await undo(renameId!.id)).toEqual({ ok: false, reason: "value_in_use" });

    expect((await undo(hideId!.id)).ok).toBe(true);
    const now = (await modList(mod)).find((a) => a.id === area.id);
    expect(now).toMatchObject({ hidden: false, hiddenReason: null, name: "Rampura Flyover" });
    expect(await undo(hideId!.id)).toEqual({ ok: false, reason: "already_reversed" });
  });
});
