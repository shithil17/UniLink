/// <reference types="vite/client" />
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vite-plus/test";
import { seed } from "../../../../scripts/seed";

// The same files `vp run seed` reads; a worker cannot read the file system, so Vite bundles them in.
const files = import.meta.glob("../../../../data/curricula/*.json", {
  eager: true,
  import: "default",
});

const facultyFiles = import.meta.glob("../../../../data/faculty/*.json", {
  eager: true,
  import: "default",
});

const count = async (table: string) =>
  (await env.DB.prepare(`SELECT count(*) AS n FROM ${table}`).first<{ n: number }>())?.n;

describe("seed", () => {
  it("loads every curriculum and both fake students, and can run twice", async () => {
    const curricula = Object.values(files);
    expect(curricula).toHaveLength(13);
    const faculty = Object.values(facultyFiles).flat();
    await seed(env.DB, curricula, faculty);
    const courses = await count("courses");
    expect(await count("faculty")).toBe(faculty.length);
    expect(await count("curricula")).toBe(13);
    expect(courses).toBeGreaterThan(500);
    expect(await count("users")).toBe(2);

    await seed(env.DB, curricula, faculty);
    expect(await count("faculty")).toBe(faculty.length);
    expect(await count("curricula")).toBe(13);
    expect(await count("courses")).toBe(courses);
    expect(await count("users")).toBe(2);
  });

  it("seeds department, NSU page and null initials, and a re-seed keeps what a moderator added", async () => {
    await env.DB.prepare("DELETE FROM faculty").run();
    const entry = {
      name: "Seed Person",
      initials: null,
      designation: "Lecturer",
      department: "LAW",
      nsuPage: "https://law.northsouth.edu/people/seed-person/",
    };
    await seed(env.DB, [], [entry]);
    expect(
      await env.DB.prepare("SELECT initials, department, nsu_page, hidden FROM faculty").first(),
    ).toEqual({
      initials: null,
      department: "LAW",
      nsu_page: entry.nsuPage,
      hidden: 0,
    });

    // A moderator fills in initials and hides the row; the file still has no initials.
    await env.DB.prepare("UPDATE faculty SET initials = 'SeP', hidden = 1").run();
    await seed(env.DB, [], [{ ...entry, designation: "Professor" }]);
    expect(
      await env.DB.prepare("SELECT initials, designation, hidden FROM faculty").first(),
    ).toEqual({ initials: "SeP", designation: "Professor", hidden: 1 });
    expect(await count("faculty")).toBe(1);

    // The same name in another department is a different person.
    await seed(env.DB, [], [{ ...entry, department: "ECE" }]);
    expect(await count("faculty")).toBe(2);
  });
});
