import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { app } from "../../app";
import { getDb } from "../../db/client";
import { limits } from "../../limits";
import { SESSION_COOKIE } from "../../middleware/session";
import { createTestSession, createTestUser } from "../../test/factories";

beforeEach(async () => {
  for (const table of ["attempts", "faculty", "sessions", "users"]) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
});

async function signedIn(role: "student" | "mod" = "student") {
  const user = await createTestUser(getDb(env.DB), { role });
  return { user, token: await createTestSession(getDb(env.DB), user.id) };
}

const get = (path: string, token: string) =>
  app.request(path, { headers: { cookie: `${SESSION_COOKIE}=${token}` } }, env);

type Row = { id: number; name: string; initials: string | null; department: string };
type Page = { items: Row[]; nextCursor: string | null };

async function page(path: string, token: string): Promise<Page> {
  const res = await get(path, token);
  expect(res.status).toBe(200);
  return (await res.json()) as Page;
}

/** Follows `nextCursor` until the end, returning every page. */
async function walk(path: string, token: string): Promise<Page[]> {
  const pages: Page[] = [];
  let cursor: string | null = null;
  do {
    const sep = path.includes("?") ? "&" : "?";
    const next = await page(cursor ? `${path}${sep}cursor=${cursor}` : path, token);
    pages.push(next);
    cursor = next.nextCursor;
  } while (cursor);
  return pages;
}

const names = (rows: Row[]) => rows.map((r) => r.name);

/** `count` people "Faculty 001".."Faculty NNN" with distinct initials, all in ECE. */
async function seedNumbered(count: number) {
  const insert = env.DB.prepare(
    "INSERT INTO faculty (name, initials, designation, department) VALUES (?, ?, 'Lecturer', 'ECE')",
  );
  const n = (i: number) => String(i).padStart(3, "0");
  await env.DB.batch(
    Array.from({ length: count }, (_, i) => insert.bind(`Faculty ${n(i + 1)}`, `F${n(i + 1)}`)),
  );
}

const insertPerson = (name: string, initials: string | null, department = "ECE", hidden = 0) =>
  env.DB.prepare(
    "INSERT INTO faculty (name, initials, designation, department, hidden) VALUES (?, ?, 'Lecturer', ?, ?)",
  )
    .bind(name, initials, department, hidden)
    .run();

describe("GET /api/faculty", () => {
  it("needs a signed-in user and lists visible faculty by name with initials and department", async () => {
    await env.DB.prepare(
      "INSERT INTO faculty (name, initials, designation, department) VALUES ('Zed Zee', 'ZZ', 'Lecturer', 'ECE'), ('Amy Ay', 'AA', 'Professor', 'LAW'), ('Bob Bee', NULL, 'Lecturer', 'MGT')",
    ).run();
    expect((await app.request("/api/faculty", {}, env)).status).toBe(401);

    const { token } = await signedIn();
    expect(await page("/api/faculty", token)).toEqual({
      items: [
        {
          id: expect.any(Number),
          name: "Amy Ay",
          initials: "AA",
          designation: "Professor",
          department: "LAW",
        },
        {
          id: expect.any(Number),
          name: "Bob Bee",
          initials: null,
          designation: "Lecturer",
          department: "MGT",
        },
        {
          id: expect.any(Number),
          name: "Zed Zee",
          initials: "ZZ",
          designation: "Lecturer",
          department: "ECE",
        },
      ],
      nextCursor: null,
    });
  });

  it("walks the directory in pages with no overlap and no gap", async () => {
    const total = limits.facultyPage.defaultSize * 2 + 5;
    await seedNumbered(total);
    const { token } = await signedIn();

    const pages = await walk("/api/faculty", token);
    expect(pages.map((p) => p.items.length)).toEqual([
      limits.facultyPage.defaultSize,
      limits.facultyPage.defaultSize,
      5,
    ]);
    expect(pages.at(-1)?.nextCursor).toBeNull();
    const all = pages.flatMap((p) => names(p.items));
    expect(all).toEqual(
      Array.from({ length: total }, (_, i) => `Faculty ${String(i + 1).padStart(3, "0")}`),
    );
    expect(new Set(all).size).toBe(total);
  });

  it("honors limit up to the cap and refuses a bad cursor", async () => {
    await seedNumbered(limits.facultyPage.maxSize + 5);
    const { token } = await signedIn();
    expect((await page("/api/faculty?limit=3", token)).items).toHaveLength(3);
    expect((await page("/api/faculty?limit=1000", token)).items).toHaveLength(
      limits.facultyPage.maxSize,
    );
    expect((await get("/api/faculty?cursor=abc", token)).status).toBe(400);
    expect((await get("/api/faculty?cursor=999999", token)).status).toBe(400);
  });

  it("searches the whole directory, not just the first page", async () => {
    await seedNumbered(limits.facultyPage.defaultSize * 2);
    await insertPerson("Zed Quasar", "ZQr");
    const { token } = await signedIn();

    // Sorted by name, "Zed Quasar" falls after every numbered row: far past page one unfiltered.
    const unfiltered = await page("/api/faculty", token);
    expect(names(unfiltered.items)).not.toContain("Zed Quasar");
    expect(unfiltered.nextCursor).not.toBeNull();

    expect(names((await page("/api/faculty?q=quasar", token)).items)).toEqual(["Zed Quasar"]);
    expect(names((await page("/api/faculty?q=zqr", token)).items)).toEqual(["Zed Quasar"]);
    expect((await page("/api/faculty?q=nobodyhere", token)).items).toEqual([]);
  });

  it("matches every word of the query as a name-word prefix, ignoring titles and case", async () => {
    await insertPerson("Atiqur Rahman (Aqu)", "Aqu");
    await insertPerson("Hafiz Abdur Rahman", "HzR");
    await insertPerson("M. Rokonuzzaman", "RkZ");
    await insertPerson("Tanzilur Rahman", null);
    const { token } = await signedIn();
    const found = async (q: string) =>
      names((await page(`/api/faculty?q=${encodeURIComponent(q)}`, token)).items);

    expect(await found("rahman")).toEqual([
      "Atiqur Rahman (Aqu)",
      "Hafiz Abdur Rahman",
      "Tanzilur Rahman",
    ]);
    expect(await found("Dr. atiq RAH")).toEqual(["Atiqur Rahman (Aqu)"]);
    expect(await found("man")).toEqual([]);
    expect(await found("rokon")).toEqual(["M. Rokonuzzaman"]);
    expect(await found("  ")).toHaveLength(4);
  });

  it("ranks exact initials, then initials prefixes, then names, and pages within that order", async () => {
    await insertPerson("Aaron Rkz Name", null);
    await insertPerson("Zed", "Rkz");
    await insertPerson("Yan", "RkZa");
    await insertPerson("Bea Rkzed", null);
    const { token } = await signedIn();
    const order = ["Zed", "Yan", "Aaron Rkz Name", "Bea Rkzed"];

    expect(names((await page("/api/faculty?q=rkz", token)).items)).toEqual(order);
    // One row per page crosses every rank boundary.
    const pages = await walk("/api/faculty?q=rkz&limit=1", token);
    expect(pages.flatMap((p) => names(p.items))).toEqual(order);
  });

  it("filters by department and pages within it", async () => {
    await insertPerson("Law One", null, "LAW");
    await insertPerson("Law Two", null, "LAW");
    await insertPerson("Ece One", null, "ECE");
    const { token } = await signedIn();
    const pages = await walk("/api/faculty?department=LAW&limit=1", token);
    expect(pages.flatMap((p) => names(p.items))).toEqual(["Law One", "Law Two"]);
    expect((await get("/api/faculty?department=NOPE", token)).status).toBe(400);
  });

  it("leaves hidden faculty out of the list and search but not out of an attempt that names them", async () => {
    await insertPerson("Shown One", "SO");
    await insertPerson("Hidden One", "HO", "ECE", 1);
    const hidden = (await env.DB.prepare("SELECT id FROM faculty WHERE hidden = 1").first<{
      id: number;
    }>())!.id;
    const { user, token } = await signedIn();
    await env.DB.prepare(
      "INSERT INTO attempts (user_id, course_code, grade, faculty_id, created_at) VALUES (?, 'CSE115', 'B', ?, 0)",
    )
      .bind(user.id, hidden)
      .run();

    expect(names((await page("/api/faculty", token)).items)).toEqual(["Shown One"]);
    expect((await page("/api/faculty?q=hidden", token)).items).toEqual([]);
    expect((await page("/api/faculty?q=ho", token)).items).toEqual([]);

    const attempts = (await (await get("/api/attempts", token)).json()) as unknown[];
    expect(attempts).toEqual([
      expect.objectContaining({
        facultyId: hidden,
        faculty: { name: "Hidden One", initials: "HO" },
      }),
    ]);
  });
});

describe("GET /api/mod/faculty", () => {
  type ModRow = Row & { hidden: boolean };
  const modPage = async (path: string, token: string) => {
    const res = await get(path, token);
    expect(res.status).toBe(200);
    return (await res.json()) as { items: ModRow[]; nextCursor: string | null };
  };

  it("walks every row in pages with no overlap and no gap, hidden ones only when asked", async () => {
    await seedNumbered(limits.facultyPage.defaultSize + 7);
    await insertPerson("Faculty 000 Hidden", "FHd", "ECE", 1);
    const { token } = await signedIn("mod");

    const visible = await walk("/api/mod/faculty", token);
    expect(visible.map((p) => p.items.length)).toEqual([limits.facultyPage.defaultSize, 7]);
    expect(new Set(visible.flatMap((p) => names(p.items))).size).toBe(
      limits.facultyPage.defaultSize + 7,
    );

    const all = await walk("/api/mod/faculty?hidden=include", token);
    const flat = all.flatMap((p) => p.items);
    expect(flat).toHaveLength(limits.facultyPage.defaultSize + 8);
    expect(new Set(flat.map((r) => r.id)).size).toBe(flat.length);
    expect(flat[0]).toMatchObject({ name: "Faculty 000 Hidden", hidden: true, nsuPage: null });
  });

  it("searches every row, including hidden ones when asked, beyond the first page", async () => {
    await seedNumbered(limits.facultyPage.defaultSize * 2);
    await insertPerson("Zed Quasar", "ZQr");
    await insertPerson("Zed Quokka", "ZQk", "ECE", 1);
    const { token } = await signedIn("mod");

    expect(names((await modPage("/api/mod/faculty?q=zed", token)).items)).toEqual(["Zed Quasar"]);
    expect(names((await modPage("/api/mod/faculty?q=zed&hidden=include", token)).items)).toEqual([
      "Zed Quasar",
      "Zed Quokka",
    ]);
    const pages = await walk("/api/mod/faculty?q=zed&hidden=include&limit=1", token);
    expect(pages.flatMap((p) => names(p.items))).toEqual(["Zed Quasar", "Zed Quokka"]);
  });

  it("refuses a cursor that names no row", async () => {
    const { token } = await signedIn("mod");
    expect((await get("/api/mod/faculty?cursor=999999", token)).status).toBe(400);
  });
});
